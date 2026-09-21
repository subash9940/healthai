import { evaluateTriage as evaluateCitizen } from "./citizen_web/src/lib/localRulesEngine";
import { evaluateOfflineTriage as evaluateAsha } from "./asha_app/src/rules/offlineRulesEngine";
import { TriageRequest as CitizenRequest } from "./citizen_web/src/lib/triageContract";
import { TriageEvaluationRequest as AshaRequest } from "./asha_app/src/types";

interface TestCaseDef {
  id: number;
  label: string;
  input: {
    symptoms: string[];
    patient_age_years: number;
    patient_sex: "male" | "female" | "other";
    is_pregnant?: boolean | null;
    is_postpartum?: boolean;
    vitals?: {
      temperature_celsius?: number | null;
      pulse_bpm?: number | null;
      systolic_bp?: number | null;
      diastolic_bp?: number | null;
      respiratory_rate?: number | null;
      spo2_percent?: number | null;
      hemoglobin_g_dl?: number | null;
    } | null;
    symptom_duration_days?: number | null;
    language?: string;
    source_tier?: string;
  };
}

const testCases: TestCaseDef[] = [
  {
    id: 1,
    label: "Child general danger sign",
    input: { symptoms: ["convulsions"], patient_age_years: 1.5, patient_sex: "female" }
  },
  {
    id: 2,
    label: "Child severe pneumonia",
    input: { symptoms: ["breathlessness", "chest_indrawing"], patient_age_years: 2, patient_sex: "male" }
  },
  {
    id: 3,
    label: "Child severe dehydration (2+ signs)",
    input: { symptoms: ["lethargic_or_unconscious", "sunken_eyes"], patient_age_years: 1, patient_sex: "female" }
  },
  {
    id: 4,
    label: "Young infant severe dehydration",
    input: { symptoms: ["movement_only_when_stimulated_or_none", "sunken_eyes"], patient_age_years: 0.08, patient_sex: "male" }
  },
  {
    id: 5,
    label: "Very severe febrile disease (child)",
    input: { symptoms: ["fever", "stiff_neck"], patient_age_years: 3, patient_sex: "female" }
  },
  {
    id: 6,
    label: "Mastoiditis",
    input: { symptoms: ["tender_swelling_behind_ear"], patient_age_years: 4, patient_sex: "male" }
  },
  {
    id: 7,
    label: "Pregnancy danger sign (bleeding)",
    input: { symptoms: ["bleeding_from_vagina_any_amount"], patient_age_years: 26, patient_sex: "female", is_pregnant: true }
  },
  {
    id: 8,
    label: "Labour danger sign (retained placenta)",
    input: { symptoms: ["retained_placenta"], patient_age_years: 29, patient_sex: "female", is_pregnant: true }
  },
  {
    id: 9,
    label: "Postpartum haemorrhage",
    input: { symptoms: ["more_than_5_pads_per_day_or_1_thick_cloth_per_day"], patient_age_years: 24, patient_sex: "female", is_postpartum: true }
  },
  {
    id: 10,
    label: "Postpartum convulsions",
    input: { symptoms: ["convulsions"], patient_age_years: 27, patient_sex: "female", is_postpartum: true }
  },
  {
    id: 11,
    label: "FRU-tier pregnancy (malpresentation)",
    input: { symptoms: ["malpresentation"], patient_age_years: 31, patient_sex: "female", is_pregnant: true }
  },
  {
    id: 12,
    label: "PROM before 37 weeks",
    input: { symptoms: ["premature_rupture_of_membranes_before_37_weeks"], patient_age_years: 25, patient_sex: "female", is_pregnant: true }
  },
  {
    id: 13,
    label: "Pregnancy temp >38C",
    input: { symptoms: [], patient_age_years: 28, patient_sex: "female", is_pregnant: true, vitals: { temperature_celsius: 38.5 } }
  },
  {
    id: 14,
    label: "Ruptured membranes >18h",
    input: { symptoms: ["ruptured_membranes_more_than_18h"], patient_age_years: 30, patient_sex: "female", is_pregnant: true }
  },
  {
    id: 15,
    label: "Young infant fast breathing",
    input: { symptoms: [], patient_age_years: 0.05, patient_sex: "male", vitals: { respiratory_rate: 65 } }
  },
  {
    id: 16,
    label: "Adult RED fast track (chest pain)",
    input: { symptoms: ["chest_pain"], patient_age_years: 45, patient_sex: "male" }
  },
  {
    id: 17,
    label: "Adult RED trauma (penetrating)",
    input: { symptoms: ["stab_or_penetrating_injury"], patient_age_years: 35, patient_sex: "male" }
  },
  {
    id: 18,
    label: "Adult unstable vitals only, no symptoms",
    input: { symptoms: [], patient_age_years: 52, patient_sex: "male", vitals: { systolic_bp: 82 } }
  },
  {
    id: 19,
    label: "Adult major burn special area",
    input: { symptoms: ["burn_special_area_hands_face_perineum_or_airway"], patient_age_years: 40, patient_sex: "female" }
  },
  {
    id: 20,
    label: "Elderly small burn (age>60 escalation)",
    input: { symptoms: ["burn_present"], patient_age_years: 65, patient_sex: "female" }
  },
  {
    id: 21,
    label: "Adult YELLOW medical (headache/dizziness)",
    input: { symptoms: ["headache_or_dizziness"], patient_age_years: 33, patient_sex: "male" }
  },
  {
    id: 22,
    label: "Adult YELLOW trauma (isolated long-bone fracture)",
    input: { symptoms: ["isolated_long_bone_fracture"], patient_age_years: 30, patient_sex: "male", vitals: { systolic_bp: 118, respiratory_rate: 16, spo2_percent: 97 } }
  },
  {
    id: 23,
    label: "Pregnant with injury",
    input: { symptoms: ["injury"], patient_age_years: 27, patient_sex: "female", is_pregnant: true }
  },
  {
    id: 24,
    label: "Malaria hyperpyrexia",
    input: { symptoms: ["fever"], patient_age_years: 38, patient_sex: "male", vitals: { temperature_celsius: 40.2 } }
  },
  {
    id: 25,
    label: "Malaria dark urine (blackwater)",
    input: { symptoms: ["dark_or_cola_coloured_urine"], patient_age_years: 41, patient_sex: "male" }
  },
  {
    id: 26,
    label: "Malaria fever+chills (uncomplicated suspect)",
    input: { symptoms: ["fever", "chills_and_rigors"], patient_age_years: 29, patient_sex: "female" }
  },
  {
    id: 27,
    label: "Dengue warning signs",
    input: { symptoms: ["fever", "persistent_vomiting"], patient_age_years: 34, patient_sex: "male" }
  },
  {
    id: 28,
    label: "TB presumptive",
    input: { symptoms: ["cough_more_than_2_weeks"], patient_age_years: 45, patient_sex: "male" }
  },
  {
    id: 29,
    label: "Severe anaemia in pregnancy (Hb<5)",
    input: { symptoms: [], patient_age_years: 26, patient_sex: "female", is_pregnant: true, vitals: { hemoglobin_g_dl: 4.5 } }
  },
  {
    id: 30,
    label: "Severe anaemia in pregnancy (Hb 5-6.9)",
    input: { symptoms: [], patient_age_years: 27, patient_sex: "female", is_pregnant: true, vitals: { hemoglobin_g_dl: 6.0 } }
  },
  {
    id: 31,
    label: "Severe anaemia child 6-59m (Hb<7)",
    input: { symptoms: [], patient_age_years: 2, patient_sex: "male", vitals: { hemoglobin_g_dl: 6.5 } }
  },
  {
    id: 32,
    label: "Severe anaemia child 5-9y (Hb<8)",
    input: { symptoms: [], patient_age_years: 7, patient_sex: "female", vitals: { hemoglobin_g_dl: 7.5 } }
  },
  {
    id: 33,
    label: "Severe anaemia adolescent 10-19y (Hb<8)",
    input: { symptoms: [], patient_age_years: 15, patient_sex: "male", vitals: { hemoglobin_g_dl: 7.2 } }
  },
  {
    id: 34,
    label: "Severe anaemia non-pregnant woman (Hb<8)",
    input: { symptoms: [], patient_age_years: 22, patient_sex: "female", is_pregnant: false, vitals: { hemoglobin_g_dl: 7.8 } }
  },
  {
    id: 35,
    label: "Visible pallor, no Hb value",
    input: { symptoms: ["pallor"], patient_age_years: 30, patient_sex: "female" }
  },
  {
    id: 36,
    label: "THE FIXED BUG — adult fever, measured 37.0C, no other symptoms",
    input: { symptoms: ["fever"], patient_age_years: 28, patient_sex: "male", vitals: { temperature_celsius: 37.0 } }
  },
  {
    id: 37,
    label: "Adult fever measured 38.6C, duration=1 day",
    input: { symptoms: ["fever"], patient_age_years: 20, patient_sex: "male", vitals: { temperature_celsius: 38.6 }, symptom_duration_days: 1 }
  },
  {
    id: 38,
    label: "Adult unmeasured fever, duration=6 days",
    input: { symptoms: ["fever", "cough"], patient_age_years: 20, patient_sex: "male", symptom_duration_days: 6 }
  },
  {
    id: 39,
    label: "Boundary — fever measured EXACTLY 38.3C",
    input: { symptoms: ["fever"], patient_age_years: 30, patient_sex: "male", vitals: { temperature_celsius: 38.3 } }
  },
  {
    id: 40,
    label: "Boundary — fever measured 38.29C (just under)",
    input: { symptoms: ["fever"], patient_age_years: 30, patient_sex: "male", vitals: { temperature_celsius: 38.29 } }
  },
  {
    id: 41,
    label: "Adult minor cough/cold, normal vitals",
    input: { symptoms: ["low_risk_cough_or_cold"], patient_age_years: 34, patient_sex: "female", vitals: { respiratory_rate: 16, spo2_percent: 98 } }
  },
  {
    id: 42,
    label: "Adult empty symptoms, no vitals (honest fallback)",
    input: { symptoms: [], patient_age_years: 40, patient_sex: "male" }
  },
  {
    id: 43,
    label: "6-year-old chest pain (outside IMNCI band)",
    input: { symptoms: ["chest_pain"], patient_age_years: 6, patient_sex: "male" }
  },
  {
    id: 44,
    label: "Pregnant, BP 150/95 via raw vitals",
    input: { symptoms: [], patient_age_years: 28, patient_sex: "female", is_pregnant: true, vitals: { systolic_bp: 150, diastolic_bp: 95 } }
  },
  {
    id: 45,
    label: "Malaria test positive, uncomplicated",
    input: { symptoms: ["fever", "malaria_test_positive"], patient_age_years: 33, patient_sex: "male" }
  },
  {
    id: 46,
    label: "Fever, malaria test negative",
    input: { symptoms: ["fever", "malaria_test_negative"], patient_age_years: 33, patient_sex: "male" }
  },
  {
    id: 47,
    label: "Child cough, no fever, no danger signs",
    input: { symptoms: ["cough"], patient_age_years: 3, patient_sex: "female" }
  },
  {
    id: 48,
    label: "Acute ear infection (<14 days)",
    input: { symptoms: ["pus_draining_less_than_14_days"], patient_age_years: 5, patient_sex: "male" }
  },
  {
    id: 49,
    label: "Chronic ear infection (>=14 days)",
    input: { symptoms: ["pus_draining_14_days_or_more"], patient_age_years: 6, patient_sex: "female" }
  },
  {
    id: 50,
    label: "Snake or scorpion bite",
    input: { symptoms: ["snake_or_scorpion_bite"], patient_age_years: 27, patient_sex: "male" }
  },
  {
    id: 51,
    label: "Fail-closed LOW: adult [headache]",
    input: { symptoms: ["headache"], patient_age_years: 30, patient_sex: "male" }
  },
  {
    id: 52,
    label: "Fail-closed LOW: adult [dizziness]",
    input: { symptoms: ["dizziness"], patient_age_years: 30, patient_sex: "female" }
  },
  {
    id: 53,
    label: "Fail-closed LOW: adult [cough, headache]",
    input: { symptoms: ["cough", "headache"], patient_age_years: 30, patient_sex: "male" }
  },
  {
    id: 54,
    label: "Fail-closed LOW: adult [fatigue]",
    input: { symptoms: ["fatigue"], patient_age_years: 30, patient_sex: "female" }
  },
  {
    id: 55,
    label: "Fail-closed NOT LOW: adult [cough, weight_loss]",
    input: { symptoms: ["cough", "weight_loss"], patient_age_years: 30, patient_sex: "male" }
  },
  {
    id: 56,
    label: "Fail-closed NOT LOW: adult [dizziness_vertigo, fatigue]",
    input: { symptoms: ["dizziness_vertigo", "fatigue"], patient_age_years: 30, patient_sex: "female" }
  },
  {
    id: 57,
    label: "Fail-closed NOT LOW: adult [significant_weight_loss, cough]",
    input: { symptoms: ["significant_weight_loss", "cough"], patient_age_years: 30, patient_sex: "male" }
  },
  {
    id: 58,
    label: "Fail-closed NOT LOW: adult [cough, convulsions_or_loss_of_consciousness]",
    input: { symptoms: ["cough", "convulsions_or_loss_of_consciousness"], patient_age_years: 30, patient_sex: "female" }
  },
  {
    id: 59,
    label: "Fail-closed NOT LOW: adult [vomits_everything, cough]",
    input: { symptoms: ["vomits_everything", "cough"], patient_age_years: 30, patient_sex: "male" }
  },
  {
    id: 60,
    label: "Fail-closed NOT LOW: adult [burn_present, cough]",
    input: { symptoms: ["burn_present", "cough"], patient_age_years: 30, patient_sex: "female" }
  },
  {
    id: 61,
    label: "Fail-closed NOT LOW: adult [difficult_breathing, cough]",
    input: { symptoms: ["difficult_breathing", "cough"], patient_age_years: 30, patient_sex: "male" }
  },
  {
    id: 62,
    label: "Fail-closed NOT LOW: adult [headache, burn_present]",
    input: { symptoms: ["headache", "burn_present"], patient_age_years: 30, patient_sex: "female" }
  },
];

