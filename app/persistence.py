"""
persistence.py — writes evaluate() output into triage_records (+ patients,
+ referrals when needed) and provides batch sync persistence.

============================================================================
FIELD-NAME RECONCILIATION — COMPLETED (updated for triage_contract v3)
============================================================================
TriageRequest fields used here:
    ✅ patient_id (Optional[str] — UUID/ULID, converted to UUID for DB)
    ✅ patient_age_years, patient_sex, is_pregnant, is_postpartum
    ✅ source_tier, language, symptoms (list[str]), vitals (Vitals model)
    ✅ patient_phone (new in v3 — used for phone-based dedup)
    ✅ patient_abha_id (new in v3 — stored, dedup not yet implemented)

Fields NOT on TriageRequest (still return None via getattr):
    — patient_display_name, patient_village, asha_worker_id, facility_id

TriageResponse fields:
    ✅ All match: urgency, recommended_action, citizen_message, rule_trace,
       requires_referral, referral_target_level, triage_record_id,
       patient_id, referral_id
============================================================================
"""

from datetime import datetime, timezone
import json
import logging
import uuid
from typing import Any, Optional, List, Tuple

import asyncpg

from app.schemas.sync import (
    ClientPatientRecord,
    ClientReferralRecord,
    RecordSyncStatus,
)
from app.schemas.triage import TriageRequest, Vitals, Sex
from app.services.rules_engine import evaluate

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Adapters
# ---------------------------------------------------------------------------

def _enum_val(x: Any) -> Optional[str]:
    """Handle both plain strings and Enum members transparently."""
    if x is None:
        return None
    return x.value if hasattr(x, "value") else str(x)


def _extract_request_fields(request: Any) -> dict:
    """Extract all fields needed for patient/triage_records inserts.

    patient_id: if present, it's a UUID string — convert to uuid.UUID.
    patient_phone/abha_id: now on TriageRequest v3.
    patient_display_name/village, asha_worker_id/facility_id: still not on
    TriageRequest — getattr returns None, stored as NULL.
    """
    patient_id_str = getattr(request, "patient_id", None)
    patient_id_uuid = None
    if patient_id_str is not None:
        try:
            patient_id_uuid = uuid.UUID(patient_id_str)
        except (ValueError, AttributeError):
            # Not a valid UUID — treat as None → create/dedup new patient
            pass

    return {
        "age_years": getattr(request, "patient_age_years", None),
        "sex": _enum_val(getattr(request, "patient_sex", None)),
        "is_pregnant": getattr(request, "is_pregnant", None),
        "is_postpartum": getattr(request, "is_postpartum", False),
        "source_tier": _enum_val(getattr(request, "source_tier", None)),
        "language": _enum_val(getattr(request, "language", None)) or "mr",
        "symptoms": getattr(request, "symptoms", None),
        "vitals": getattr(request, "vitals", None),
        "phone": getattr(request, "patient_phone", None),      # now on TriageRequest v3
        "abha_id": getattr(request, "patient_abha_id", None),  # now on TriageRequest v3
        "duration_days": getattr(request, "symptom_duration_days", None), # now on TriageRequest v3 (duration staging)
        # Still not on TriageRequest — always None:
        "display_name": getattr(request, "patient_display_name", None),
        "village": getattr(request, "patient_village", None),
        "asha_worker_id": getattr(request, "asha_worker_id", None),
        "facility_id": getattr(request, "facility_id", None),
        "patient_id": patient_id_uuid,
    }


def _extract_response_fields(response: Any) -> dict:
    """All fields exist on TriageResponse v2."""
    return {
        "urgency": _enum_val(getattr(response, "urgency")),
        "recommended_action": getattr(response, "recommended_action"),
        "citizen_message": getattr(response, "citizen_message"),
        "rule_trace": getattr(response, "rule_trace"),
        "requires_referral": getattr(response, "requires_referral"),
        "referral_target_level": _enum_val(getattr(response, "referral_target_level", None)),
    }


