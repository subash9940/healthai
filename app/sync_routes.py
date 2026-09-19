"""
app/sync_routes.py

Synchronization endpoints for Swasthya Setu / Jeevanya.
Handles client health check and batch offline sync with idempotency,
server-authoritative clinical triage, and urgency mismatch tracking.
"""

import json
import logging
import uuid
from typing import Any, Optional

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.db import get_pool
from app.schemas.sync import (
    SyncPayload,
    SyncResponse,
    SyncedPatientItem,
    SyncedReferralItem,
    UnconfirmedReferralItem,
    SyncErrorItem,
)
from app.schemas.triage import TriageRequest, Urgency, Sex
from app.services.rules_engine import evaluate

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sync"])


def _to_jsonb(value: Any) -> str:
    """Helper to convert values to JSON string for asyncpg JSONB parameters."""
    if value is None:
        return json.dumps(None)
    if hasattr(value, "model_dump"):
        return json.dumps(value.model_dump(mode="json"))
    if hasattr(value, "dict"):
        return json.dumps(value.dict())
    return json.dumps(value)


@router.get("/health")
async def health(pool: asyncpg.Pool = Depends(get_pool)):
    """Active healthcheck with database probe."""
    try:
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "ok", "db": "ok"}
    except Exception as e:
        logger.warning("Database health probe failed: %s", e)
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "db": "down"},
        )


