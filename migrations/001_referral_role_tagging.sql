-- Migration: 001_referral_role_tagging.sql
-- Adds who created a referral and where it originated, per architecture
-- decision doc section 4 ("both ASHA and PHC staff, distinguished by
-- created_by_role and origin_facility").
--
-- SAFE / ADDITIVE: both columns are nullable, no existing rows are touched,
-- no existing reads break. Does not touch triage_contract.py (the locked
-- API contract) -- this is purely a DB-layer + referral-creation-service
-- change.

BEGIN;

-- created_by_role: who initiated the referral.
-- Nullable during rollout so existing ASHA-only referral-creation code
-- doesn't break before it's updated to pass this field.
ALTER TABLE referrals
    ADD COLUMN IF NOT EXISTS created_by_role VARCHAR(16)
    CHECK (created_by_role IN ('asha', 'phc_staff') OR created_by_role IS NULL);

-- origin_facility_id: null/community for ASHA-originated referrals,
-- a real facilities.id for PHC-originated (staff referring onward from
-- their own facility). FK to your existing facilities table.
ALTER TABLE referrals
    ADD COLUMN IF NOT EXISTS origin_facility_id UUID
    REFERENCES facilities(id) ON DELETE SET NULL;

-- Backfill existing rows explicitly as 'asha' (matches current reality:
-- your referral-creation path has only ever been ASHA-initiated so far).
-- Comment out this line if that assumption is wrong for any existing data.
UPDATE referrals SET created_by_role = 'asha' WHERE created_by_role IS NULL;

CREATE INDEX IF NOT EXISTS idx_referrals_created_by_role ON referrals(created_by_role);

COMMIT;

-- Rollback (run manually if needed, NOT part of this migration):
-- ALTER TABLE referrals DROP COLUMN created_by_role;
-- ALTER TABLE referrals DROP COLUMN origin_facility_id;
