-- 000_base_schema.sql
-- Base schema for Swasthya Setu / Jeevanya — captured from pg_dump of jeevanya DB.
-- Idempotent: every object uses IF NOT EXISTS or DO $$ guards so re-runs are no-ops.

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- Enum types (guarded — CREATE TYPE has no IF NOT EXISTS)
DO $$ BEGIN
  CREATE TYPE public.facility_level AS ENUM ('phc', 'chc', 'district_hospital');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.referral_state AS ENUM ('created', 'in_transit', 'received_at_facility', 'closed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.urgency_level AS ENUM ('low', 'medium', 'high', 'emergency');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tables

CREATE TABLE IF NOT EXISTS public.patients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_name text,
    age_years numeric,
    sex text,
    village text,
    phone text,
    abha_id text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT patients_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.facilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    level public.facility_level NOT NULL,
    lat double precision,
    lng double precision,
    contact_phone text,
    operational_status character varying(32) DEFAULT 'AVAILABLE'::character varying NOT NULL,
    available_beds integer DEFAULT 10 NOT NULL,
    status_note text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by_staff_id uuid,
    CONSTRAINT facilities_pkey PRIMARY KEY (id),
    CONSTRAINT facilities_operational_status_check CHECK (((operational_status)::text = ANY ((ARRAY['AVAILABLE'::character varying, 'BUSY'::character varying, 'EMERGENCY_ONLY'::character varying, 'FULL'::character varying])::text[])))
);

CREATE TABLE IF NOT EXISTS public.facility_staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    phone_or_username character varying(64) NOT NULL,
    mpin_hash character varying(255) NOT NULL,
    role character varying(32) NOT NULL,
    facility_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT facility_staff_pkey PRIMARY KEY (id),
    CONSTRAINT facility_staff_phone_or_username_key UNIQUE (phone_or_username),
    CONSTRAINT facility_staff_role_check CHECK (((role)::text = ANY ((ARRAY['phc_staff'::character varying, 'supervisor'::character varying])::text[])))
);

CREATE TABLE IF NOT EXISTS public.asha_workers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text,
    facility_id uuid,
    CONSTRAINT asha_workers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.triage_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid,
    source_tier text NOT NULL,
    language text DEFAULT 'mr'::text NOT NULL,
    symptoms jsonb NOT NULL,
    vitals jsonb,
    is_pregnant boolean,
    is_postpartum boolean DEFAULT false,
    urgency public.urgency_level NOT NULL,
    recommended_action text NOT NULL,
    citizen_message text NOT NULL,
    rule_trace jsonb NOT NULL,
    requires_referral boolean NOT NULL,
    referral_target_level public.facility_level,
    created_at timestamp with time zone DEFAULT now(),
    duration_days integer,
    CONSTRAINT triage_records_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    triage_record_id uuid NOT NULL,
    facility_id uuid,
    created_by uuid,
    state public.referral_state DEFAULT 'created'::public.referral_state NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by_role character varying(16),
    origin_facility_id uuid,
    CONSTRAINT referrals_pkey PRIMARY KEY (id),
    CONSTRAINT referrals_created_by_role_check CHECK ((((created_by_role)::text = ANY ((ARRAY['asha'::character varying, 'phc_staff'::character varying])::text[])) OR (created_by_role IS NULL)))
);

CREATE TABLE IF NOT EXISTS public.referral_state_transitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referral_id uuid NOT NULL,
    from_state public.referral_state,
    to_state public.referral_state NOT NULL,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now(),
    notes text,
    updated_by_staff_id uuid,
    CONSTRAINT referral_state_transitions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.sos_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    latitude double precision,
    longitude double precision,
    patient_context jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sos_alerts_pkey PRIMARY KEY (id)
);

-- Indexes (IF NOT EXISTS)

CREATE INDEX IF NOT EXISTS idx_facilities_operational_status ON public.facilities USING btree (operational_status);
CREATE INDEX IF NOT EXISTS idx_facility_staff_facility ON public.facility_staff USING btree (facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_staff_phone ON public.facility_staff USING btree (phone_or_username);
CREATE INDEX IF NOT EXISTS idx_referral_state_transitions_staff ON public.referral_state_transitions USING btree (updated_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_referrals_created_by_role ON public.referrals USING btree (created_by_role);
CREATE INDEX IF NOT EXISTS idx_referrals_state ON public.referrals USING btree (state);
CREATE INDEX IF NOT EXISTS idx_referrals_triage_record ON public.referrals USING btree (triage_record_id);
CREATE INDEX IF NOT EXISTS idx_triage_patient ON public.triage_records USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_triage_records_duration_days ON public.triage_records USING btree (duration_days);
CREATE INDEX IF NOT EXISTS idx_triage_urgency_created ON public.triage_records USING btree (urgency, created_at);

-- Foreign keys (guarded — no IF NOT EXISTS for ALTER TABLE ADD CONSTRAINT)

DO $$ BEGIN
  ALTER TABLE ONLY public.asha_workers ADD CONSTRAINT asha_workers_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY public.facilities ADD CONSTRAINT facilities_updated_by_staff_id_fkey FOREIGN KEY (updated_by_staff_id) REFERENCES public.facility_staff(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY public.facility_staff ADD CONSTRAINT facility_staff_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY public.referral_state_transitions ADD CONSTRAINT referral_state_transitions_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.asha_workers(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY public.referral_state_transitions ADD CONSTRAINT referral_state_transitions_referral_id_fkey FOREIGN KEY (referral_id) REFERENCES public.referrals(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY public.referral_state_transitions ADD CONSTRAINT referral_state_transitions_updated_by_staff_id_fkey FOREIGN KEY (updated_by_staff_id) REFERENCES public.facility_staff(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY public.referrals ADD CONSTRAINT referrals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.asha_workers(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY public.referrals ADD CONSTRAINT referrals_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY public.referrals ADD CONSTRAINT referrals_origin_facility_id_fkey FOREIGN KEY (origin_facility_id) REFERENCES public.facilities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY public.referrals ADD CONSTRAINT referrals_triage_record_id_fkey FOREIGN KEY (triage_record_id) REFERENCES public.triage_records(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY public.triage_records ADD CONSTRAINT triage_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
