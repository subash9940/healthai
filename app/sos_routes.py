import os
import uuid
import json
import time
import logging
from collections import deque
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Tuple
import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.db import get_pool
from app.services.auth import get_current_facility_staff, StaffSession
from app.schemas.sos import (
    SosCreateRequest,
    SosAlertResponse,
    SosListItemResponse,
    SosActionResponse,
    SosResolveRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sos"])

# ---------------------------------------------------------------------------
# Rate Limiting (D6)
# ---------------------------------------------------------------------------
# In-memory sliding window rate limiter: 30 requests per minute per client IP.
# If TRUST_PROXY=1, parse the first IP in X-Forwarded-For; otherwise use request.client.host.
# Fail open on any error. Never rate limit by phone number.

RATE_LIMIT_WINDOW_SECONDS = 60.0
RATE_LIMIT_MAX_REQUESTS = 30
_ip_request_timestamps: Dict[str, deque] = {}


def _get_client_ip(request: Request) -> str:
    trust_proxy = os.getenv("TRUST_PROXY", "0").strip() in ("1", "true", "True")
    if trust_proxy:
        xff = request.headers.get("X-Forwarded-For")
        if xff:
            # Client IP is the first entry in comma-separated chain
            return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_rate_limit(client_ip: str) -> bool:
    """
    Check and record sliding-window request timestamp.
    Returns True if allowed, False if rate limited.
    Fails open (returns True) on unexpected errors.
    """
    try:
        now = time.time()
        window_start = now - RATE_LIMIT_WINDOW_SECONDS

        if client_ip not in _ip_request_timestamps:
            _ip_request_timestamps[client_ip] = deque()

        timestamps = _ip_request_timestamps[client_ip]

        # Purge timestamps outside the sliding window
        while timestamps and timestamps[0] < window_start:
            timestamps.popleft()

        if len(timestamps) >= RATE_LIMIT_MAX_REQUESTS:
            return False

        timestamps.append(now)
        return True
    except Exception as e:
        logger.warning(f"Rate limiter exception, failing open: {e}")
        return True


# ---------------------------------------------------------------------------
# Geospatial Distance Helper (D4)
# ---------------------------------------------------------------------------
# Haversine distance in SQL:
# 6371 * 2 * ASIN(SQRT(
#     POWER(SIN(RADIANS((lat - $1) / 2)), 2) +
#     COS(RADIANS($1)) * COS(RADIANS(lat)) *
#     POWER(SIN(RADIANS((lng - $2) / 2)), 2)
# ))

HAVERSINE_SQL = """
6371.0 * 2.0 * ASIN(SQRT(
    POWER(SIN(RADIANS((lat - $1) / 2.0)), 2) +
    COS(RADIANS($1)) * COS(RADIANS(lat)) *
    POWER(SIN(RADIANS((lng - $2) / 2.0)), 2)
))
"""


def _parse_reported_at(reported_at_str: Optional[str]) -> Optional[datetime]:
    """
    Parse client ISO timestamp string into aware datetime.
    Gracefully fallback to None if malformed or in future (> 60s skew).
    """
    if not reported_at_str:
        return None
    try:
        # Handle trailing Z or offset
        dt = datetime.fromisoformat(reported_at_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        if dt > now + timedelta(seconds=60):
            # Future timestamp drift: reject client timestamp, fallback to None
            return None
        return dt
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Public SOS Ingestion (D3, D4, D5, D6)
# ---------------------------------------------------------------------------

@router.post("/sos", response_model=SosAlertResponse)
async def create_sos_alert(
    req: SosCreateRequest,
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Public emergency SOS intake endpoint.
    - Zero auth required.
    - Mandatory: client_alert_id.
    - Gracefully handles missing/malformed coordinates, timestamps, or facility_ids.
    - Idempotency on client_alert_id.
    - Deduplication: collapses repeat requests from same phone within 2 minutes into existing open alert.
    - Nearest facility routing using tier priority (sub_centre/phc -> chc/district_hospital).
    """
    client_ip = _get_client_ip(request)
    if not _check_rate_limit(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Too many SOS alerts from this IP. Please wait.",
        )

    clean_client_alert_id = req.client_alert_id.strip() if req.client_alert_id else ""
    if not clean_client_alert_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="client_alert_id is required.",
        )

    parsed_reported_at = _parse_reported_at(req.reported_at)
    now_utc = datetime.now(timezone.utc)

    clean_phone = req.patient_phone.strip() if req.patient_phone else None
    clean_name = req.patient_name.strip() if req.patient_name else None
    clean_village = req.patient_village.strip() if req.patient_village else None
    clean_sex = req.patient_sex.strip() if req.patient_sex else None
    symptoms_json = json.dumps(req.symptoms) if req.symptoms is not None else None

    # Validate facility_id if passed
    explicit_facility_uuid: Optional[uuid.UUID] = None
    if req.facility_id:
        try:
            explicit_facility_uuid = uuid.UUID(req.facility_id)
        except Exception:
            explicit_facility_uuid = None

    async with pool.acquire() as conn:
        # 1. Idempotency check: if client_alert_id already exists, return existing
        existing_client_alert = await conn.fetchrow(
            """
            SELECT s.id, s.client_alert_id, s.status, s.received_at, s.repeat_count,
                   s.facility_id, f.name AS facility_name, f.level AS facility_level, f.contact_phone AS facility_phone
            FROM sos_alerts s
            LEFT JOIN facilities f ON s.facility_id = f.id
            WHERE s.client_alert_id = $1
            """,
            clean_client_alert_id,
        )
        if existing_client_alert:
            fac_id = str(existing_client_alert["facility_id"]) if existing_client_alert["facility_id"] else None
            return SosAlertResponse(
                alert_id=str(existing_client_alert["id"]),
                client_alert_id=existing_client_alert["client_alert_id"],
                status=existing_client_alert["status"],
                received_at=existing_client_alert["received_at"].isoformat(),
                facility_id=fac_id,
                facility_name=existing_client_alert["facility_name"],
                facility_level=existing_client_alert["facility_level"],
                facility_phone=existing_client_alert["facility_phone"],
                distance_km=None,
                repeat_count=existing_client_alert["repeat_count"],
                unrouted=(fac_id is None),
                message="SOS alert already recorded (idempotent submission).",
            )

        # 2. Deduplication check (D5): same patient_phone + open alert within 2 minutes
        if clean_phone:
            two_mins_ago = now_utc - timedelta(minutes=2)
            open_dup_alert = await conn.fetchrow(
                """
                SELECT s.id, s.client_alert_id, s.status, s.received_at, s.repeat_count,
                       s.facility_id, f.name AS facility_name, f.level AS facility_level, f.contact_phone AS facility_phone
                FROM sos_alerts s
                LEFT JOIN facilities f ON s.facility_id = f.id
                WHERE s.patient_phone = $1
                  AND s.status = 'open'
                  AND s.received_at >= $2
                ORDER BY s.received_at DESC
                LIMIT 1
                FOR UPDATE OF s
                """,
                clean_phone,
                two_mins_ago,
            )
            if open_dup_alert:
                # Collapse into existing open alert
                new_repeat = open_dup_alert["repeat_count"] + 1
                update_fields = ["repeat_count = $1"]
                update_params: List[Any] = [new_repeat]
                if req.lat is not None and req.lng is not None:
                    update_params.extend([req.lat, req.lng, req.accuracy])
                    update_fields.extend([
                        f"lat = ${len(update_params)-2}",
                        f"lng = ${len(update_params)-1}",
                        f"accuracy = ${len(update_params)}",
                    ])
                update_params.append(open_dup_alert["id"])
                update_query = f"""
                    UPDATE sos_alerts
                    SET {", ".join(update_fields)}
                    WHERE id = ${len(update_params)}
                """
                await conn.execute(update_query, *update_params)

                fac_id = str(open_dup_alert["facility_id"]) if open_dup_alert["facility_id"] else None
                return SosAlertResponse(
                    alert_id=str(open_dup_alert["id"]),
                    client_alert_id=open_dup_alert["client_alert_id"],
                    status=open_dup_alert["status"],
                    received_at=open_dup_alert["received_at"].isoformat(),
                    facility_id=fac_id,
                    facility_name=open_dup_alert["facility_name"],
                    facility_level=open_dup_alert["facility_level"],
                    facility_phone=open_dup_alert["facility_phone"],
                    distance_km=None,
                    repeat_count=new_repeat,
                    unrouted=(fac_id is None),
                    message="SOS alert updated with latest location (repeat collapsed).",
                )

        # 3. Determine facility routing
        assigned_facility_id: Optional[uuid.UUID] = None
        routed_facility_row = None
        computed_distance_km: Optional[float] = None

        if explicit_facility_uuid:
            # Check if explicit facility exists
            routed_facility_row = await conn.fetchrow(
                "SELECT id, name, level, contact_phone, lat, lng FROM facilities WHERE id = $1",
                explicit_facility_uuid,
            )
            if routed_facility_row:
                assigned_facility_id = routed_facility_row["id"]
                if (
                    req.lat is not None and req.lng is not None and
                    routed_facility_row["lat"] is not None and routed_facility_row["lng"] is not None
                ):
                    dist_row = await conn.fetchrow(
                        f"SELECT {HAVERSINE_SQL} AS distance FROM facilities WHERE id = $3",
                        req.lat,
                        req.lng,
                        assigned_facility_id,
                    )
                    if dist_row and dist_row["distance"] is not None:
                        computed_distance_km = round(float(dist_row["distance"]), 2)

        # If not explicitly assigned or facility did not exist, compute nearest facility (D4)
        if not assigned_facility_id and req.lat is not None and req.lng is not None:
            # Primary tier: sub_centre, phc
            nearest_primary = await conn.fetchrow(
                f"""
                SELECT id, name, level, contact_phone, {HAVERSINE_SQL} AS distance
                FROM facilities
                WHERE lat IS NOT NULL AND lng IS NOT NULL
                  AND level IN ('sub_centre', 'phc')
                ORDER BY distance ASC
                LIMIT 1
                """,
                req.lat,
                req.lng,
            )
            if nearest_primary:
                routed_facility_row = nearest_primary
                assigned_facility_id = nearest_primary["id"]
                computed_distance_km = round(float(nearest_primary["distance"]), 2)
            else:
                # Fallback tier: chc, district_hospital
                nearest_fallback = await conn.fetchrow(
                    f"""
                    SELECT id, name, level, contact_phone, {HAVERSINE_SQL} AS distance
                    FROM facilities
                    WHERE lat IS NOT NULL AND lng IS NOT NULL
                      AND level IN ('chc', 'district_hospital')
                    ORDER BY distance ASC
                    LIMIT 1
                    """,
                    req.lat,
                    req.lng,
                )
                if nearest_fallback:
                    routed_facility_row = nearest_fallback
                    assigned_facility_id = nearest_fallback["id"]
                    computed_distance_km = round(float(nearest_fallback["distance"]), 2)

        # 4. Insert new SOS alert
        insert_row = await conn.fetchrow(
            """
            INSERT INTO sos_alerts (
                client_alert_id,
                reported_at,
                received_at,
                patient_name,
                patient_phone,
                patient_village,
                patient_age,
                patient_sex,
                symptoms,
                lat,
                lng,
                accuracy,
                facility_id,
                channel,
                status,
                repeat_count
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, 'open', 1)
            RETURNING id, client_alert_id, status, received_at, repeat_count, facility_id
            """,
            clean_client_alert_id,
            parsed_reported_at,
            now_utc,
            clean_name,
            clean_phone,
            clean_village,
            req.patient_age,
            clean_sex,
            symptoms_json,
            req.lat,
            req.lng,
            req.accuracy,
            assigned_facility_id,
            req.channel or "citizen_web",
        )

        fac_id_str = str(insert_row["facility_id"]) if insert_row["facility_id"] else None
        fac_name = routed_facility_row["name"] if routed_facility_row else None
        fac_level = str(routed_facility_row["level"]) if routed_facility_row else None
        fac_phone = routed_facility_row["contact_phone"] if routed_facility_row else None

        return SosAlertResponse(
            alert_id=str(insert_row["id"]),
            client_alert_id=insert_row["client_alert_id"],
            status=insert_row["status"],
            received_at=insert_row["received_at"].isoformat(),
            facility_id=fac_id_str,
            facility_name=fac_name,
            facility_level=fac_level,
            facility_phone=fac_phone,
            distance_km=computed_distance_km,
            repeat_count=insert_row["repeat_count"],
            unrouted=(fac_id_str is None),
            message="Emergency SOS alert successfully registered.",
        )


# ---------------------------------------------------------------------------
# Facility Staff SOS Alert Management (D7)
# ---------------------------------------------------------------------------

@router.get("/facility/sos", response_model=List[SosListItemResponse])
async def list_facility_sos_alerts(
    status_filter: Optional[str] = None,
    current_staff: StaffSession = Depends(get_current_facility_staff),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    List SOS alerts for authenticated staff's facility PLUS unrouted alerts (facility_id IS NULL).
    Annotates each alert with unrouted=True if facility_id is None.
    Ordered by received_at DESC.
    """
    facility_uuid = uuid.UUID(current_staff.facility_id)

    query = """
        SELECT
            s.id,
            s.client_alert_id,
            s.reported_at,
            s.received_at,
            s.patient_name,
            s.patient_phone,
            s.patient_village,
            s.patient_age,
            s.patient_sex,
            s.symptoms,
            s.lat,
            s.lng,
            s.accuracy,
            s.facility_id,
            f.name AS facility_name,
            f.level AS facility_level,
            f.contact_phone AS facility_phone,
            s.channel,
            s.status,
            s.repeat_count,
            s.acknowledged_by_staff_id,
            fs.name AS acknowledged_by_staff_name,
            s.acknowledged_at,
            s.resolved_at,
            s.resolution_notes
        FROM sos_alerts s
        LEFT JOIN facilities f ON s.facility_id = f.id
        LEFT JOIN facility_staff fs ON s.acknowledged_by_staff_id = fs.id
        WHERE (s.facility_id = $1 OR s.facility_id IS NULL)
    """
    params: List[Any] = [facility_uuid]

    if status_filter:
        clean_status = status_filter.strip().lower()
        if clean_status in ("open", "acknowledged", "resolved"):
            params.append(clean_status)
            query += f" AND s.status = ${len(params)}"

    query += " ORDER BY s.received_at DESC"

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)

    results: List[SosListItemResponse] = []
    for r in rows:
        # Parse symptoms
        symptoms_raw = r["symptoms"]
        symptoms_list: List[str] = []
        if isinstance(symptoms_raw, list):
            symptoms_list = [str(s) for s in symptoms_raw]
        elif isinstance(symptoms_raw, str):
            try:
                parsed = json.loads(symptoms_raw)
                if isinstance(parsed, list):
                    symptoms_list = [str(s) for s in parsed]
            except Exception:
                pass

        is_unrouted = r["facility_id"] is None
        results.append(
            SosListItemResponse(
                id=str(r["id"]),
                client_alert_id=r["client_alert_id"],
                reported_at=r["reported_at"].isoformat() if r["reported_at"] else None,
                received_at=r["received_at"].isoformat() if r["received_at"] else datetime.now(timezone.utc).isoformat(),
                patient_name=r["patient_name"],
                patient_phone=r["patient_phone"],
                patient_village=r["patient_village"],
                patient_age=r["patient_age"],
                patient_sex=r["patient_sex"],
                symptoms=symptoms_list,
                lat=r["lat"],
                lng=r["lng"],
                accuracy=r["accuracy"],
                facility_id=str(r["facility_id"]) if r["facility_id"] else None,
                facility_name=r["facility_name"],
                facility_level=str(r["facility_level"]) if r["facility_level"] else None,
                facility_phone=r["facility_phone"],
                channel=r["channel"],
                status=r["status"],
                repeat_count=r["repeat_count"],
                unrouted=is_unrouted,
                acknowledged_by_staff_id=str(r["acknowledged_by_staff_id"]) if r["acknowledged_by_staff_id"] else None,
                acknowledged_by_staff_name=r["acknowledged_by_staff_name"],
                acknowledged_at=r["acknowledged_at"].isoformat() if r["acknowledged_at"] else None,
                resolved_at=r["resolved_at"].isoformat() if r["resolved_at"] else None,
                resolution_notes=r["resolution_notes"],
            )
        )

    return results


@router.post("/facility/sos/{alert_id}/acknowledge", response_model=SosActionResponse)
async def acknowledge_sos_alert(
    alert_id: str,
    current_staff: StaffSession = Depends(get_current_facility_staff),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Acknowledge an emergency SOS alert.
    - Transitions from 'open' -> 'acknowledged'.
    - Guarded atomic update: WHERE status = 'open' AND (facility_id = :staff_facility OR facility_id IS NULL)
    - If facility_id was NULL (unrouted), acknowledges AND binds facility_id = staff.facility_id.
    - Returns 409 Conflict if alert not found or already acknowledged/resolved by another facility.
    """
    try:
        alert_uuid = uuid.UUID(alert_id)
        staff_uuid = uuid.UUID(current_staff.staff_id)
        facility_uuid = uuid.UUID(current_staff.facility_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format.",
        )

    now_utc = datetime.now(timezone.utc)

    async with pool.acquire() as conn:
        updated_row = await conn.fetchrow(
            """
            UPDATE sos_alerts
            SET status = 'acknowledged',
                facility_id = $1,
                acknowledged_by_staff_id = $2,
                acknowledged_at = $3
            WHERE id = $4
              AND status = 'open'
              AND (facility_id = $1 OR facility_id IS NULL)
            RETURNING id, status, facility_id, acknowledged_at
            """,
            facility_uuid,
            staff_uuid,
            now_utc,
            alert_uuid,
        )

        if not updated_row:
            # Check why it didn't update to return descriptive 409
            existing = await conn.fetchrow("SELECT id, status, facility_id FROM sos_alerts WHERE id = $1", alert_uuid)
            if not existing:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"SOS alert with ID {alert_id} not found.",
                )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot acknowledge SOS alert: current status is '{existing['status']}' and assigned to facility '{existing['facility_id']}'.",
            )

        return SosActionResponse(
            alert_id=str(updated_row["id"]),
            status=updated_row["status"],
            facility_id=str(updated_row["facility_id"]),
            facility_name=current_staff.facility_name,
            facility_level=current_staff.facility_level,
            updated_at=updated_row["acknowledged_at"].isoformat(),
            message="SOS alert successfully acknowledged.",
        )


@router.post("/facility/sos/{alert_id}/resolve", response_model=SosActionResponse)
async def resolve_sos_alert(
    alert_id: str,
    req: Optional[SosResolveRequest] = None,
    current_staff: StaffSession = Depends(get_current_facility_staff),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Resolve an emergency SOS alert.
    - Transitions from ('open', 'acknowledged') -> 'resolved'.
    - Guarded atomic update: WHERE status IN ('open', 'acknowledged') AND (facility_id = :staff_facility OR facility_id IS NULL)
    - If facility_id was NULL, binds facility_id = staff.facility_id.
    - Returns 409 Conflict if alert is already resolved or belongs to another facility.
    """
    try:
        alert_uuid = uuid.UUID(alert_id)
        staff_uuid = uuid.UUID(current_staff.staff_id)
        facility_uuid = uuid.UUID(current_staff.facility_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format.",
        )

    now_utc = datetime.now(timezone.utc)
    notes = req.notes if req and req.notes else "Emergency resolved by facility team"

    async with pool.acquire() as conn:
        updated_row = await conn.fetchrow(
            """
            UPDATE sos_alerts
            SET status = 'resolved',
                facility_id = $1,
                resolved_at = $2,
                resolution_notes = $3
            WHERE id = $4
              AND status IN ('open', 'acknowledged')
              AND (facility_id = $1 OR facility_id IS NULL)
            RETURNING id, status, facility_id, resolved_at
            """,
            facility_uuid,
            now_utc,
            notes,
            alert_uuid,
        )

        if not updated_row:
            existing = await conn.fetchrow("SELECT id, status, facility_id FROM sos_alerts WHERE id = $1", alert_uuid)
            if not existing:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"SOS alert with ID {alert_id} not found.",
                )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot resolve SOS alert: current status is '{existing['status']}' and assigned to facility '{existing['facility_id']}'.",
            )

        return SosActionResponse(
            alert_id=str(updated_row["id"]),
            status=updated_row["status"],
            facility_id=str(updated_row["facility_id"]),
            facility_name=current_staff.facility_name,
            facility_level=current_staff.facility_level,
            updated_at=updated_row["resolved_at"].isoformat(),
            message="SOS alert successfully resolved.",
        )
