--
-- PostgreSQL database dump
--

\restrict rWCs7THR9uXVhx169O0PgykmhFKfje4LfybkH58phcg6NzStLMSnGrem409Uevy

-- Dumped from database version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)
-- Dumped by pg_dump version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: facility_level; Type: TYPE; Schema: public; Owner: subash
--

CREATE TYPE public.facility_level AS ENUM (
    'phc',
    'chc',
    'district_hospital'
);


ALTER TYPE public.facility_level OWNER TO subash;

--
-- Name: referral_state; Type: TYPE; Schema: public; Owner: subash
--

CREATE TYPE public.referral_state AS ENUM (
    'created',
    'in_transit',
    'received_at_facility',
    'closed',
    'cancelled'
);


ALTER TYPE public.referral_state OWNER TO subash;

--
-- Name: urgency_level; Type: TYPE; Schema: public; Owner: subash
--

CREATE TYPE public.urgency_level AS ENUM (
    'low',
    'medium',
    'high',
    'emergency'
);


ALTER TYPE public.urgency_level OWNER TO subash;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: asha_workers; Type: TABLE; Schema: public; Owner: subash
--

CREATE TABLE public.asha_workers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text,
    facility_id uuid
);


ALTER TABLE public.asha_workers OWNER TO subash;

--
-- Name: facilities; Type: TABLE; Schema: public; Owner: subash
--

CREATE TABLE public.facilities (
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
    CONSTRAINT facilities_operational_status_check CHECK (((operational_status)::text = ANY ((ARRAY['AVAILABLE'::character varying, 'BUSY'::character varying, 'EMERGENCY_ONLY'::character varying, 'FULL'::character varying])::text[])))
);


ALTER TABLE public.facilities OWNER TO subash;

--
-- Name: facility_staff; Type: TABLE; Schema: public; Owner: subash
--

CREATE TABLE public.facility_staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    phone_or_username character varying(64) NOT NULL,
    mpin_hash character varying(255) NOT NULL,
    role character varying(32) NOT NULL,
    facility_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT facility_staff_role_check CHECK (((role)::text = ANY ((ARRAY['phc_staff'::character varying, 'supervisor'::character varying])::text[])))
);


ALTER TABLE public.facility_staff OWNER TO subash;

--
-- Name: patients; Type: TABLE; Schema: public; Owner: subash
--

CREATE TABLE public.patients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_name text,
    age_years numeric,
    sex text,
    village text,
    phone text,
    abha_id text,
    created_at timestamp with time zone DEFAULT now(),
    client_patient_id text
);


ALTER TABLE public.patients OWNER TO subash;

--
-- Name: referral_state_transitions; Type: TABLE; Schema: public; Owner: subash
--

CREATE TABLE public.referral_state_transitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referral_id uuid NOT NULL,
    from_state public.referral_state,
    to_state public.referral_state NOT NULL,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now(),
    notes text,
    updated_by_staff_id uuid
);


ALTER TABLE public.referral_state_transitions OWNER TO subash;

--
-- Name: referrals; Type: TABLE; Schema: public; Owner: subash
--

CREATE TABLE public.referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    triage_record_id uuid NOT NULL,
    facility_id uuid,
    created_by uuid,
    state public.referral_state DEFAULT 'created'::public.referral_state NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by_role character varying(16),
    origin_facility_id uuid,
    client_ref_id text,
    CONSTRAINT referrals_created_by_role_check CHECK ((((created_by_role)::text = ANY ((ARRAY['asha'::character varying, 'phc_staff'::character varying])::text[])) OR (created_by_role IS NULL)))
);


ALTER TABLE public.referrals OWNER TO subash;

--
-- Name: sos_alerts; Type: TABLE; Schema: public; Owner: subash
--

CREATE TABLE public.sos_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    latitude double precision,
    longitude double precision,
    patient_context jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sos_alerts OWNER TO subash;

--
-- Name: triage_records; Type: TABLE; Schema: public; Owner: subash
--

CREATE TABLE public.triage_records (
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
    client_record_id text,
    client_claimed_urgency public.urgency_level,
    urgency_mismatch boolean DEFAULT false NOT NULL
);


ALTER TABLE public.triage_records OWNER TO subash;

--
-- Name: asha_workers asha_workers_pkey; Type: CONSTRAINT; Schema: public; Owner: subash
--

ALTER TABLE ONLY public.asha_workers
    ADD CONSTRAINT asha_workers_pkey PRIMARY KEY (id);


--
-- Name: facilities facilities_pkey; Type: CONSTRAINT; Schema: public; Owner: subash
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_pkey PRIMARY KEY (id);


--
-- Name: facility_staff facility_staff_phone_or_username_key; Type: CONSTRAINT; Schema: public; Owner: subash
--

ALTER TABLE ONLY public.facility_staff
    ADD CONSTRAINT facility_staff_phone_or_username_key UNIQUE (phone_or_username);


--
-- Name: facility_staff facility_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: subash
--

ALTER TABLE ONLY public.facility_staff
    ADD CONSTRAINT facility_staff_pkey PRIMARY KEY (id);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: subash
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: referral_state_transitions referral_state_transitions_pkey; Type: CONSTRAINT; Schema: public; Owner: subash
--

ALTER TABLE ONLY public.referral_state_transitions
    ADD CONSTRAINT referral_state_transitions_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: subash
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: sos_alerts sos_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: subash
--

ALTER TABLE ONLY public.sos_alerts
    ADD CONSTRAINT sos_alerts_pkey PRIMARY KEY (id);


--
-- Name: triage_records triage_records_pkey; Type: CONSTRAINT; Schema: public; Owner: subash
--

