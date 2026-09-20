-- Migration 005: Sync support for offline client records
-- Adds client-side ID columns and partial unique indexes for idempotency

BEGIN;

ALTER TABLE patients ADD COLUMN IF NOT EXISTS client_patient_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_client_patient_id ON patients(client_patient_id) WHERE client_patient_id IS NOT NULL;

ALTER TABLE triage_records ADD COLUMN IF NOT EXISTS client_record_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_triage_records_client_record_id ON triage_records(client_record_id) WHERE client_record_id IS NOT NULL;

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS client_ref_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_client_ref_id ON referrals(client_ref_id) WHERE client_ref_id IS NOT NULL;

COMMIT;
