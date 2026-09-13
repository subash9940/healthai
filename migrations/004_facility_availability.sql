-- Migration: 004_facility_availability.sql
-- Adds operational availability status, bed capacity, and status notes to facilities table.

BEGIN;

ALTER TABLE facilities
    ADD COLUMN IF NOT EXISTS operational_status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE'
        CHECK (operational_status IN ('AVAILABLE', 'BUSY', 'EMERGENCY_ONLY', 'FULL')),
    ADD COLUMN IF NOT EXISTS available_beds INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS status_note TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_by_staff_id UUID REFERENCES facility_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_facilities_operational_status ON facilities(operational_status);

COMMIT;