def _to_jsonb(value: Any) -> str:
    """
    asyncpg needs JSONB params as JSON strings (or use a codec).
    Handles pydantic models, dicts, lists, or None.
    """
    if value is None:
        return json.dumps(None)
    if hasattr(value, "model_dump"):  # pydantic v2
        return json.dumps(value.model_dump(mode="json"))
    if hasattr(value, "dict"):  # pydantic v1
        return json.dumps(value.dict())
    return json.dumps(value)


def _safe_worker_uuid(worker_id_str: Optional[str]) -> Optional[uuid.UUID]:
    """D6: Validate worker UUID. Returns UUID if valid, else logs warning and returns None."""
    if not worker_id_str:
        return None
    try:
        return uuid.UUID(worker_id_str)
    except (ValueError, AttributeError):
        logger.warning(f"Invalid asha_worker_id '{worker_id_str}' — storing NULL")
        return None


def _parse_iso_datetime(dt_str: Optional[str]) -> datetime:
    """F1: Parse client ISO-8601 string into tz-aware datetime. If unparsable, fallback to now() in UTC."""
    if dt_str:
        try:
            dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except (ValueError, AttributeError) as e:
            logger.warning(f"Failed to parse datetime '{dt_str}' ({e}) — falling back to now(timezone.utc)")
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Patient
# ---------------------------------------------------------------------------

async def get_or_create_patient(conn: asyncpg.Connection, fields: dict) -> uuid.UUID:
    """
    Patient resolution order:
    1. If patient_id (UUID) was supplied on the request → use it directly
       (assumes caller validated the ID exists; no extra SELECT).
    2. If patient_phone was supplied → look up existing patient by phone.
       If found: return that patient's ID (no INSERT, no overwrite of existing data).
       If not found: fall through to INSERT.
    3. No identifier → INSERT new patient row.

    Merge policy: we never overwrite existing display_name/village/abha_id
    with blank values from a new request. The patient row is created once;
    updates to demographics are a separate, not-yet-specced operation.

    ABHA-based dedup is intentionally skipped for this pass — phone lookup
    only, keeping this simple for the hackathon demo.
    """
    # Priority 1: explicit patient_id
    if fields["patient_id"] is not None:
        return fields["patient_id"]

    # Priority 2: phone-based dedup
    if fields["phone"]:
        existing = await conn.fetchrow(
            "SELECT id FROM patients WHERE phone = $1 LIMIT 1",
            fields["phone"],
        )
        if existing:
            return existing["id"]

    # Priority 3: insert new patient
    row = await conn.fetchrow(
        """
        INSERT INTO patients (display_name, age_years, sex, village, phone, abha_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        """,
        fields["display_name"],
        fields["age_years"],
        fields["sex"],
        fields["village"],
        fields["phone"],
        fields["abha_id"],
    )
    return row["id"]


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def save_triage(
    pool: asyncpg.Pool,
    request: Any,
    response: Any,
) -> dict:
    """
    Persists one evaluate() call: patient (if needed) + triage_records row,
    and a referrals row (+ initial state_transitions row) if the response
    says a referral is required.

    Returns:
        {
            "triage_record_id": UUID,
            "patient_id": UUID,
            "referral_id": UUID | None,
        }
    """
    req = _extract_request_fields(request)
    resp = _extract_response_fields(response)

    async with pool.acquire() as conn:
        async with conn.transaction():
            patient_id = await get_or_create_patient(conn, req)

            triage_row = await conn.fetchrow(
                """
                INSERT INTO triage_records (
                    patient_id, source_tier, language, symptoms, vitals,
                    is_pregnant, is_postpartum, urgency, recommended_action,
                    citizen_message, rule_trace, requires_referral,
                    referral_target_level, duration_days
                )
                VALUES (
                    $1, $2, $3, $4::jsonb, $5::jsonb,
                    $6, $7, $8, $9,
                    $10, $11::jsonb, $12,
                    $13, $14
                )
                RETURNING id
                """,
                patient_id,
                req["source_tier"],
                req["language"],
                _to_jsonb(req["symptoms"]),
                _to_jsonb(req["vitals"]),
                req["is_pregnant"],
                req["is_postpartum"],
                resp["urgency"],
                resp["recommended_action"],
                resp["citizen_message"],
                _to_jsonb(resp["rule_trace"]),
                resp["requires_referral"],
                resp["referral_target_level"],
                req["duration_days"],
            )
            triage_record_id = triage_row["id"]

            referral_id = None
            if resp["requires_referral"]:
                referral_id = await _create_referral(
                    conn,
                    triage_record_id=triage_record_id,
                    target_level=resp["referral_target_level"],
                    created_by=req["asha_worker_id"],
                )

    return {
        "triage_record_id": triage_record_id,
        "patient_id": patient_id,
        "referral_id": referral_id,
    }



