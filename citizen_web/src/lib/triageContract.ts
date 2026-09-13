/**
 * triageContract.ts — v2
 * 
 * TypeScript representation of triage_contract.py v2.
 * Shared locked schema across all Swasthya Setu frontends (ASHA app, citizen web, IVR).
 */

export type Urgency = "low" | "medium" | "high" | "emergency";
export type Sex = "male" | "female" | "other";

export interface Vitals {
  temperature_celsius?: number | null;
  pulse_bpm?: number | null;
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  respiratory_rate?: number | null;
  spo2_percent?: number | null;
  hemoglobin_g_dl?: number | null;
}

export interface TriageRequest {
  patient_id?: string | null;            // ULID or client ID
  patient_display_name?: string | null;  // Patient full name
  patient_phone?: string | null;         // 10-digit mobile phone
  patient_village?: string | null;       // Village / town
  patient_address?: string | null;       // Residential address
  patient_abha_id?: string | null;       // ABHA ID
  patient_problem_summary?: string | null; // Synthesized natural clinical narrative of the problem
  voice_transcript?: string | null;      // Raw voice input transcript
  symptoms: string[];                    // Normalized symptom codes
  patient_age_years: number;
  patient_sex: Sex;
  is_pregnant?: boolean | null;
  is_postpartum?: boolean;               // Birth up to 6 weeks post-delivery
  vitals?: Vitals | null;
  symptom_duration_days?: number | null; // Days since onset of primary presenting complaint (0, 2, 4, 6, 10)
  language?: string;                     // "mr" (Marathi) | "hi" (Hindi) | "en" | "ta"
  source_tier: "citizen_web" | "asha_app" | "ivr";
}

export interface TriageResponse {
  urgency: Urgency;
  recommended_action: string;            // Internal clinical/audit wording (for ASHA/doctor)
  citizen_message: string;               // Plain-language wording — ONLY field citizen_web displays!
  rule_trace: string[];                  // ICMR / NHM rule IDs fired
  requires_referral: boolean;
  referral_target_level?: "phc" | "chc" | "district_hospital" | null;
  fhir_ready: boolean;
  triage_record_id?: string | null;      // DB-assigned triage_records.id
  patient_id?: string | null;            // DB-assigned patients.id
  referral_id?: string | null;           // DB-assigned referrals.id
}
