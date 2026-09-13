-- Migration: 003_triage_duration_days.sql
-- Adds duration_days INTEGER to triage_records for ICMR acute fever
-- staging and presenting complaint duration tracking.
--
-- SAFE / ADDITIVE: column is nullable, no existing rows or reads break.

BEGIN;

ALTER TABLE triage_records
    ADD COLUMN IF NOT EXISTS duration_days INTEGER;

CREATE INDEX IF NOT EXISTS idx_triage_records_duration_days
    ON triage_records(duration_days);

COMMIT;