ALTER TABLE ONLY public.triage_records
    ADD CONSTRAINT triage_records_pkey PRIMARY KEY (id);


--
-- Name: idx_facilities_operational_status; Type: INDEX; Schema: public; Owner: subash
--

CREATE INDEX idx_facilities_operational_status ON public.facilities USING btree (operational_status);


--
-- Name: idx_facility_staff_facility; Type: INDEX; Schema: public; Owner: subash
--

CREATE INDEX idx_facility_staff_facility ON public.facility_staff USING btree (facility_id);


--
-- Name: idx_facility_staff_phone; Type: INDEX; Schema: public; Owner: subash
--

CREATE INDEX idx_facility_staff_phone ON public.facility_staff USING btree (phone_or_username);


--
-- Name: idx_patients_client_patient_id; Type: INDEX; Schema: public; Owner: subash
--

CREATE UNIQUE INDEX idx_patients_client_patient_id ON public.patients USING btree (client_patient_id) WHERE (client_patient_id IS NOT NULL);


--
-- Name: idx_referral_state_transitions_staff; Type: INDEX; Schema: public; Owner: subash
--

CREATE INDEX idx_referral_state_transitions_staff ON public.referral_state_transitions USING btree (updated_by_staff_id);


--
-- Name: idx_referrals_client_ref_id; Type: INDEX; Schema: public; Owner: subash
--

CREATE UNIQUE INDEX idx_referrals_client_ref_id ON public.referrals USING btree (client_ref_id) WHERE (client_ref_id IS NOT NULL);


--
-- Name: idx_referrals_created_by_role; Type: INDEX; Schema: public; Owner: subash
--

CREATE INDEX idx_referrals_created_by_role ON public.referrals USING btree (created_by_role);


--
-- Name: idx_referrals_state; Type: INDEX; Schema: public; Owner: subash
--

CREATE INDEX idx_referrals_state ON public.referrals USING btree (state);


--
-- Name: idx_referrals_triage_record; Type: INDEX; Schema: public; Owner: subash
--

CREATE INDEX idx_referrals_triage_record ON public.referrals USING btree (triage_record_id);


--
-- Name: idx_triage_patient; Type: INDEX; Schema: public; Owner: subash
--

CREATE INDEX idx_triage_patient ON public.triage_records USING btree (patient_id);


--
-- Name: idx_triage_records_client_record_id; Type: INDEX; Schema: public; Owner: subash
--

CREATE UNIQUE INDEX idx_triage_records_client_record_id ON public.triage_records USING btree (client_record_id) WHERE (client_record_id IS NOT NULL);


--
-- Name: idx_triage_records_duration_days; Type: INDEX; Schema: public; Owner: subash
--

CREATE INDEX idx_triage_records_duration_days ON public.triage_records USING btree (duration_days);


--
-- Name: idx_triage_records_urgency_mismatch; Type: INDEX; Schema: public; Owner: subash
--

CREATE INDEX idx_triage_records_urgency_mismatch ON public.triage_records USING btree (urgency_mismatch) WHERE (urgency_mismatch = true);


--
-- Name: idx_triage_urgency_created; Type: INDEX; Schema: public; Owner: subash
--

CREATE INDEX idx_triage_urgency_created ON public.triage_records USING btree (urgency, created_at);


--
-- Name: asha_workers asha_workers_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: subash
--

ALTER TABLE ONLY public.asha_workers
    ADD CONSTRAINT asha_workers_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: facilities facilities_updated_by_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: subash
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_updated_by_staff_id_fkey FOREIGN KEY (updated_by_staff_id) REFERENCES public.facility_staff(id) ON DELETE SET NULL;


--
-- Name: facility_staff facility_staff_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: subash
--

ALTER TABLE ONLY public.facility_staff
    ADD CONSTRAINT facility_staff_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON DELETE CASCADE;


--
-- Name: referral_state_transitions referral_state_transitions_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: subash
--

ALTER TABLE ONLY public.referral_state_transitions
    ADD CONSTRAINT referral_state_transitions_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.asha_workers(id);


--
-- Name: referral_state_transitions referral_state_transitions_referral_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: subash
--

ALTER TABLE ONLY public.referral_state_transitions
    ADD CONSTRAINT referral_state_transitions_referral_id_fkey FOREIGN KEY (referral_id) REFERENCES public.referrals(id);


--
-- Name: referral_state_transitions referral_state_transitions_updated_by_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: subash
--

ALTER TABLE ONLY public.referral_state_transitions
    ADD CONSTRAINT referral_state_transitions_updated_by_staff_id_fkey FOREIGN KEY (updated_by_staff_id) REFERENCES public.facility_staff(id) ON DELETE SET NULL;


--
-- Name: referrals referrals_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: subash
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.asha_workers(id);


--
-- Name: referrals referrals_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: subash
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: referrals referrals_origin_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: subash
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_origin_facility_id_fkey FOREIGN KEY (origin_facility_id) REFERENCES public.facilities(id) ON DELETE SET NULL;


--
-- Name: referrals referrals_triage_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: subash
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_triage_record_id_fkey FOREIGN KEY (triage_record_id) REFERENCES public.triage_records(id);


--
-- Name: triage_records triage_records_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: subash
--

ALTER TABLE ONLY public.triage_records
    ADD CONSTRAINT triage_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT ALL ON SCHEMA public TO subash;


--
-- PostgreSQL database dump complete
--

\unrestrict rWCs7THR9uXVhx169O0PgykmhFKfje4LfybkH58phcg6NzStLMSnGrem409Uevy

