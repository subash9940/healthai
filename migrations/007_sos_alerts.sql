-- Migration 007: Emergency SOS alerts table & indexing
-- Supports public SOS intake with nearest-facility routing and facility triage queue

BEGIN;

CREATE TABLE IF NOT EXISTS sos_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_alert_id TEXT UNIQUE NOT NULL,
    reported_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    patient_name TEXT,
    patient_phone TEXT,
    patient_village TEXT,
    patient_age DOUBLE PRECISION,
    patient_sex TEXT,
    symptoms JSONB,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
    channel TEXT NOT NULL DEFAULT 'citizen_web',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    repeat_count INT NOT NULL DEFAULT 1,
    acknowledged_by_staff_id UUID REFERENCES facility_staff(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_sos_alerts_facility_status ON sos_alerts(facility_id, status);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_received_at ON sos_alerts(received_at DESC);

COMMIT;