def _normalize_facility_level(level: Optional[str]) -> Optional[str]:
    """Map mobile facility level string to PostgreSQL facility_level enum."""
    if not level:
        return None
    val = str(level).lower().strip()
    if val in ("phc", "chc", "district_hospital"):
        return val
    if val in ("sdh", "dh", "hospital"):
        return "district_hospital"
    if val in ("sub_centre", "sub_center", "hsc"):
        return "phc"
    return None


def _normalize_referral_state(state: Optional[str]) -> str:
    """Map mobile referral status string to PostgreSQL referral_state enum."""
    if not state:
        return "created"
    val = str(state).lower().strip()
    if val in ("created", "in_transit", "received_at_facility", "closed", "cancelled"):
        return val
    return "created"


# Facility level hierarchy for fallback: prefer same level, then escalate upward
_LEVEL_HIERARCHY = ["phc", "chc", "district_hospital"]


async def _resolve_facility_for_level(
    conn: asyncpg.Connection, target_level: Optional[str]
) -> Optional[uuid.UUID]:
    """
    Find the best facility_id for the given referral target level.
    Tries exact match first, then escalates up the facility hierarchy,
    and finally falls back to any available facility.
    """
    normalized = _normalize_facility_level(target_level)

    # 1. Try exact level match
    if normalized:
        row = await conn.fetchrow(
            "SELECT id FROM facilities WHERE level = $1 LIMIT 1", normalized
        )
        if row:
            return row["id"]

    # 2. Try higher-level facilities in hierarchy order
    if normalized and normalized in _LEVEL_HIERARCHY:
        start_idx = _LEVEL_HIERARCHY.index(normalized) + 1
        for lvl in _LEVEL_HIERARCHY[start_idx:]:
            row = await conn.fetchrow(
                "SELECT id FROM facilities WHERE level = $1 LIMIT 1", lvl
            )
            if row:
                return row["id"]

    # 3. Fall back to any facility (highest level first)
    row = await conn.fetchrow(
        """
        SELECT id FROM facilities
        ORDER BY CASE level
            WHEN 'district_hospital' THEN 3
            WHEN 'chc' THEN 2
            WHEN 'phc' THEN 1
            ELSE 0
        END DESC
        LIMIT 1
        """
    )
    return row["id"] if row else None


