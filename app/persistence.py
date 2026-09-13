"""
persistence.py — writes evaluate() output into triage_records (+ patients,
+ referrals when needed).

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

import json
import uuid
from typing import Any, Optional

import asyncpg


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

    facility_id is left NULL here — nearest/appropriate facility lookup
    by target_level + patient location is referral-routing logic that
    belongs with the state machine spec, not this insert path. Wiring
    that in is a follow-up once the routing rule is decided.
    """
    referral_row = await conn.fetchrow(
        """
        INSERT INTO referrals (triage_record_id, facility_id, created_by, state)
        VALUES ($1, NULL, $2, 'created')
        RETURNING id
        """,
        triage_record_id,
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