interface CaseResult {
  caseNumber: number;
  label: string;
  input: any;
  citizen: { rule0: string; urgency: string; error?: string };
  asha: { rule0: string; urgency: string; error?: string };
  status: "MATCH" | "MISMATCH" | "ERROR";
}

const results: CaseResult[] = [];
let matchCount = 0;
let mismatchCount = 0;
const mismatchCases: number[] = [];

console.log("===========================================================================");
console.log("RUNNING 50-CASE PARITY TEST HARNESS ACROSS RULE ENGINES");
console.log("citizen_web/src/lib/localRulesEngine.ts vs asha_app/src/rules/offlineRulesEngine.ts");
console.log("===========================================================================\n");

for (const tc of testCases) {
  // Common standard fields
  const baseCitizenReq: CitizenRequest = {
    patient_id: `test_pat_${tc.id}`,
    patient_display_name: `Test Patient ${tc.id}`,
    patient_village: "Test Village",
    patient_phone: "9876543210",
    symptoms: tc.input.symptoms,
    patient_age_years: tc.input.patient_age_years,
    patient_sex: tc.input.patient_sex,
    is_pregnant: tc.input.is_pregnant ?? null,
    is_postpartum: tc.input.is_postpartum ?? false,
    vitals: tc.input.vitals ?? null,
    symptom_duration_days: tc.input.symptom_duration_days ?? null,
    language: tc.input.language ?? "en",
    source_tier: "citizen_web",
  };

  const baseAshaReq: AshaRequest = {
    patient_id: `test_pat_${tc.id}`,
    patient_display_name: `Test Patient ${tc.id}`,
    patient_village: "Test Village",
    mobile: "9876543210",
    symptoms: tc.input.symptoms,
    patient_age_years: tc.input.patient_age_years,
    patient_sex: tc.input.patient_sex,
    is_pregnant: tc.input.is_pregnant ?? null,
    is_postpartum: tc.input.is_postpartum ?? false,
    vitals: tc.input.vitals ?? null,
    symptom_duration_days: tc.input.symptom_duration_days ?? null,
    language: (tc.input.language as any) ?? "en",
    source_tier: "asha_app",
  };

  let citizenRule0 = "NONE";
  let citizenUrgency = "UNKNOWN";
  let citizenErr: string | undefined;

  let ashaRule0 = "NONE";
  let ashaUrgency = "UNKNOWN";
  let ashaErr: string | undefined;

  try {
    const resCitizen = evaluateCitizen(baseCitizenReq);
    citizenRule0 = resCitizen.rule_trace?.[0] ?? "EMPTY_TRACE";
    citizenUrgency = resCitizen.urgency;
  } catch (err: any) {
    citizenErr = err?.message || String(err);
  }

  try {
    const resAsha = evaluateAsha(baseAshaReq);
    ashaRule0 = resAsha.rule_trace?.[0] ?? "EMPTY_TRACE";
    ashaUrgency = resAsha.urgency;
  } catch (err: any) {
    ashaErr = err?.message || String(err);
  }

  const isMatch =
    !citizenErr &&
    !ashaErr &&
    citizenRule0 === ashaRule0 &&
    citizenUrgency === ashaUrgency;

  const status: "MATCH" | "MISMATCH" | "ERROR" = citizenErr || ashaErr ? "ERROR" : isMatch ? "MATCH" : "MISMATCH";

  if (isMatch) {
    matchCount++;
  } else {
    mismatchCount++;
    mismatchCases.push(tc.id);
  }

  results.push({
    caseNumber: tc.id,
    label: tc.label,
    input: tc.input,
    citizen: { rule0: citizenRule0, urgency: citizenUrgency, error: citizenErr },
    asha: { rule0: ashaRule0, urgency: ashaUrgency, error: ashaErr },
    status,
  });

  console.log(`Case ${tc.id}: ${tc.label}`);
  console.log(`  Input: ${JSON.stringify(tc.input)}`);
  if (citizenErr) {
    console.log(`  citizen_web error: ${citizenErr}`);
  } else {
    console.log(`  citizen_web: rule_trace[0]="${citizenRule0}", urgency="${citizenUrgency}"`);
  }
  if (ashaErr) {
    console.log(`  asha_app error: ${ashaErr}`);
  } else {
    console.log(`  asha_app:    rule_trace[0]="${ashaRule0}", urgency="${ashaUrgency}"`);
  }
  console.log(`  Result: ${status}`);
  console.log("---------------------------------------------------------------------------");
}

console.log("\n===========================================================================");
console.log("PARITY TEST SUMMARY");
console.log("===========================================================================");
console.log(`Total Cases: ${testCases.length}`);
console.log(`MATCH:       ${matchCount}`);
console.log(`MISMATCH:    ${mismatchCount}`);
if (mismatchCases.length > 0) {
  console.log(`MISMATCH Cases: [${mismatchCases.join(", ")}]`);
} else {
  console.log(`MISMATCH Cases: NONE (100% Parity)`);
}
console.log("===========================================================================");
