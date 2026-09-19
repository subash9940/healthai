-- 005_sync_idempotency.sql
-- Adds client tracking identifiers and urgency mismatch tracking for offline sync idempotency.
-- Idempotent: every statement uses IF NOT EXISTS or guarded DO $$ blocks.

BEGIN;

-- 1. Client-generated patient ID for deduplication across offline sync attempts
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS client_patient_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_client_patient_id
  ON public.patients (client_patient_id)
  WHERE client_patient_id IS NOT NULL;

-- 2. Client-generated record ID, client-claimed urgency, and urgency mismatch flag on triage records
ALTER TABLE public.triage_records
  ADD COLUMN IF NOT EXISTS client_record_id text,
  ADD COLUMN IF NOT EXISTS client_claimed_urgency public.urgency_level,
  ADD COLUMN IF NOT EXISTS urgency_mismatch boolean DEFAULT false NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_triage_records_client_record_id
  ON public.triage_records (client_record_id)
  WHERE client_record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_triage_records_urgency_mismatch
  ON public.triage_records (urgency_mismatch)
  WHERE urgency_mismatch = true;

-- 3. Client-generated referral ID for referral deduplication
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS client_ref_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_client_ref_id
  ON public.referrals (client_ref_id)
  WHERE client_ref_id IS NOT NULL;

COMMIT;