async def _create_referral(
    conn: asyncpg.Connection,
    triage_record_id: uuid.UUID,
    target_level: Optional[str],
    created_by: Optional[uuid.UUID],
) -> uuid.UUID:
    """
    Creates the referral row plus its first state_transitions row
    (from_state = NULL -> to_state = 'created'), so the audit trail
    starts at referral creation, not at the first state change.

    Auto-assigns facility_id by matching target_level to facilities in DB.
    Falls back to the highest-level available facility if no exact match.
    """
    # Auto-assign facility based on target_level
    facility_id = await _resolve_facility_for_level(conn, target_level)

    referral_row = await conn.fetchrow(
        """
        INSERT INTO referrals (triage_record_id, facility_id, created_by, state)
        VALUES ($1, $2, $3, 'created')
        RETURNING id
        """,
        triage_record_id,
        facility_id,
        created_by,
    )
    referral_id = referral_row["id"]

    await conn.execute(
        """
        INSERT INTO referral_state_transitions (referral_id, from_state, to_state, changed_by, notes)
        VALUES ($1, NULL, 'created', $2, 'Referral created at triage time')
        """,
        referral_id,
        created_by,
    )

    return referral_id


# ---------------------------------------------------------------------------
# Sync Pipeline Functions (Phase 1 Sync Implementation)
# ---------------------------------------------------------------------------

async def sync_single_patient_record(
    conn: asyncpg.Connection,
    rec: ClientPatientRecord,
) -> RecordSyncStatus:
    """
    Process a single client patient record using D1-D6 rules.
    Runs inside its own savepoint.
    """
    client_pid = rec.patient.patient_id
    try:
        async with conn.transaction():
            # 1. Resolve or insert patient
            # Try to find existing patient by client_patient_id
            existing_p = await conn.fetchrow(
                "SELECT id FROM patients WHERE client_patient_id = $1 LIMIT 1",
                client_pid,
            )
            if existing_p:
                patient_db_id = existing_p["id"]
            else:
                # Upsert using partial unique index
                p_row = await conn.fetchrow(
                    """
                    INSERT INTO patients (client_patient_id, display_name, age_years, sex, village, phone, abha_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (client_patient_id) WHERE client_patient_id IS NOT NULL DO NOTHING
                    RETURNING id
                    """,
                    client_pid,
                    rec.patient.patient_display_name,
                    rec.patient.patient_age_years,
                    _enum_val(rec.patient.patient_sex),
                    rec.patient.patient_village,
                    rec.patient.mobile,
                    rec.patient.abha_id,
                )
                if p_row:
                    patient_db_id = p_row["id"]
                else:
                    existing_p2 = await conn.fetchrow(
                        "SELECT id FROM patients WHERE client_patient_id = $1 LIMIT 1",
                        client_pid,
                    )
                    patient_db_id = existing_p2["id"]

            # 2. Re-evaluate urgency using evaluate() (D4)
            triage_req = TriageRequest(
                patient_display_name=rec.patient.patient_display_name,
                patient_phone=rec.patient.mobile,
                patient_village=rec.patient.patient_village,
                patient_abha_id=rec.patient.abha_id,
                symptoms=rec.symptoms,
                patient_age_years=rec.patient.patient_age_years,
                patient_sex=rec.patient.patient_sex,
                is_pregnant=rec.patient.is_pregnant,
                is_postpartum=rec.patient.is_postpartum or False,
                vitals=rec.vitals,
                language="mr",
                source_tier="asha_app",
            )
            server_eval = evaluate(triage_req)
            server_resp = _extract_response_fields(server_eval)

            client_claimed_urgency = _enum_val(rec.triage.urgency) if rec.triage else None
            server_urgency = server_resp["urgency"]
            urgency_mismatch = (client_claimed_urgency != server_urgency) if client_claimed_urgency else False

            # 3. D3: client_record_id = f"{patient_id}:{created_at}"
            client_record_id = f"{client_pid}:{rec.created_at}"

            # F1: Parse client created_at as tz-aware ISO-8601 datetime
            created_at_dt = _parse_iso_datetime(rec.created_at)

            # 4. Insert triage_records with ON CONFLICT DO NOTHING (D2, D3)
            # Check if triage record already exists
            existing_tr = await conn.fetchrow(
                "SELECT id FROM triage_records WHERE client_record_id = $1 LIMIT 1",
                client_record_id,
            )

            if existing_tr:
                return RecordSyncStatus(
                    id=client_pid,
                    status="duplicate",
                    type="patient",
                    reason="Triage record already synchronized",
                )

            tr_row = await conn.fetchrow(
                """
                INSERT INTO triage_records (
                    patient_id, source_tier, language, symptoms, vitals,
                    is_pregnant, is_postpartum, urgency, recommended_action,
                    citizen_message, rule_trace, requires_referral,
                    referral_target_level, client_record_id,
                    client_claimed_urgency, urgency_mismatch, created_at
                )
                VALUES (
                    $1, 'asha_app', 'mr', $2::jsonb, $3::jsonb,
                    $4, $5, $6, $7,
                    $8, $9::jsonb, $10,
                    $11, $12, $13, $14, $15
                )
                ON CONFLICT (client_record_id) WHERE client_record_id IS NOT NULL DO NOTHING
                RETURNING id
                """,
                patient_db_id,
                _to_jsonb(rec.symptoms),
                _to_jsonb(rec.vitals),
                rec.patient.is_pregnant,
                rec.patient.is_postpartum or False,
                server_urgency,
                server_resp["recommended_action"],
                server_resp["citizen_message"],
                _to_jsonb(server_resp["rule_trace"]),
                server_resp["requires_referral"],
                server_resp["referral_target_level"],
                client_record_id,
                client_claimed_urgency,
                urgency_mismatch,
                created_at_dt,
            )

            if not tr_row:
                # Conflict occurred
                return RecordSyncStatus(
                    id=client_pid,
                    status="duplicate",
                    type="patient",
                    reason="Triage record already synchronized",
                )

            return RecordSyncStatus(
                id=client_pid,
                status="accepted",
                type="patient",
            )
    except Exception as e:
        logger.exception(f"Failed to sync patient record {client_pid}: {e}")
        return RecordSyncStatus(
            id=client_pid,
            status="rejected",
            type="patient",
            reason="internal error",
        )


