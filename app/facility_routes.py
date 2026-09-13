import uuid
import json
from typing import List, Optional
from datetime import datetime, timezone
import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from app.db import get_pool
from app.models.referral import ReferralState, can_transition
from app.schemas.facility import (
    FacilityLoginRequest,
    FacilityRegisterRequest,
    FacilityLoginResponse,
    FacilityStaffInfo,
    FacilityPublicItem,
    ReferralItemResponse,
    ReferralTransitionResponse,
    TransitionReferralRequest,
    FacilityStatusResponse,
    UpdateFacilityStatusRequest,
)
from app.services.auth import (
    get_current_facility_staff,
    StaffSession,
    hash_mpin,
    verify_mpin,
    create_access_token,
)

router = APIRouter(prefix="/facility", tags=["facility"])


@router.get("/list", response_model=List[FacilityPublicItem])
async def list_public_facilities(
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    List all healthcare facilities for registration dropdowns.
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, name, level
            FROM facilities
            ORDER BY name ASC
            """
        )
    return [
        FacilityPublicItem(
            id=str(row["id"]),
            name=str(row["name"]),
            level=str(row["level"]),
            district="Pune",
        )
        for row in rows
    ]


@router.post("/register", response_model=FacilityLoginResponse)
async def facility_register(
    req: FacilityRegisterRequest,
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Register a new facility staff member (Medical Officer, Staff Nurse, Health Worker).
    Returns signed JWT session token scoped to their facility.
    """
    clean_name = req.name.strip()
    clean_identifier = req.phone_or_username.strip()
    clean_mpin = req.mpin.strip()
    clean_role = req.role.strip() or "medical_officer"

    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Staff name is required.",
        )

    if not clean_identifier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number or username is required.",
        )

    if len(clean_mpin) != 4 or not clean_mpin.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MPIN must be exactly 4 numeric digits.",
        )

    try:
        facility_uuid = uuid.UUID(req.facility_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid facility ID selected.",
        )

    hashed_pin = hash_mpin(clean_mpin)

    async with pool.acquire() as conn:
        # 1. Verify facility exists
        fac_row = await conn.fetchrow(
            "SELECT id, name, level FROM facilities WHERE id = $1",
            facility_uuid,
        )
        if not fac_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected facility does not exist.",
            )

        # 2. Check if username/phone already registered
        existing = await conn.fetchrow(
            "SELECT id FROM facility_staff WHERE phone_or_username = $1",
            clean_identifier,
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A staff member with this phone/username is already registered. Please sign in.",
            )

        # 3. Insert new staff
        staff_row = await conn.fetchrow(
            """
            INSERT INTO facility_staff (name, phone_or_username, mpin_hash, role, facility_id, active)
            VALUES ($1, $2, $3, $4, $5, true)
            RETURNING id, name, phone_or_username, role, facility_id, active
            """,
            clean_name,
            clean_identifier,
            hashed_pin,
            clean_role,
            facility_uuid,
        )

    staff_id_str = str(staff_row["id"])
    facility_id_str = str(fac_row["id"])

    token_payload = {
        "sub": staff_id_str,
        "facility_id": facility_id_str,
        "role": staff_row["role"],
        "name": staff_row["name"],
    }
    access_token = create_access_token(token_payload)

    return FacilityLoginResponse(
        access_token=access_token,
        token_type="bearer",
        staff=FacilityStaffInfo(
            id=staff_id_str,
            name=staff_row["name"],
            phone_or_username=staff_row["phone_or_username"],
            role=staff_row["role"],
            facility_id=facility_id_str,
            facility_name=fac_row["name"],
            facility_level=fac_row["level"],
        ),
    )


