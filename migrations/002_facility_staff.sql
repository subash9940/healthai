-- Migration: 002_facility_staff.sql
-- Adds facility_staff table and updated_by_staff_id column on referral_state_transitions
-- for per-user facility staff authentication and referral state transition auditing.

BEGIN;

-- 1. Create facility_staff table
CREATE TABLE IF NOT EXISTS facility_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone_or_username VARCHAR(64) UNIQUE NOT NULL,
    mpin_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('phc_staff', 'supervisor')),
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facility_staff_facility ON facility_staff(facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_staff_phone ON facility_staff(phone_or_username);

-- 2. Add updated_by_staff_id to referral_state_transitions for facility staff audit trail
ALTER TABLE referral_state_transitions
    ADD COLUMN IF NOT EXISTS updated_by_staff_id UUID
    REFERENCES facility_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_referral_state_transitions_staff
    ON referral_state_transitions(updated_by_staff_id);

COMMIT;
