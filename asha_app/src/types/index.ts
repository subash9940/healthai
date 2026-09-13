/**
 * src/types/index.ts
 *
 * Core data contracts for ASHA Field Health Application.
 * Locked to Swasthya Setu shared clinical schema.
 */

export type Language = "mr" | "hi" | "en" | "ta";

export type Urgency = "low" | "medium" | "high" | "emergency";
export type Sex = "male" | "female" | "other";
export type FacilityLevel = "sub_centre" | "phc" | "chc" | "district_hospital" | "sdh" | "dh";

export type FacilityOperationalStatus = "AVAILABLE" | "BUSY" | "EMERGENCY_ONLY" | "FULL";

export interface FacilityAvailabilityItem {
  id: string;
  name: string;
  level: string;
  operational_status: FacilityOperationalStatus;
  available_beds: number;
  status_note?: string | null;
  updated_at?: string | null;
  district?: string | null;
}

export type ReferralStatus = "created" | "in_transit" | "received_at_facility" | "closed";

export type AshaWorkerRole = "worker" | "supervisor" | "admin";

export interface Vitals {
  temperature_celsius?: number | null;
  pulse_bpm?: number | null;
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  respiratory_rate?: number | null;
  spo2_percent?: number | null;
  hemoglobin_g_dl?: number | null;
}

export interface PatientDemographics {
  patient_id: string; // Client-generated ID / ULID
  patient_display_name: string;
  patient_village: string;
  mobile: string; // 10-digit Indian phone
  abha_id?: string | null;
  patient_age_years: number;
  patient_sex: Sex;
  is_pregnant?: boolean | null;
  is_postpartum?: boolean;
}

export interface TriageEvaluationRequest extends PatientDemographics {
  symptoms: string[];
  vitals?: Vitals | null;
  symptom_duration_days?: number | null;
  language?: Language;
  source_tier: "asha_app";
}

export interface TriageEvaluationResponse {
  urgency: Urgency;
  recommended_action: string;
  citizen_message: string;
  requires_referral: boolean;
  referral_target_level: FacilityLevel | null;
  rule_trace: string[];
  evaluated_at: string;
  is_offline_evaluation: boolean;
}

export interface PatientRecord {
  patient: PatientDemographics;
  symptoms: string[];
  vitals: Vitals;
  triage: TriageEvaluationResponse;
  created_at: string;
  synced: boolean;
  synced_at?: string | null;
  asha_worker_id: string;
}

export interface ReferralRecord {
  referral_id: string;
  patient_id: string;
  patient_name: string;
  patient_village: string;
  patient_phone: string;
  patient_age: number;
  patient_sex: Sex;
  urgency: Urgency;
  target_facility: FacilityLevel;
  status: ReferralStatus;
  status_history: {
    status: ReferralStatus;
    timestamp: string;
    note?: string;
  }[];
  symptoms: string[];
  recommended_action: string;
  created_at: string;
  synced: boolean;
  asha_worker_id: string;
}

export interface AshaWorkerSession {
  worker_id: string;
  worker_name: string;
  role: AshaWorkerRole;
  phc_area: string;
  sub_centre: string;
  village_cluster: string[];
  is_authenticated: boolean;
  session_token: string;
  token_expires_at: string;
  last_login: string;
  phone_number?: string;
}

export interface PasswordStrengthResult {
  score: number; // 0 to 4
  label: "Very Weak" | "Weak" | "Fair" | "Strong" | "Very Strong";
  color: string;
  hasMinLength: boolean;
  isSequential: boolean;
  isRepeated: boolean;
  isCommon: boolean;
  feedback: string[];
}

export interface SecurityAuditLog {
  id: string;
  timestamp: string;
  worker_id: string;
  event_type: "LOGIN_SUCCESS" | "LOGIN_FAILED" | "LOCKOUT_TRIGGERED" | "LOCKOUT_RESET" | "ADMIN_OVERRIDE" | "REFERRAL_DISPATCHED" | "REFERRAL_STATUS_UPDATED";
  details: string;
  ip_device: string;
}