@router.post("/login", response_model=FacilityLoginResponse)
async def facility_login(
    req: FacilityLoginRequest,
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Authenticate facility staff using phone_or_username and MPIN.
    Returns signed JWT session token scoped to their facility.
    """
    clean_identifier = req.phone_or_username.strip()
    clean_mpin = req.mpin.strip()

    async with pool.acquire() as conn:
        staff_row = await conn.fetchrow(
            """
            SELECT
                fs.id,
                fs.name,
                fs.phone_or_username,
                fs.mpin_hash,
                fs.role,
                fs.facility_id,
                fs.active,
                f.name AS facility_name,
                f.level AS facility_level
            FROM facility_staff fs
            LEFT JOIN facilities f ON fs.facility_id = f.id
            WHERE fs.phone_or_username = $1
            """,
            clean_identifier,
        )

    if not staff_row or not verify_mpin(clean_mpin, staff_row["mpin_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone/username or MPIN.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not staff_row["active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Facility staff account has been deactivated.",
        )

    staff_id_str = str(staff_row["id"])
    facility_id_str = str(staff_row["facility_id"])

    token_payload = {
        "sub": staff_id_str,
        "facility_id": facility_id_str,
        "role": staff_row["role"],
        "name": staff_row["name"],
    }
    access_token = create_access_token(token_payload)

    return FacilityLoginResponse(
        access_token=access_token,
        token_type="bearer",
        staff=FacilityStaffInfo(
            id=staff_id_str,
            name=staff_row["name"],
            phone_or_username=staff_row["phone_or_username"],
            role=staff_row["role"],
            facility_id=facility_id_str,
            facility_name=staff_row["facility_name"],
            facility_level=staff_row["facility_level"],
        ),
    )


@router.get("/me", response_model=FacilityStaffInfo)
async def get_current_user_profile(
    current_staff: StaffSession = Depends(get_current_facility_staff),
):
    """Return the profile of currently authenticated staff member."""
    return FacilityStaffInfo(
        id=current_staff.staff_id,
        name=current_staff.name,
        phone_or_username=current_staff.phone_or_username,
        role=current_staff.role,
        facility_id=current_staff.facility_id,
        facility_name=current_staff.facility_name,
        facility_level=current_staff.facility_level,
    )


@router.get("/referrals", response_model=List[ReferralItemResponse])
async def list_facility_referrals(
    urgency: Optional[str] = None,
    state: Optional[str] = None,
    current_staff: StaffSession = Depends(get_current_facility_staff),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    List all referrals for the authenticated staff member's facility.
    CRITICAL: Strictly filtered server-side by session's facility_id.
    """
    facility_uuid = uuid.UUID(current_staff.facility_id)

    query = """
        SELECT
            r.id AS referral_id,
            r.triage_record_id,
            r.facility_id,
            f.name AS facility_name,
            f.level AS facility_level,
            r.created_by_role,
            r.state,
            r.created_at,
            r.updated_at,
            p.id AS patient_id,
            p.display_name AS patient_name,
            p.phone AS patient_phone,
            p.age_years AS patient_age_years,
            p.sex AS patient_sex,
            p.village AS patient_village,
            tr.urgency,
            tr.symptoms,
            tr.vitals,
            tr.recommended_action,
            tr.citizen_message,
            tr.rule_trace,
            tr.requires_referral,
            tr.referral_target_level
        FROM referrals r
        JOIN triage_records tr ON r.triage_record_id = tr.id
        LEFT JOIN patients p ON tr.patient_id = p.id
        LEFT JOIN facilities f ON r.facility_id = f.id
        WHERE r.facility_id = $1
    """
    params = [facility_uuid]

    if urgency:
        params.append(urgency.lower())
        query += f" AND tr.urgency = ${len(params)}"

    if state:
        params.append(state.lower())
        query += f" AND r.state = ${len(params)}"

    query += " ORDER BY r.created_at DESC"

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)

    results: List[ReferralItemResponse] = []
    for row in rows:
        # Extract primary rule name from rule_trace
        rule_trace_raw = row["rule_trace"]
        rule_name = "TRIAGE_RULE_MATCH"
        if isinstance(rule_trace_raw, list) and len(rule_trace_raw) > 0:
            rule_name = str(rule_trace_raw[0])
        elif isinstance(rule_trace_raw, str):
            try:
                parsed = json.loads(rule_trace_raw)
                if isinstance(parsed, list) and len(parsed) > 0:
                    rule_name = str(parsed[0])
            except Exception:
                pass

        # Parse symptoms
        symptoms_raw = row["symptoms"]
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

        # Parse vitals
        vitals_raw = row["vitals"]
        vitals_dict = None
        if isinstance(vitals_raw, dict):
            vitals_dict = vitals_raw
        elif isinstance(vitals_raw, str):
            try:
                vitals_dict = json.loads(vitals_raw)
            except Exception:
                pass

        results.append(
            ReferralItemResponse(
                id=str(row["referral_id"]),
                triage_record_id=str(row["triage_record_id"]),
                facility_id=str(row["facility_id"]) if row["facility_id"] else None,
                facility_name=row["facility_name"] or current_staff.facility_name,
                facility_level=row["facility_level"] or current_staff.facility_level,
                created_by_role=row["created_by_role"],
                state=str(row["state"]),
                created_at=row["created_at"].isoformat() if row["created_at"] else datetime.now(timezone.utc).isoformat(),
                updated_at=row["updated_at"].isoformat() if row["updated_at"] else datetime.now(timezone.utc).isoformat(),
                patient_id=str(row["patient_id"]) if row["patient_id"] else None,
                patient_name=row["patient_name"] or "Citizen Patient",
                patient_phone=row["patient_phone"] or "N/A",
                patient_age_years=row["patient_age_years"],
                patient_sex=row["patient_sex"],
                patient_village=row["patient_village"],
                urgency=str(row["urgency"]).upper(),
                rule_name=rule_name,
                symptoms=symptoms_list,
                vitals=vitals_dict,
                recommended_action=row["recommended_action"],
                citizen_message=row["citizen_message"],
                requires_referral=bool(row["requires_referral"]),
                referral_target_level=str(row["referral_target_level"]) if row["referral_target_level"] else None,
            )
        )

    return results