@router.post("/sync", response_model=SyncResponse)
async def sync_records(
    payload: SyncPayload,
    pool: asyncpg.Pool = Depends(get_pool),
):
    """
    Synchronizes offline client records with server-authoritative persistence.

    Guarantees:
    1. Idempotency: Uses client_record_id, client_patient_id, client_ref_id.
    2. Server-Authoritative: Re-runs clinical rules engine; flags mismatches.
    3. Resilience: Per-record transactions prevent whole-batch failure.
    """
    synced_patients: list[SyncedPatientItem] = []
    synced_referrals: list[SyncedReferralItem] = []
    unconfirmed_referrals: list[UnconfirmedReferralItem] = []
    errors: list[SyncErrorItem] = []
    mismatches_count = 0

    # Map client referral IDs by client patient ID for linking if available
    client_ref_map: dict[str, str] = {}
    if payload.referrals:
        for ref in payload.referrals:
            if ref.patient_id and ref.referral_id:
                client_ref_map[ref.patient_id] = ref.referral_id

    async with pool.acquire() as conn:
        # 1. Process Patient Records
        for record in payload.patients:
            client_rec_id = record.record_id
            client_pat_id = record.patient.patient_id

            if not client_rec_id or not client_rec_id.strip():
                errors.append(
                    SyncErrorItem(
                        client_record_id=client_rec_id,
                        client_patient_id=client_pat_id,
                        error="missing record_id",
                    )
                )
                continue

            try:
                # Per-record transaction
                async with conn.transaction():
                    # Check Idempotency for triage record
                    if client_rec_id:
                        existing_rec = await conn.fetchrow(
                            """
                            SELECT t.id as triage_id, t.patient_id, t.urgency, t.urgency_mismatch,
                                   r.id as referral_id
                            FROM triage_records t
                            LEFT JOIN referrals r ON r.triage_record_id = t.id
                            WHERE t.client_record_id = $1
                            LIMIT 1
                            """,
                            client_rec_id,
                        )
                        if existing_rec:
                            server_urgency_val = existing_rec["urgency"]
                            client_urgency_val = record.triage.urgency.value
                            is_mismatch = bool(existing_rec["urgency_mismatch"])
                            if is_mismatch:
                                mismatches_count += 1

                            synced_patients.append(
                                SyncedPatientItem(
                                    client_record_id=client_rec_id,
                                    client_patient_id=client_pat_id,
                                    triage_record_id=str(existing_rec["triage_id"]),
                                    patient_id=str(existing_rec["patient_id"]),
                                    referral_id=str(existing_rec["referral_id"]) if existing_rec["referral_id"] else None,
                                    server_urgency=Urgency(server_urgency_val),
                                    client_urgency=record.triage.urgency,
                                    urgency_mismatch=is_mismatch,
                                )
                            )
                            continue

                    # Server-Authoritative Triage Evaluation
                    triage_req = TriageRequest(
                        patient_display_name=record.patient.patient_display_name,
                        patient_phone=record.patient.mobile,
                        patient_village=record.patient.patient_village,
                        patient_abha_id=record.patient.abha_id,
                        symptoms=record.symptoms,
                        patient_age_years=record.patient.patient_age_years,
                        patient_sex=record.patient.patient_sex,
                        is_pregnant=record.patient.is_pregnant,
                        is_postpartum=record.patient.is_postpartum,
                        vitals=record.vitals,
                        symptom_duration_days=record.symptom_duration_days,
                        language=record.language or "en",
                        source_tier="asha_app",
                    )
                    server_eval = evaluate(triage_req)

                    client_urgency_val = record.triage.urgency.value.lower()
                    server_urgency_val = server_eval.urgency.value.lower()
                    urgency_mismatch = (client_urgency_val != server_urgency_val)

                    if urgency_mismatch:
                        mismatches_count += 1
                        logger.warning(
                            "Triage urgency mismatch for client_record_id=%s: client claimed '%s', server evaluated '%s'",
                            client_rec_id,
                            client_urgency_val,
                            server_urgency_val,
                        )

                    # Patient Resolution (client_patient_id -> phone+name+sex -> new insert)
                    db_patient_id: Optional[uuid.UUID] = None

                    # 1. Look up by client_patient_id
                    if client_pat_id:
                        pat_row = await conn.fetchrow(
                            "SELECT id FROM patients WHERE client_patient_id = $1 LIMIT 1",
                            client_pat_id,
                        )
                        if pat_row:
                            db_patient_id = pat_row["id"]

                    # 2. Look up by phone if not found, requiring matching normalized display_name and sex
                    if not db_patient_id and record.patient.mobile:
                        norm_name = (
                            record.patient.patient_display_name.strip().lower()
                            if record.patient.patient_display_name
                            else None
                        )
                        if norm_name:
                            pat_row = await conn.fetchrow(
                                """
                                SELECT id FROM patients
                                WHERE phone = $1
                                  AND LOWER(TRIM(display_name)) = $2
                                  AND sex = $3
                                LIMIT 1
                                """,
                                record.patient.mobile,
                                norm_name,
                                record.patient.patient_sex.value,
                            )
                            if pat_row:
                                db_patient_id = pat_row["id"]
                                # Associate client_patient_id if not set
                                if client_pat_id:
                                    await conn.execute(
                                        "UPDATE patients SET client_patient_id = $1 WHERE id = $2 AND client_patient_id IS NULL",
                                        client_pat_id,
                                        db_patient_id,
                                    )

                    # 3. Insert new patient if still not resolved
                    if not db_patient_id:
                        new_pat_row = await conn.fetchrow(
                            """
                            INSERT INTO patients (
                                display_name, age_years, sex, village, phone, abha_id, client_patient_id
                            )
                            VALUES ($1, $2, $3, $4, $5, $6, $7)
                            RETURNING id
                            """,
                            record.patient.patient_display_name,
                            record.patient.patient_age_years,
                            record.patient.patient_sex.value,
                            record.patient.patient_village,
                            record.patient.mobile,
                            record.patient.abha_id,
                            client_pat_id,
                        )
                        db_patient_id = new_pat_row["id"]

                    # Insert Triage Record
                    triage_row = await conn.fetchrow(
                        """
                        INSERT INTO triage_records (
                            patient_id, source_tier, language, symptoms, vitals,
                            is_pregnant, is_postpartum, urgency, recommended_action,
                            citizen_message, rule_trace, requires_referral,
                            referral_target_level, duration_days,
                            client_record_id, client_claimed_urgency, urgency_mismatch
                        )
                        VALUES (
                            $1, $2, $3, $4::jsonb, $5::jsonb,
                            $6, $7, $8, $9,
                            $10, $11::jsonb, $12,
                            $13, $14,
                            $15, $16, $17
                        )
                        RETURNING id
                        """,
                        db_patient_id,
                        "asha_app",
                        record.language or "en",
                        _to_jsonb(record.symptoms),
                        _to_jsonb(record.vitals),
                        record.patient.is_pregnant,
                        record.patient.is_postpartum,
                        server_eval.urgency.value,
                        server_eval.recommended_action,
                        server_eval.citizen_message,
                        _to_jsonb(server_eval.rule_trace),
                        server_eval.requires_referral,
                        server_eval.referral_target_level,
                        record.symptom_duration_days,
                        client_rec_id,
                        record.triage.urgency.value,
                        urgency_mismatch,
                    )
                    db_triage_id = triage_row["id"]

                    # Referral creation if server evaluation requires referral
                    db_referral_id: Optional[uuid.UUID] = None
                    if server_eval.requires_referral:
                        client_ref_id = client_ref_map.get(client_pat_id)

                        # Check if client_ref_id already exists
                        if client_ref_id:
                            existing_ref = await conn.fetchrow(
                                "SELECT id FROM referrals WHERE client_ref_id = $1 LIMIT 1",
                                client_ref_id,
                            )
                            if existing_ref:
                                db_referral_id = existing_ref["id"]

                        if not db_referral_id:
                            ref_row = await conn.fetchrow(
                                """
                                INSERT INTO referrals (
                                    triage_record_id, facility_id, created_by, state, client_ref_id
                                )
                                VALUES ($1, NULL, NULL, 'created', $2)
                                RETURNING id
                                """,
                                db_triage_id,
                                client_ref_id,
                            )
                            db_referral_id = ref_row["id"]

                            await conn.execute(
                                """
                                INSERT INTO referral_state_transitions (
                                    referral_id, from_state, to_state, changed_by, notes
                                )
                                VALUES ($1, NULL, 'created', NULL, 'Referral created via offline sync')
                                """,
                                db_referral_id,
                            )

                    synced_patients.append(
                        SyncedPatientItem(
                            client_record_id=client_rec_id,
                            client_patient_id=client_pat_id,
                            triage_record_id=str(db_triage_id),
                            patient_id=str(db_patient_id),
                            referral_id=str(db_referral_id) if db_referral_id else None,
                            server_urgency=server_eval.urgency,
                            client_urgency=record.triage.urgency,
                            urgency_mismatch=urgency_mismatch,
                        )
                    )

            except Exception as e:
                logger.exception("Failed to sync patient record client_rec_id=%s: %s", client_rec_id, str(e))
                errors.append(
                    SyncErrorItem(
                        client_record_id=client_rec_id,
                        client_patient_id=client_pat_id,
                        error=str(e),
                    )
                )

        # 2. Process Standalone Referrals (if any referral updates are sent directly)
        if payload.referrals:
            for ref in payload.referrals:
                if ref.is_demo or (ref.referral_id and ref.referral_id.startswith("REF-DEMO")):
                    continue  # skip mock/demo records

                client_ref_id = ref.referral_id
                try:
                    # Check if already synced
                    existing_ref = await conn.fetchrow(
                        "SELECT id, state FROM referrals WHERE client_ref_id = $1 LIMIT 1",
                        client_ref_id,
                    )
                    if existing_ref:
                        synced_referrals.append(
                            SyncedReferralItem(
                                client_ref_id=client_ref_id,
                                referral_id=str(existing_ref["id"]),
                                status=str(existing_ref["state"]),
                            )
                        )
                    else:
                        unconfirmed_referrals.append(
                            UnconfirmedReferralItem(
                                client_ref_id=client_ref_id,
                                reason=f"Referral {client_ref_id} not found in database",
                            )
                        )
                except Exception as e:
                    logger.exception("Failed to check referral client_ref_id=%s: %s", client_ref_id, str(e))
                    errors.append(
                        SyncErrorItem(
                            client_record_id=None,
                            client_patient_id=ref.patient_id,
                            error=f"Error checking referral {client_ref_id}: {str(e)}",
                        )
                    )

    return SyncResponse(
        success=len(errors) == 0,
        synced_patients=synced_patients,
        synced_referrals=synced_referrals,
        unconfirmed_referrals=unconfirmed_referrals,
        errors=errors,
        total_synced=len(synced_patients) + len(synced_referrals),
        total_errors=len(errors),
        mismatches_count=mismatches_count,
    )