async def sync_single_referral_record(
    conn: asyncpg.Connection,
    rec: ClientReferralRecord,
) -> RecordSyncStatus:
    """
    Process a single client referral record using D1, D2, D5, D6 rules.
    Runs inside its own savepoint.
    """
    client_ref_id = rec.referral_id
    try:
        async with conn.transaction():
            # 1. Check if already exists
            existing_ref = await conn.fetchrow(
                "SELECT id FROM referrals WHERE client_ref_id = $1 LIMIT 1",
                client_ref_id,
            )
            if existing_ref:
                return RecordSyncStatus(
                    id=client_ref_id,
                    status="duplicate",
                    type="referral",
                    reason="Referral record already synchronized",
                )

            # F2: Link the triage record = latest for that patient with created_at <= referral.created_at (fallback: latest)
            ref_created_dt = _parse_iso_datetime(rec.created_at)
            patient_row = await conn.fetchrow(
                "SELECT id FROM patients WHERE client_patient_id = $1 LIMIT 1",
                rec.patient_id,
            )
            triage_record_id = None
            if patient_row:
                tr_row = await conn.fetchrow(
                    "SELECT id FROM triage_records WHERE patient_id = $1 AND created_at <= $2 ORDER BY created_at DESC LIMIT 1",
                    patient_row["id"],
                    ref_created_dt,
                )
                if not tr_row:
                    tr_row = await conn.fetchrow(
                        "SELECT id FROM triage_records WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 1",
                        patient_row["id"],
                    )
                if tr_row:
                    triage_record_id = tr_row["id"]

            # If no triage record found by patient db id, try by client_record_id prefix
            if not triage_record_id:
                tr_row = await conn.fetchrow(
                    "SELECT id FROM triage_records WHERE client_record_id LIKE $1 AND created_at <= $2 ORDER BY created_at DESC LIMIT 1",
                    f"{rec.patient_id}:%",
                    ref_created_dt,
                )
                if not tr_row:
                    tr_row = await conn.fetchrow(
                        "SELECT id FROM triage_records WHERE client_record_id LIKE $1 ORDER BY created_at DESC LIMIT 1",
                        f"{rec.patient_id}:%",
                    )
                if tr_row:
                    triage_record_id = tr_row["id"]

            # F2: If none found: rejected, reason "patient record not synced yet"
            if not triage_record_id:
                return RecordSyncStatus(
                    id=client_ref_id,
                    status="rejected",
                    type="referral",
                    reason="patient record not synced yet",
                )

            # D6: Safe worker UUID
            worker_uuid = _safe_worker_uuid(rec.asha_worker_id)
            if worker_uuid:
                # Check if asha_worker exists in asha_workers table
                worker_exists = await conn.fetchrow(
                    "SELECT id FROM asha_workers WHERE id = $1",
                    worker_uuid,
                )
                if not worker_exists:
                    logger.warning(f"asha_worker_id '{worker_uuid}' not found in asha_workers table — storing NULL")
                    worker_uuid = None

            # Resolve facility_id: accept explicit facility_id if provided and valid,
            # else auto-resolve via _resolve_facility_for_level by target_facility level
            facility_uuid = None
            if getattr(rec, "facility_id", None):
                try:
                    facility_uuid = uuid.UUID(str(rec.facility_id))
                except (ValueError, TypeError):
                    facility_uuid = None

            if facility_uuid is None:
                target_level = getattr(rec, "target_facility", None)
                facility_uuid = await _resolve_facility_for_level(conn, target_level)

            # Insert referral record
            ref_row = await conn.fetchrow(
                """
                INSERT INTO referrals (
                    triage_record_id, facility_id, created_by, created_by_role,
                    state, client_ref_id
                )
                VALUES ($1, $2, $3, 'asha', 'created', $4)
                ON CONFLICT (client_ref_id) WHERE client_ref_id IS NOT NULL DO NOTHING
                RETURNING id
                """,
                triage_record_id,
                facility_uuid,
                worker_uuid,
                client_ref_id,
            )

            if not ref_row:
                return RecordSyncStatus(
                    id=client_ref_id,
                    status="duplicate",
                    type="referral",
                    reason="Referral record already synchronized",
                )

            referral_id = ref_row["id"]

            # Insert initial state transition
            await conn.execute(
                """
                INSERT INTO referral_state_transitions (
                    referral_id, from_state, to_state, changed_by, notes
                )
                VALUES ($1, NULL, 'created', $2, 'Referral synced from ASHA mobile client')
                """,
                referral_id,
                worker_uuid,
            )

            return RecordSyncStatus(
                id=client_ref_id,
                status="accepted",
                type="referral",
            )
    except Exception as e:
        logger.exception(f"Failed to sync referral record {client_ref_id}: {e}")
        return RecordSyncStatus(
            id=client_ref_id,
            status="rejected",
            type="referral",
            reason="internal error",
        )


async def process_sync_batch(
    pool: asyncpg.Pool,
    patients: List[ClientPatientRecord],
    referrals: List[ClientReferralRecord],
) -> Tuple[List[RecordSyncStatus], int, bool]:
    """
    Process all patient and referral records in independent savepoints (D8).
    Returns (record_statuses, accepted_or_duplicate_count, overall_success).
    """
    statuses: List[RecordSyncStatus] = []
    async with pool.acquire() as conn:
        # Process patients
        for p in patients:
            st = await sync_single_patient_record(conn, p)
            statuses.append(st)

        # Process referrals
        for r in referrals:
            st = await sync_single_referral_record(conn, r)
            statuses.append(st)

    has_rejections = any(s.status == "rejected" for s in statuses)
    overall_success = not has_rejections
    synced_count = sum(1 for s in statuses if s.status in ("accepted", "duplicate"))

    return statuses, synced_count, overall_success