@router.post("/referrals/{referral_id}/receive", response_model=ReferralTransitionResponse)
async def mark_referral_received(
    referral_id: str,
    req: Optional[TransitionReferralRequest] = None,
    current_staff: StaffSession = Depends(get_current_facility_staff),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Action: Mark Referral Received at Facility (in_transit -> received_at_facility).
    - Validates referral exists
    - Enforces server-side facility isolation: referral.facility_id == session.facility_id
    - Validates legal transition from current state
    - Audits change in referral_state_transitions with updated_by_staff_id
    """
    try:
        ref_uuid = uuid.UUID(referral_id)
        staff_uuid = uuid.UUID(current_staff.staff_id)
        facility_uuid = uuid.UUID(current_staff.facility_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid referral ID format.",
        )

    notes = req.notes if req and req.notes else "Patient arrived and was received at facility by staff"

    async with pool.acquire() as conn:
        async with conn.transaction():
            referral = await conn.fetchrow(
                "SELECT id, facility_id, state FROM referrals WHERE id = $1 FOR UPDATE",
                ref_uuid,
            )

            if not referral:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Referral with ID {referral_id} not found.",
                )

            # Strict server-side facility isolation
            if str(referral["facility_id"]) != current_staff.facility_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cross-facility isolation: You do not have permission to access or update referrals belonging to other facilities.",
                )

            current_state_str = str(referral["state"])
            try:
                current_state_enum = ReferralState(current_state_str)
            except ValueError:
                current_state_enum = None

            target_state_enum = ReferralState.RECEIVED_AT_FACILITY

            if not current_state_enum or not can_transition(current_state_enum, target_state_enum):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot mark received: illegal transition from '{current_state_str}' to '{target_state_enum.value}'. Expected current state to be 'in_transit'.",
                )

            # Update referral state
            now_ts = datetime.now(timezone.utc)
            await conn.execute(
                """
                UPDATE referrals
                SET state = $1, updated_at = $2
                WHERE id = $3
                """,
                target_state_enum.value,
                now_ts,
                ref_uuid,
            )

            # Insert audit transition log
            await conn.execute(
                """
                INSERT INTO referral_state_transitions (
                    referral_id, from_state, to_state, updated_by_staff_id, changed_at, notes
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                ref_uuid,
                current_state_enum.value,
                target_state_enum.value,
                staff_uuid,
                now_ts,
                notes,
            )

    return ReferralTransitionResponse(
        referral_id=referral_id,
        previous_state=current_state_str,
        new_state=ReferralState.RECEIVED_AT_FACILITY.value,
        updated_by_staff_id=current_staff.staff_id,
        updated_at=now_ts.isoformat(),
        message="Referral successfully marked as received at facility.",
    )


@router.post("/referrals/{referral_id}/close", response_model=ReferralTransitionResponse)
async def close_referral(
    referral_id: str,
    req: Optional[TransitionReferralRequest] = None,
    current_staff: StaffSession = Depends(get_current_facility_staff),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Action: Close Referral (received_at_facility -> closed).
    - Validates referral exists
    - Enforces server-side facility isolation: referral.facility_id == session.facility_id
    - Validates legal transition from current state
    - Audits change in referral_state_transitions with updated_by_staff_id
    """
    try:
        ref_uuid = uuid.UUID(referral_id)
        staff_uuid = uuid.UUID(current_staff.staff_id)
        facility_uuid = uuid.UUID(current_staff.facility_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid referral ID format.",
        )

    notes = req.notes if req and req.notes else "Referral care completed and closed by facility staff"

    async with pool.acquire() as conn:
        async with conn.transaction():
            referral = await conn.fetchrow(
                "SELECT id, facility_id, state FROM referrals WHERE id = $1 FOR UPDATE",
                ref_uuid,
            )

            if not referral:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Referral with ID {referral_id} not found.",
                )

            # Strict server-side facility isolation
            if str(referral["facility_id"]) != current_staff.facility_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cross-facility isolation: You do not have permission to access or update referrals belonging to other facilities.",
                )

            current_state_str = str(referral["state"])
            try:
                current_state_enum = ReferralState(current_state_str)
            except ValueError:
                current_state_enum = None

            target_state_enum = ReferralState.CLOSED

            if not current_state_enum or not can_transition(current_state_enum, target_state_enum):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot close referral: illegal transition from '{current_state_str}' to '{target_state_enum.value}'. Expected current state to be 'received_at_facility'.",
                )

            # Update referral state
            now_ts = datetime.now(timezone.utc)
            await conn.execute(
                """
                UPDATE referrals
                SET state = $1, updated_at = $2
                WHERE id = $3
                """,
                target_state_enum.value,
                now_ts,
                ref_uuid,
            )

            # Insert audit transition log
            await conn.execute(
                """
                INSERT INTO referral_state_transitions (
                    referral_id, from_state, to_state, updated_by_staff_id, changed_at, notes
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                ref_uuid,
                current_state_enum.value,
                target_state_enum.value,
                staff_uuid,
                now_ts,
                notes,
            )

    return ReferralTransitionResponse(
        referral_id=referral_id,
        previous_state=current_state_str,
        new_state=ReferralState.CLOSED.value,
        updated_by_staff_id=current_staff.staff_id,
        updated_at=now_ts.isoformat(),
        message="Referral successfully closed.",
    )


@router.get("/status", response_model=FacilityStatusResponse)
async def get_facility_status(
    current_staff: StaffSession = Depends(get_current_facility_staff),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Get the operational status, bed capacity, and status note for the authenticated staff's facility.
    """
    try:
        facility_uuid = uuid.UUID(current_staff.facility_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid facility ID in session token.",
        )

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT f.id, f.name, f.level, f.operational_status, f.available_beds, f.status_note,
                   f.updated_at, f.updated_by_staff_id, fs.name AS updated_by_staff_name
            FROM facilities f
            LEFT JOIN facility_staff fs ON f.updated_by_staff_id = fs.id
            WHERE f.id = $1
            """,
            facility_uuid,
        )

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Facility not found.",
            )

        return FacilityStatusResponse(
            facility_id=str(row["id"]),
            facility_name=str(row["name"]),
            facility_level=str(row["level"]),
            operational_status=str(row["operational_status"] or "AVAILABLE"),
            available_beds=int(row["available_beds"] if row["available_beds"] is not None else 10),
            status_note=row["status_note"],
            updated_at=row["updated_at"].isoformat() if row["updated_at"] else None,
            updated_by_staff_id=str(row["updated_by_staff_id"]) if row["updated_by_staff_id"] else None,
            updated_by_staff_name=row["updated_by_staff_name"],
        )


@router.patch("/status", response_model=FacilityStatusResponse)
async def update_facility_status(
    req: UpdateFacilityStatusRequest,
    current_staff: StaffSession = Depends(get_current_facility_staff),
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Update operational status, available beds, or broadcast status note for authenticated staff's facility.
    """
    try:
        facility_uuid = uuid.UUID(current_staff.facility_id)
        staff_uuid = uuid.UUID(current_staff.staff_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID in session token.",
        )

    # Validate inputs
    valid_statuses = {"AVAILABLE", "BUSY", "EMERGENCY_ONLY", "FULL"}
    if req.operational_status is not None and req.operational_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid operational_status: '{req.operational_status}'. Must be one of: {sorted(valid_statuses)}.",
        )

    if req.available_beds is not None and req.available_beds < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="available_beds must be a non-negative integer.",
        )

    now_ts = datetime.now(timezone.utc)

    async with pool.acquire() as conn:
        # Check facility exists
        current_facility = await conn.fetchrow(
            "SELECT id, name, level, operational_status, available_beds, status_note FROM facilities WHERE id = $1",
            facility_uuid,
        )
        if not current_facility:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Facility not found.",
            )

        new_status = req.operational_status if req.operational_status is not None else current_facility["operational_status"]
        new_beds = req.available_beds if req.available_beds is not None else current_facility["available_beds"]
        new_note = req.status_note if req.status_note is not None else current_facility["status_note"]

        await conn.execute(
            """
            UPDATE facilities
            SET operational_status = $1,
                available_beds = $2,
                status_note = $3,
                updated_at = $4,
                updated_by_staff_id = $5
            WHERE id = $6
            """,
            new_status,
            new_beds,
            new_note,
            now_ts,
            staff_uuid,
            facility_uuid,
        )

        return FacilityStatusResponse(
            facility_id=str(current_facility["id"]),
            facility_name=str(current_facility["name"]),
            facility_level=str(current_facility["level"]),
            operational_status=new_status,
            available_beds=new_beds,
            status_note=new_note,
            updated_at=now_ts.isoformat(),
            updated_by_staff_id=current_staff.staff_id,
            updated_by_staff_name=current_staff.name,
        )

