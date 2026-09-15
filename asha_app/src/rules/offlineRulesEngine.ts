/**
 * src/rules/offlineRulesEngine.ts
 *
 * 100% Offline Deterministic Rule Engine for ASHA Field Workers.
 * Direct 1:1 parity with backend rules_engine.py (v12, 49 clinical rules).
 * Implements NHM, IMNCI (2023), ASHA Module 6, SBA Box 7,
 * NVBDCP, Anemia Mukt Bharat, ICMR Fever guidelines, and Common Emergencies Annexure 4.
 *
 * Zero AI/LLM dependency for frontline clinical safety decisions.
 */

import {
  TriageEvaluationRequest,
  TriageEvaluationResponse,
  Urgency,
  FacilityLevel,
  Language,
} from "../types";

export const GENERAL_DANGER_SIGNS = [
  "not_able_to_drink_or_feed",
  "vomits_everything",
  "convulsions",
  "lethargic_or_unconscious",
];

export const ADULT_RED_FAST_TRACK_SYMPTOMS = [
  "chest_pain",
  "severe_chest_pain_radiating_to_arm_or_jaw",
  "altered_sensorium",
  "stroke_fast_signs",
  "sudden_weakness_face_arm_speech_slurred",
  "suspected_poisoning_with_unstable_vitals",
  "active_seizure",
  "history_of_fainting_or_syncope",
  "high_grade_fever_with_altered_mental_status",
  "hanging_or_near_drowning_or_electrocution_or_heat_stroke",
  "snake_or_scorpion_bite",
  "abnormal_bleeding_per_vagina",
  "ongoing_bleeding_vomitus_cough_urine_or_nose",
  "pallor_with_breathlessness_or_foot_swelling",
  "severe_allergic_reaction_lip_throat_swelling",
  "severe_breathlessness",
  "burn_special_area_hands_face_perineum_or_airway",
  "heavy_bleeding_postpartum",
  "eclampsia_seizures",
];

export const ADULT_RED_TRAUMA_SYMPTOMS = [
  "stab_or_penetrating_injury",
  "limb_injury_with_absent_distal_pulse",
  "fracture_with_exposed_bone",
  "two_or_more_long_bone_fractures",
  "abnormal_chest_wall_movement_on_breathing",
  "subcutaneous_crackles_or_seatbelt_mark",
  "suspected_neck_injury",
  "multiple_injuries",
  "suspected_sexual_assault",
  "noisy_breathing_or_stridor",
  "uncontrolled_bleeding_or_deep_wound",
];

export const ADULT_YELLOW_MEDICAL_SYMPTOMS = [
  "post_seizure_stage",
  "abdominal_pain_or_loose_motions_gt_3_episodes",
  "fever_with_headache_or_chest_pain_or_jaundice",
  "fever_in_chemo_or_hiv_or_diabetic_patient",
  "drug_overdose_or_poisoning_with_stable_vitals",
  "headache_or_dizziness",
  "unable_to_pass_stool",
  "unable_to_pass_urine",
  "painful_bleeding_per_rectum",
  "painful_swelling_or_wound",
  "pallor_or_known_anaemia_needing_transfusion",
  "breathlessness",
  "persistent_vomiting",
  "restlessness_or_sudden_behavioral_change",
  "not_able_to_drink_or_feed",
];

export const ADULT_YELLOW_TRAUMA_SYMPTOMS = [
  "fracture_of_hand_or_feet",
  "isolated_long_bone_fracture",
  "minor_head_injury",
  "suspected_spine_injury",
];

export const ADULT_GREEN_SYMPTOMS = [
  "minor_symptoms_of_existing_illness",
  "low_risk_cough_or_cold",
  "simple_skin_rash",
  "fresh_scratches_or_wounds",
  "fever_under_101f",
  "cough",
  "headache",
  "dizziness",
  "fatigue",
  "body_pain_weakness",
];

function getAgeYears(r: TriageEvaluationRequest): number {
  const val = r.patient_age_years ?? (r as any).patient_age ?? (r as any).age_years ?? (r as any).age;
  return typeof val === "number" && !isNaN(val) ? val : 25;
}

function ageInDays(r: TriageEvaluationRequest): number {
  return getAgeYears(r) * 365.25;
}

function isYoungInfant(r: TriageEvaluationRequest): boolean {
  return ageInDays(r) < 60;
}

function isChild2moTo5yr(r: TriageEvaluationRequest): boolean {
  const days = ageInDays(r);
  return days >= 60 && days <= 5 * 365.25;
}

function isOutsideImnciChildBands(r: TriageEvaluationRequest): boolean {
  return getAgeYears(r) > 5;
}

function isChild5to9yr(r: TriageEvaluationRequest): boolean {
  const age = getAgeYears(r);
  return age > 5.0 && age < 10.0;
}

function isAdolescent10to19yr(r: TriageEvaluationRequest): boolean {
  const age = getAgeYears(r);
  return age >= 10.0 && age <= 19.0;
}

function hasFastBreathing(r: TriageEvaluationRequest): boolean {
  if (r.symptoms.includes("fast_breathing") || r.symptoms.includes("fast_or_difficult_breathing")) {
    return true;
  }
  if (!r.vitals || r.vitals.respiratory_rate == null) {
    return false;
  }
  const rr = r.vitals.respiratory_rate;
  const days = ageInDays(r);
  if (days < 60) {
    return rr >= 60;
  } else if (days <= 365) {
    return rr >= 50;
  } else {
    return rr >= 40;
  }
}

function hasHighBP(r: TriageEvaluationRequest): boolean {
  if (
    r.vitals &&
    r.vitals.systolic_bp != null &&
    r.vitals.diastolic_bp != null &&
    (r.vitals.systolic_bp >= 140 || r.vitals.diastolic_bp >= 90)
  ) {
    return true;
  }
  return r.symptoms.includes("high_bp_gt_140_90_with_or_without_proteinuria");
}

function hasUnstableAdultVitals(r: TriageEvaluationRequest): boolean {
  const v = r.vitals;
  if (!v) return false;
  if (v.temperature_celsius != null && (v.temperature_celsius >= 39.5 || v.temperature_celsius <= 35.0)) return true;
  if (v.respiratory_rate != null && (v.respiratory_rate < 10 || v.respiratory_rate > 24)) return true;
  if (v.spo2_percent != null && v.spo2_percent < 92) return true;
  if (v.systolic_bp != null && (v.systolic_bp < 90 || v.systolic_bp > 180)) return true;
  if (v.diastolic_bp != null && v.diastolic_bp > 120) return true;
  if (v.pulse_bpm != null && (v.pulse_bpm < 60 || v.pulse_bpm > 100)) return true;
  return false;
}

function hasMajorAdultBurn(r: TriageEvaluationRequest): boolean {
  if (r.symptoms.includes("burn_special_area_hands_face_perineum_or_airway") || r.symptoms.includes("severe_burns_or_chemical_burn")) {
    return true;
  }
  if (getAgeYears(r) > 60 && (r.symptoms.includes("burn_present") || r.symptoms.includes("burns"))) {
    return true;
  }
  if (r.symptoms.includes("burn_percent_bsa_gt_20")) {
    return true;
  }
  return false;
}

function hasLowFeverUnder101f(r: TriageEvaluationRequest): boolean {
  if (r.symptoms.includes("fever_under_101f")) return true;
  if (r.vitals && r.vitals.temperature_celsius != null) {
    return r.vitals.temperature_celsius < 38.3;
  }
  return false;
}

export function buildFeverAction(r: TriageEvaluationRequest): string {
  const base =
    "Acute febrile illness per ICMR Treatment Guidelines (Ch.2, Management of Acute Fever). Administer paracetamol, provide plenty of fluids.";
  const days = r.symptom_duration_days;
  if (days === undefined || days === null) {
    return (
      base +
      " Duration not reported -- visit PHC for diagnostic evaluation (blood smear/RDT)."
    );
  }
  if (days <= 2) {
    return (
      base +
      " Day 1-2 of fever: per ICMR protocol, no investigations are required yet unless danger signs appear -- monitor at home and recheck if fever continues."
    );
  }
  if (days <= 4) {
    return (
      base +
      " Day 3-4 of fever: per ICMR protocol, visit PHC for blood count and malaria smear/RDT (dengue test if suspected)."
    );
  }
  if (days <= 7) {
    return (
      base +
      " Fever more than 5 days: per ICMR protocol, visit PHC/CHC for blood cultures in addition to malaria/dengue testing, and chikungunya/scrub typhus/leptospirosis testing if suspected in your area."
    );
  }
  return (
    base +
    " Fever more than 7 days: per ICMR protocol, visit PHC/CHC for the above plus chest X-ray and abdominal ultrasound to look for a hidden source."
  );
}

export function buildCitizenMessage(
  urgency: Urgency,
  facilityLevel: FacilityLevel | null,
  lang: Language = "mr",
  recommendedAction?: string
): string {
  const facilityNames: Record<Language, Record<FacilityLevel, string>> = {
    mr: {
      sub_centre: "आरोग्य उपकेंद्र किंवा आरोग्य वर्धिनी केंद्र",
      phc: "प्राथमिक आरोग्य केंद्र (PHC)",
      chc: "ग्रामीण रुग्णालय / सामुदायिक आरोग्य केंद्र (CHC)",
      sdh: "उपजिल्हा रुग्णालय (SDH)",
      dh: "जिल्हा रुग्णालय (DH)",
      district_hospital: "जिल्हा रुग्णालय किंवा उपजिल्हा रुग्णालय",
    },
    hi: {
      sub_centre: "आरोग्य उपकेंद्र / हेल्थ एंड वेलनेस सेंटर",
      phc: "प्राथमिक स्वास्थ्य केंद्र (PHC)",
      chc: "सामुदायिक स्वास्थ्य केंद्र (CHC)",
      sdh: "उप-जिला अस्पताल (SDH)",
      dh: "जिला अस्पताल (DH)",
      district_hospital: "जिला अस्पताल या रेफरल अस्पताल",
    },
    en: {
      sub_centre: "Sub-Centre / Health and Wellness Centre",
      phc: "Primary Health Centre (PHC)",
      chc: "Community Health Centre (CHC)",
      sdh: "Sub-District Hospital (SDH)",
      dh: "District Hospital (DH)",
      district_hospital: "District Hospital or First Referral Unit (FRU)",
    },
    ta: {
      sub_centre: "துணை சுகாதார நிலையம் / நல்வாழ்வு மையம்",
      phc: "முதன்மை சுகாதார மையம் (PHC)",
      chc: "சமூக சுகாதார மையம் (CHC)",
      sdh: "துணை மாவட்ட மருத்துவமனை (SDH)",
      dh: "மாவட்ட தலைமை மருத்துவமனை (DH)",
      district_hospital: "மாவட்ட தலைமை மருத்துவமனை / FRU",
    },
  };

  const facility = facilityLevel ? facilityNames[lang][facilityLevel] : facilityNames[lang]["phc"];

  if (urgency === "emergency") {
    if (lang === "mr") {
      return `तातडीची वैद्यकीय मदत आवश्यक आहे. रुग्णाला विनाविलंब जवळच्या ${facility} येथे घेऊन जा. रुग्णवाहिकेसाठी १०८ वर संपर्क साधा.`;
    }
    if (lang === "hi") {
      return `यह एक आपातकालीन स्थिति है। मरीज को तुरंत नजदीकी ${facility} ले जाएं। एम्बुलेंस सहायता के लिए 108 पर कॉल करें।`;
    }
    if (lang === "ta") {
      return `இது ஒரு தீவிர அவசர நிலை. உடனடியாக நோயாளியை அருகிலுள்ள ${facility}க்கு அழைத்துச் செல்லவும். ஆம்புலன்ஸுக்கு 108ஐ அழைக்கவும்.`;
    }
    return `Immediate medical attention required. Please take the patient to the nearest ${facility} without delay. Call 108 for ambulance.`;
  }

  if (urgency === "high") {
    if (lang === "mr") {
      return `लक्षणे गंभीर स्वरूपाची आहेत. आजच नजीकच्या ${facility} येथे जाऊन वैद्यकीय तपासणी करून घ्या.`;
    }
    if (lang === "hi") {
      return `लक्षण गंभीर हैं। कृपया आज ही नजदीकी ${facility} जाकर डॉक्टर से परामर्श लें।`;
    }
    if (lang === "ta") {
      return `அறிகுறிகள் தீவிரமானவை. இன்றே அருகிலுள்ள ${facility}க்கு சென்று மருத்துவ பரிசோதனை செய்து கொள்ளவும்.`;
    }
    return `Serious symptoms observed. Please visit your nearest ${facility} today for medical examination.`;
  }

  if (urgency === "medium") {
    if (recommendedAction?.startsWith("No rule matched")) {
      if (lang === "mr") {
        return `नोंदवलेल्या लक्षणांवरून स्पष्ट अंदाज बांधता येत नाही. खात्री करण्यासाठी कृपया आशा ताईंशी संपर्क साधा किंवा ${facility} येथे भेट द्या.`;
      }
      if (lang === "hi") {
        return `बताए गए लक्षणों से स्थिति पूरी तरह स्पष्ट नहीं है। कृपया अपनी आशा कार्यकर्ता से संपर्क करें या ${facility} जाएं।`;
      }
      if (lang === "ta") {
        return `அறிகுறிகளின் அடிப்படையில் முழுமையான கணிப்பு செய்ய முடியவில்லை. தயவுசெய்து உங்கள் ASHA ஊழியரை அணுகவும் அல்லது ${facility} செல்லவும்.`;
      }
      return `Symptoms cannot be definitively assessed from the inputs. Please consult your ASHA worker or visit ${facility} for an in-person check.`;
    }

    if (lang === "mr") {
      return `वैद्यकीय तपासणी आवश्यक आहे. पुढील १ ते २ दिवसांत ${facility} येथे जाऊन औषधोपचार घ्या.`;
    }
    if (lang === "hi") {
      return `डॉक्टरी जांच की आवश्यकता है। अगले 1-2 दिनों में ${facility} जाकर उपचार कराएं।`;
    }
    if (lang === "ta") {
      return `மருத்துவ பரிசோதனை தேவைப்படுகிறது. அடுத்த 1-2 நாட்களில் ${facility}க்கு சென்று சிகிச்சை பெறவும்.`;
    }
    return `Medical checkup recommended. Please visit ${facility} within 1-2 days for evaluation and treatment.`;
  }

  // LOW
  if (lang === "mr") {
    return `लक्षणे सौम्य आहेत. घरगुती काळजी, विश्रांती आणि भरपूर पाणी घ्या. ३ दिवसांत फरक न पडल्यास आशा ताईंशी संपर्क साधा.`;
  }
  if (lang === "hi") {
    return `लक्षण हल्के हैं। घर पर आराम करें और पर्याप्त पानी पिएं। यदि 3 दिनों में सुधार न हो, तो आशा कार्यकर्ता से संपर्क करें।`;
  }
  if (lang === "ta") {
    return `அறிகுறிகள் லேசானவை. வீட்டில் ஓய்வு எடுத்து போதுமான திரவங்களை உட்கொள்ளவும். 3 நாட்களில் குணமாகவில்லை என்றால் ASHA ஊழியரை அணுகவும்.`;
  }
  return `Mild symptoms observed. Continue home rest and adequate fluids. If not improved in 3 days, consult your ASHA worker.`;
}

export function evaluateOfflineTriage(
  request: TriageEvaluationRequest
): TriageEvaluationResponse {
  const lang: Language = request.language || "mr";
  const s = new Set(request.symptoms);
  const now = new Date().toISOString();

  // Normalize / Expand common and UI catalog symptom aliases
  if (s.has("loose_stools_diarrhea") || s.has("loose_motions") || s.has("diarrhea") || s.has("watery_stool") || s.has("loose_stools")) {
    s.add("diarrhea");
    s.add("loose_motions");
    s.add("abdominal_pain_or_loose_motions_gt_3_episodes");
  }
  if (s.has("vomiting_nausea") || s.has("nausea") || s.has("vomiting") || s.has("persistent_vomiting")) {
    s.add("vomiting");
    s.add("persistent_vomiting");
    s.add("abdominal_pain_or_loose_motions_gt_3_episodes");
  }
  if (s.has("vomiting_diarrhea")) {
    s.add("diarrhea");
    s.add("vomiting");
    s.add("persistent_vomiting");
    s.add("loose_motions");
    s.add("abdominal_pain_or_loose_motions_gt_3_episodes");
  }
  if (
    s.has("abdominal_pain") ||
    s.has("persistent_or_severe_abdominal_pain_or_tenderness") ||
    s.has("continuous_severe_abdominal_pain") ||
    s.has("stomach_pain") ||
    s.has("abdominal_distension_or_swelling")
  ) {
    s.add("abdominal_pain");
    s.add("abdominal_pain_or_loose_motions_gt_3_episodes");
    s.add("persistent_or_severe_abdominal_pain_or_tenderness");
  }
  if (s.has("severe_headache") || s.has("headache") || s.has("dizziness") || s.has("giddiness")) {
    s.add("headache_or_dizziness");
  }
  if (s.has("cold_runny_nose") || s.has("runny_nose") || s.has("mild_cough") || s.has("cough") || s.has("sore_throat")) {
    s.add("cough");
    s.add("low_risk_cough_or_cold");
  }
  if (s.has("severe_breathlessness") || s.has("breathlessness_at_rest")) {
    s.add("breathlessness");
    s.add("breathlessness_at_rest");
    s.add("difficult_breathing");
  }
  if (s.has("breathlessness") || s.has("shortness_of_breath")) {
    s.add("breathlessness");
    s.add("difficult_breathing");
  }
  if (s.has("body_pain_weakness") || s.has("weakness") || s.has("fatigue") || s.has("body_ache") || s.has("tiredness")) {
    s.add("minor_symptoms_of_existing_illness");
    s.add("fatigue");
  }
  if (s.has("high_fever")) {
    s.add("fever");
    s.add("high_fever");
  }
  if (s.has("fever_with_chills") || s.has("chills_and_rigors")) {
    s.add("fever");
    s.add("chills_and_rigors");
  }
  if (s.has("fever_more_than_2_weeks")) {
    s.add("fever");
    s.add("fever_lasting_more_than_7_days");
  }
  if (s.has("severe_chest_pain_radiating_to_arm_or_jaw")) {
    s.add("chest_pain");
  }
  if (s.has("stridor_in_children") || s.has("stridor")) {
    s.add("noisy_breathing_or_stridor");
  }
  if (s.has("not_able_to_drink_or_feed") || s.has("not_able_to_feed")) {
    s.add("not_able_to_drink_or_drinking_poorly");
    s.add("unable_to_drink_or_breastfeed");
  }
  if (s.has("lethargic_or_unconscious") || s.has("unconscious") || s.has("confusion")) {
    s.add("altered_sensorium");
    s.add("lethargic_or_unconscious");
  }
  if (s.has("convulsions") || s.has("fits") || s.has("seizures")) {
    s.add("active_seizure");
    s.add("convulsions");
  }
  if (s.has("severe_headache_pregnancy") || s.has("blurred_vision_pregnancy")) {
    s.add("severe_headache_with_blurred_vision_or_spots");
    s.add("headache_or_dizziness");
    s.add("headache");
    s.add("dizziness");
  }
  if (s.has("heavy_bleeding_postpartum")) {
    s.add("heavy_bleeding_after_delivery");
    s.add("abnormal_bleeding_per_vagina");
    s.add("severe_bleeding_after_delivery");
    s.add("severe_bleeding_pads_soaked_quickly");
  }
  if (s.has("eclampsia_seizures")) {
    s.add("active_seizure");
    s.add("convulsions");
    s.add("convulsions_or_fits");
    s.add("convulsions_after_delivery");
  }
  if (s.has("burn_special_area_hands_face_perineum_or_airway") || s.has("major_burn") || s.has("burns")) {
    s.add("burn_special_area_hands_face_perineum_or_airway");
    s.add("major_burn");
  }
  if (s.has("fracture_with_exposed_bone")) {
    s.add("fracture_with_exposed_bone");
    s.add("uncontrolled_bleeding_or_deep_wound");
  }
  if (s.has("snake_or_scorpion_bite") || s.has("snake_bite") || s.has("scorpion_bite")) {
    s.add("snake_or_scorpion_bite");
  }
  if (s.has("restlessness_or_sudden_behavioral_change") || s.has("restlessness") || s.has("agitated")) {
    s.add("restlessness_or_sudden_behavioral_change");
  }
  if (s.has("persistent_vomiting") || s.has("vomiting")) {
    s.add("persistent_vomiting");
    s.add("vomiting");
  }
  if (s.has("burning_micturition") || s.has("painful_urination") || s.has("dysuria")) {
    s.add("burning_micturition");
    s.add("unable_to_pass_urine");
  }
  if (s.has("skin_rash") || s.has("rash")) {
    s.add("simple_skin_rash");
  }
  if (s.has("pallor_or_pale_skin_or_conjunctiva") || s.has("pallor")) {
    s.add("pallor");
    s.add("pallor_or_known_anaemia_needing_transfusion");
  }
  if (s.has("significant_weight_loss")) {
    s.add("weight_loss");
    s.add("minor_symptoms_of_existing_illness");
  }

  // =========================================================================
  // 49 CLINICAL RULES (STRICT 1:1 ORDER WITH rules_engine.py)
  // =========================================================================

  // 1. R-EMG-001: NHM IMNCI 2023 Module, Sec 5.1 — General Danger Signs
  if (isChild2moTo5yr(request) && GENERAL_DANGER_SIGNS.some((sig) => s.has(sig))) {
    const action = "General danger sign present (IMNCI). Complete assessment and give any pre-referral treatment immediately — refer URGENTLY to hospital.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-001"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 2. R-EMG-002: NHM IMNCI 2023 Module — Severe Pneumonia / Very Severe Disease
  if (
    (s.has("breathlessness") || s.has("difficult_breathing")) &&
    (s.has("chest_indrawing") || (request.vitals?.spo2_percent != null && request.vitals.spo2_percent < 90))
  ) {
    const action = "Chest indrawing or SpO2 < 90% with breathing difficulty — classify as Severe Pneumonia/Very Severe Disease per IMNCI. Refer urgently.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-002"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 3. R-EMG-003: NHM IMNCI 2023 Chart Booklet — Severe Dehydration (child)
  if (
    isChild2moTo5yr(request) &&
    [
      "lethargic_or_unconscious",
      "sunken_eyes",
      "not_able_to_drink_or_drinking_poorly",
      "skin_pinch_goes_back_very_slowly",
    ].filter((sig) => s.has(sig)).length >= 2
  ) {
    const action = "SEVERE DEHYDRATION (2+ signs) per IMNCI. Refer urgently. Give ORS sips en route if able to drink — do not delay referral to attempt rehydration at home.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-003"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 4. R-EMG-004: NHM IMNCI 2023 Module — Severe Dehydration (young infant)
  if (
    isYoungInfant(request) &&
    [
      "movement_only_when_stimulated_or_none",
      "sunken_eyes",
      "skin_pinch_goes_back_very_slowly",
    ].filter((sig) => s.has(sig)).length >= 2
  ) {
    const action = "SEVERE DEHYDRATION (young infant, 2+ signs) per IMNCI. Refer urgently.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-004"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 5. R-EMG-005: NHM IMNCI 2023 Chart Booklet — Very Severe Febrile Disease
  if (s.has("fever") && (GENERAL_DANGER_SIGNS.some((sig) => s.has(sig)) || s.has("stiff_neck"))) {
    const action = "VERY SEVERE FEBRILE DISEASE (danger sign or stiff neck + fever) per IMNCI. Give first dose of appropriate antimalarial and antibiotic before urgent referral.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-005"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 6. R-EMG-006: NHM IMNCI 2023 Chart Booklet — Mastoiditis
  if (s.has("tender_swelling_behind_ear")) {
    const action = "MASTOIDITIS per IMNCI. Give first dose of antibiotic and paracetamol for pain before urgent referral.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-006"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 7. R-EMG-007: ASHA Module 6 (NHM/MoHFW), Part B Sec 4 — Pregnancy Danger Signs
  if (
    request.is_pregnant === true &&
    [
      "bleeding_from_vagina_any_amount",
      "loss_of_foetal_movement_or_severe_abdominal_pain",
      "severe_headache_with_blurred_vision_or_spots",
      "swollen_face_or_hands_pitting_oedema",
      "convulsions_or_fits",
    ].some((sig) => s.has(sig))
  ) {
    const action = "Antenatal danger sign per ASHA Module 6 — facilitate IMMEDIATE referral to a facility equipped for obstetric complications (surgery/blood transfusion capability).";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-007"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 8. R-EMG-008: ASHA Module 6 (NHM/MoHFW), Part B Sec 4 — Labour & Delivery Danger Signs
  if (
    request.is_pregnant === true &&
    [
      "bleeding_fresh_blood",
      "swollen_face_or_hands",
      "baby_lying_sideways_malpresentation",
      "water_broke_no_labour_within_24h",
      "liquor_colour_green_or_brown",
      "prolonged_labour_pushing_gt_12h_or_gt_8h_multipara",
      "retained_placenta",
    ].some((sig) => s.has(sig))
  ) {
    const action = "Intrapartum danger sign per ASHA Module 6 — shift mother immediately to a facility able to manage obstetric emergencies.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-008"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 9. R-EMG-009: ASHA Module 6 (NHM/MoHFW), Part B Sec 6 — Postpartum Excessive Bleeding
  if (
    (request.is_postpartum === true || (request as any).is_postpartum) &&
    s.has("more_than_5_pads_per_day_or_1_thick_cloth_per_day")
  ) {
    const action = "POSTPARTUM HAEMORRHAGE — most urgent per ASHA Module 6. Refer immediately; advise mother to begin breastfeeding immediately while arranging transport (helps reduce bleeding). Even a few minutes' delay can matter.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-009"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 10. R-EMG-010: ASHA Module 6 (NHM/MoHFW), Part B Sec 6 — Postpartum Convulsions
  if (
    (request.is_postpartum === true || (request as any).is_postpartum) &&
    [
      "convulsions",
      "fits",
      "swelling_face_or_hands",
      "severe_headache",
      "blurred_vision",
    ].some((sig) => s.has(sig))
  ) {
    const action = "Postpartum convulsions / pre-eclampsia sign per ASHA Module 6. Immediate referral — if ANM reachable within 15 minutes, she may stabilise before referral.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-010"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 11. R-EMG-011: SBA Guidelines (MoHFW/NHM), Module I Box 7 — FRU-tier danger signs
  if (
    request.is_pregnant === true &&
    [
      "malpresentation",
      "multiple_pregnancy",
      "bleeding_pad_soaked_lt_5_min",
      "haemoglobin_lt_7",
      "convulsions_or_loss_of_consciousness",
      "decreased_or_absent_foetal_movements",
      "severe_headache_with_blurred_vision_or_spots",
    ].some((sig) => s.has(sig))
  ) {
    const action = "Refer to FRU (First Referral Unit) — facility with blood transfusion and surgical capability, per SBA Guidelines Box 7.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-011"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 12. R-EMG-013: SBA Guidelines (MoHFW/NHM), Module I Box 7 — Premature Rupture of Membranes
  if (
    request.is_pregnant === true &&
    s.has("premature_rupture_of_membranes_before_37_weeks")
  ) {
    const action = "Premature Rupture of Membranes before 37 weeks — Visit FRU per SBA Guidelines Box 7. Refer immediately.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-013"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 13. R-EMG-014: SBA Guidelines (MoHFW/NHM), Module I Box 7 — Temperature more than 38°C
  if (
    request.is_pregnant === true &&
    request.vitals?.temperature_celsius != null &&
    request.vitals.temperature_celsius > 38.0
  ) {
    const action = "Temperature above 38°C during pregnancy/labour — Visit FRU per SBA Guidelines Box 7. Refer immediately.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-014"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 14. R-EMG-015: SBA Guidelines (MoHFW/NHM), Module I Box 7 — Ruptured membranes for more than 18 hours
  if (
    request.is_pregnant === true &&
    s.has("ruptured_membranes_more_than_18h")
  ) {
    const action = "Ruptured membranes for more than 18 hours — Visit FRU per SBA Guidelines Box 7. Refer immediately (higher infection risk than the 24h no-labour-onset threshold).";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-015"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 15. R-EMG-012: NHM IMNCI 2023 Module — Young Infant: fast breathing (>=60/min) treated as severe
  if (isYoungInfant(request) && hasFastBreathing(request)) {
    const action = "Young infant (<2 months) with fast breathing (RR>=60/min) — classify as Severe Pneumonia or Very Severe Disease per IMNCI. Give first dose of antibiotic, keep warm, refer urgently.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-012"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 16. R-ADULT-EMG-001: Fast Track / RED medical (Annexure 4 p.51)
  if (isOutsideImnciChildBands(request) && ADULT_RED_FAST_TRACK_SYMPTOMS.some((sig) => s.has(sig))) {
    const action = "RED / Fast Track per Annexure 4. Do urgent resuscitation and basic management, refer to higher centre at the earliest — highest priority.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-ADULT-EMG-001"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 17. R-ADULT-EMG-002: Major burns (Annexure 4 p.51 + Annexure 1 p.46)
  if (isOutsideImnciChildBands(request) && hasMajorAdultBurn(request)) {
    const action = "RED — major burn (>20% BSA, special area, or age >60y) per Annexure 4/Annexure 1. Do not remove anything stuck to the skin. Refer to higher centre urgently.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-ADULT-EMG-002"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 18. R-ADULT-EMG-003: RED trauma (Annexure 4 p.51)
  if (isOutsideImnciChildBands(request) && ADULT_RED_TRAUMA_SYMPTOMS.some((sig) => s.has(sig))) {
    const action = "RED trauma per Annexure 4. Control bleeding, immobilise as appropriate, refer to higher centre at the earliest.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-ADULT-EMG-003"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 19. R-ADULT-EMG-004: Unstable vitals (Annexure 4 p.51)
  if (isOutsideImnciChildBands(request) && hasUnstableAdultVitals(request)) {
    const action = "RED — unstable vital signs per Annexure 4, regardless of presenting complaint. Secure IV line, start oxygen, monitor vitals, refer urgently.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-ADULT-EMG-004"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 20. R-MAL-EMG-001: Malaria Hyperpyrexia (NVBDCP 2009/2013)
  if (
    s.has("high_fever_gt_104f_or_40c") ||
    ((s.has("fever") || s.has("high_fever")) &&
      request.vitals?.temperature_celsius != null &&
      request.vitals.temperature_celsius >= 40.0)
  ) {
    const action = "Hyperpyrexia (temp ≥ 40°C / 104°F) — severe malaria danger sign per NVBDCP. Cold sponging, give paracetamol, urgent referral to CHC/District Hospital for parenteral therapy and RDT/microscopy.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-MAL-EMG-001"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 21. R-MAL-EMG-002: Haemoglobinuria / Blackwater fever (NVBDCP 2009/2013)
  if (s.has("dark_or_cola_coloured_urine")) {
    const action = "Dark/cola-coloured urine (haemoglobinuria / blackwater fever) — severe malaria manifestation per NVBDCP. High risk of acute renal failure. Refer immediately to District Hospital.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-MAL-EMG-002"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 22. R-ANE-EMG-001: Severe Anemia in Pregnancy Hb < 5.0 (Anemia Mukt Bharat)
  if (
    request.is_pregnant === true &&
    request.vitals?.hemoglobin_g_dl != null &&
    request.vitals.hemoglobin_g_dl < 5.0
  ) {
    const action = "Severe anaemia in pregnancy (Hb < 5.0 g/dL) per Anemia Mukt Bharat. High risk of congestive heart failure. Refer urgently to District Hospital/FRU for blood transfusion and parenteral therapy.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-ANE-EMG-001"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // =========================================================================
  // HIGH TIER
  // =========================================================================

  // 23. R-HIGH-001: Possible Serious Bacterial Infection (young infant temp >= 37.5)
  if (
    isYoungInfant(request) &&
    request.vitals?.temperature_celsius != null &&
    request.vitals.temperature_celsius >= 37.5
  ) {
    const action = "Young infant (<2 months) with axillary temperature ≥37.5°C — possible serious bacterial infection per IMNCI. Refer urgently to hospital.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "chc", lang, action),
      rule_trace: ["R-HIGH-001"],
      requires_referral: true,
      referral_target_level: "chc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 24. R-HIGH-002: SBA Guidelines Box 7 — 24-hour-PHC-tier danger signs
  if (
    request.is_pregnant === true &&
    (hasHighBP(request) ||
      [
        "high_fever_with_or_without_abdominal_pain_too_weak_to_get_out_of_bed",
        "fast_or_difficult_breathing",
        "haemoglobin_7_to_11_despite_30_days_ifa",
        "excessive_vomiting_unable_to_take_orally",
        "breathlessness_at_rest",
        "reduced_urinary_output_with_high_bp",
      ].some((sig) => s.has(sig)))
  ) {
    const action = "Refer to nearest 24-hour PHC with emergency obstetric care, per SBA Guidelines Box 7.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "phc", lang, action),
      rule_trace: ["R-HIGH-002"],
      requires_referral: true,
      referral_target_level: "phc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 25. R-HIGH-003: Puerperal Sepsis (ASHA Module 6)
  if (
    (request.is_postpartum === true || (request as any).is_postpartum) &&
    s.has("foul_smelling_discharge")
  ) {
    const action = "Suspected puerperal sepsis per ASHA Module 6. Measure temperature to confirm fever. Refer same day — mother needs antibiotics.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "chc", lang, action),
      rule_trace: ["R-HIGH-003"],
      requires_referral: true,
      referral_target_level: "chc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 26. R-HIGH-004: Pneumonia (fast breathing, no danger sign) per IMNCI
  if (
    isChild2moTo5yr(request) &&
    hasFastBreathing(request) &&
    !s.has("chest_indrawing") &&
    !GENERAL_DANGER_SIGNS.some((sig) => s.has(sig)) &&
    !(request.vitals?.spo2_percent != null && request.vitals.spo2_percent < 90)
  ) {
    const action = "PNEUMONIA (fast breathing, no danger sign) per IMNCI. Give first dose of oral antibiotic, advise home care and soothe throat/cough remedy, follow up in 2 days or sooner if worsening.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "phc", lang, action),
      rule_trace: ["R-HIGH-004"],
      requires_referral: true,
      referral_target_level: "phc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 27. R-HIGH-005: Continuous severe abdominal pain during pregnancy (SBA Guidelines Box 7)
  if (
    request.is_pregnant === true &&
    s.has("continuous_severe_abdominal_pain")
  ) {
    const action = "Continuous severe abdominal pain during pregnancy — Visit 24-hour PHC per SBA Guidelines Box 7.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "phc", lang, action),
      rule_trace: ["R-HIGH-005"],
      requires_referral: true,
      referral_target_level: "phc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 28. R-ADULT-HIGH-001: YELLOW medical (Annexure 4 p.52)
  if (isOutsideImnciChildBands(request) && ADULT_YELLOW_MEDICAL_SYMPTOMS.some((sig) => s.has(sig))) {
    const action = "YELLOW per Annexure 4 — do not let the patient deteriorate, resuscitate appropriately, plan timely referral if required.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "phc", lang, action),
      rule_trace: ["R-ADULT-HIGH-001"],
      requires_referral: true,
      referral_target_level: "phc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 29. R-ADULT-HIGH-002: YELLOW trauma (Annexure 4 p.52)
  if (
    isOutsideImnciChildBands(request) &&
    (ADULT_YELLOW_TRAUMA_SYMPTOMS.some((sig) => s.has(sig)) || (request.is_pregnant === true && s.has("injury")))
  ) {
    const action = "YELLOW trauma per Annexure 4 — stabilise, monitor, refer to higher centre if required.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "phc", lang, action),
      rule_trace: ["R-ADULT-HIGH-002"],
      requires_referral: true,
      referral_target_level: "phc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 30. R-DEN-HIGH-001: Dengue Warning Signs (NCVBDC 2023)
  if (
    (s.has("fever") || s.has("high_fever")) &&
    [
      "persistent_vomiting",
      "persistent_or_severe_abdominal_pain_or_tenderness",
      "restlessness_or_sudden_behavioral_change",
      "abdominal_distension_or_swelling",
    ].some((sig) => s.has(sig))
  ) {
    const action = "Fever with Dengue Warning Signs per NCVBDC 2023. Risk of severe dengue / plasma leakage. Refer to CHC/PHC for haematocrit and platelet monitoring and IV fluid therapy.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "chc", lang, action),
      rule_trace: ["R-DEN-HIGH-001"],
      requires_referral: true,
      referral_target_level: "chc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 31. R-ANE-HIGH-001: Severe Anemia in Pregnancy Hb 5.0-6.9 (Anemia Mukt Bharat)
  if (
    request.is_pregnant === true &&
    request.vitals?.hemoglobin_g_dl != null &&
    request.vitals.hemoglobin_g_dl >= 5.0 &&
    request.vitals.hemoglobin_g_dl < 7.0
  ) {
    const action = "Severe anaemia in pregnancy (Hb 5.0–6.9 g/dL) per Anemia Mukt Bharat. Refer to CHC/FRU for parenteral iron therapy / blood arrangement.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "chc", lang, action),
      rule_trace: ["R-ANE-HIGH-001"],
      requires_referral: true,
      referral_target_level: "chc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 32. R-ANE-HIGH-002: Severe Anemia in Children 6-59m Hb < 7.0 (Anemia Mukt Bharat)
  if (
    isChild2moTo5yr(request) &&
    request.vitals?.hemoglobin_g_dl != null &&
    request.vitals.hemoglobin_g_dl < 7.0
  ) {
    const action = "Severe anaemia in child 6–59 months (Hb < 7.0 g/dL) per Anemia Mukt Bharat. Refer to PHC/CHC for clinical evaluation and therapeutic iron supplementation.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "phc", lang, action),
      rule_trace: ["R-ANE-HIGH-002"],
      requires_referral: true,
      referral_target_level: "phc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 33. R-ANE-HIGH-003: Severe Anemia in Children 5-9y Hb < 8.0 (Anemia Mukt Bharat)
  if (
    isChild5to9yr(request) &&
    request.vitals?.hemoglobin_g_dl != null &&
    request.vitals.hemoglobin_g_dl < 8.0
  ) {
    const action = "Severe anaemia in child 5–9 years (Hb < 8.0 g/dL) per Anemia Mukt Bharat. Refer to PHC for therapeutic IFA supplementation and investigation.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "phc", lang, action),
      rule_trace: ["R-ANE-HIGH-003"],
      requires_referral: true,
      referral_target_level: "phc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 34. R-ANE-HIGH-004: Severe Anemia in Adolescents 10-19y Hb < 8.0 (Anemia Mukt Bharat)
  if (
    isAdolescent10to19yr(request) &&
    request.vitals?.hemoglobin_g_dl != null &&
    request.vitals.hemoglobin_g_dl < 8.0
  ) {
    const action = "Severe anaemia in adolescent 10–19 years (Hb < 8.0 g/dL) per Anemia Mukt Bharat. Refer to PHC for clinical workup and weekly IFA + deworming.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "phc", lang, action),
      rule_trace: ["R-ANE-HIGH-004"],
      requires_referral: true,
      referral_target_level: "phc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 35. R-ANE-HIGH-005: Severe Anemia in Non-Pregnant Women >=15y Hb < 8.0 (Anemia Mukt Bharat)
  if (
    (request.patient_sex === "female" || (request as any).sex === "female") &&
    getAgeYears(request) >= 15.0 &&
    request.is_pregnant !== true &&
    request.vitals?.hemoglobin_g_dl != null &&
    request.vitals.hemoglobin_g_dl < 8.0
  ) {
    const action = "Severe anaemia in woman of reproductive age (Hb < 8.0 g/dL) per Anemia Mukt Bharat. Refer to PHC for evaluation and therapeutic iron administration.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "phc", lang, action),
      rule_trace: ["R-ANE-HIGH-005"],
      requires_referral: true,
      referral_target_level: "phc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // =========================================================================
  // MEDIUM TIER
  // =========================================================================

  // 36. R-MAL-MED-001: Fever with chills/rigors (NVBDCP 2009/2013)
  if (
    (s.has("fever") || s.has("high_fever")) &&
    (s.has("chills_and_rigors") || s.has("fever_with_chills"))
  ) {
    const action = "Fever with chills and rigors — suspected uncomplicated malaria per NVBDCP. Perform RDT / prepare blood smear, manage with antipyretic, refer to PHC/Health Sub-Centre for diagnosis and species-specific treatment.";
    return {
      urgency: "medium",
      recommended_action: action,
      citizen_message: buildCitizenMessage("medium", "phc", lang, action),
      rule_trace: ["R-MAL-MED-001"],
      requires_referral: true,
      referral_target_level: "phc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 37. R-TB-MED-001: Presumptive Pulmonary TB (NTEP/MoHFW)
  if (
    [
      "cough_more_than_2_weeks",
      "fever_more_than_2_weeks",
      "significant_weight_loss",
      "contact_with_known_tb_patient",
    ].some((sig) => s.has(sig))
  ) {
    const action = "Presumptive Pulmonary TB per NTEP guidelines (cough/fever > 2 weeks, weight loss, or TB contact). Refer to nearest PHC/DMC (Designated Microscopy Centre) or NAAT facility for sputum examination and chest X-ray.";
    return {
      urgency: "medium",
      recommended_action: action,
      citizen_message: buildCitizenMessage("medium", "phc", lang, action),
      rule_trace: ["R-TB-MED-001"],
      requires_referral: true,
      referral_target_level: "phc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 38. R-ANE-MED-001: Visible Pallor (Anemia Mukt Bharat)
  if (
    (s.has("pallor_or_pale_skin_or_conjunctiva") || s.has("pallor")) &&
    !(request.vitals?.hemoglobin_g_dl != null)
  ) {
    const action = "Visible clinical pallor (pale skin, conjunctiva, or nail beds) without laboratory Hb measurement. Refer to PHC for Point-of-Care hemoglobin test (digital hemoglobinometer) and IFA supplementation.";
    return {
      urgency: "medium",
      recommended_action: action,
      citizen_message: buildCitizenMessage("medium", "phc", lang, action),
      rule_trace: ["R-ANE-MED-001"],
      requires_referral: true,
      referral_target_level: "phc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 39. R-MED-001: Diarrhoea & Gastroenteritis (IMNCI / MoHFW)
  if (
    s.has("diarrhea") ||
    s.has("loose_motions") ||
    s.has("vomiting_diarrhea")
  ) {
    const action = "Acute diarrhoea / Gastroenteritis per IMNCI / MoHFW guidelines. Start ORS and extra fluids, administer Zinc (for children), monitor for danger signs, refer to PHC if not resolving.";
    return {
      urgency: "medium",
      recommended_action: action,
      citizen_message: buildCitizenMessage("medium", "phc", lang, action),
      rule_trace: ["R-MED-001"],
      requires_referral: true,
      referral_target_level: "phc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 40. R-MED-UTI-001: Dysuria / UTI (MoHFW STG)
  if (s.has("burning_micturition") || s.has("painful_urination") || s.has("dysuria")) {
    const action = "Dysuria / Suspected Urinary Tract Infection per clinical protocols. Encourage fluid intake, refer to PHC for urine examination and antibiotic treatment.";
    return {
      urgency: "medium",
      recommended_action: action,
      citizen_message: buildCitizenMessage("medium", "phc", lang, action),
      rule_trace: ["R-MED-UTI-001"],
      requires_referral: true,
      referral_target_level: "phc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 41. R-MED-GI-001: Acute Abdominal Presentation (MoHFW)
  if (
    s.has("persistent_or_severe_abdominal_pain_or_tenderness") ||
    s.has("abdominal_distension_or_swelling") ||
    s.has("abdominal_pain")
  ) {
    const action = "Acute abdominal pain / distension. Maintain fasting, avoid analgesics before clinical review, refer to PHC/CHC for surgical/medical evaluation.";
    return {
      urgency: "medium",
      recommended_action: action,
      citizen_message: buildCitizenMessage("medium", "phc", lang, action),
      rule_trace: ["R-MED-GI-001"],
      requires_referral: true,
      referral_target_level: "phc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 42. R-MED-FEVER-001: Acute Febrile Illness (ICMR 2019)
  if (
    (s.has("fever") || s.has("high_fever")) &&
    !s.has("malaria_test_positive") &&
    !s.has("malaria_test_negative") &&
    !(
      request.vitals?.temperature_celsius != null &&
      request.vitals.temperature_celsius < 38.3
    )
  ) {
    const action = buildFeverAction(request);
    return {
      urgency: "medium",
      recommended_action: action,
      citizen_message: buildCitizenMessage("medium", "phc", lang, action),
      rule_trace: ["R-MED-FEVER-001"],
      requires_referral: true,
      referral_target_level: "phc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 43. R-MED-002: Malaria (uncomplicated) per IMNCI
  if (
    s.has("fever") &&
    s.has("malaria_test_positive") &&
    !GENERAL_DANGER_SIGNS.some((sig) => s.has(sig)) &&
    !s.has("stiff_neck")
  ) {
    const action = "MALARIA (uncomplicated) per IMNCI. Give oral antimalarial. Refer if not improving or new danger signs develop.";
    return {
      urgency: "medium",
      recommended_action: action,
      citizen_message: buildCitizenMessage("medium", "phc", lang, action),
      rule_trace: ["R-MED-002"],
      requires_referral: true,
      referral_target_level: "phc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 44. R-MED-003: Acute Ear Infection per IMNCI
  if (
    (s.has("pus_draining_less_than_14_days") || s.has("ear_pain")) &&
    !s.has("pus_draining_14_days_or_more")
  ) {
    const action = "ACUTE EAR INFECTION per IMNCI. Give antibiotic course, paracetamol for pain, dry the ear by wicking. Follow up in 5 days.";
    return {
      urgency: "medium",
      recommended_action: action,
      citizen_message: buildCitizenMessage("medium", "phc", lang, action),
      rule_trace: ["R-MED-003"],
      requires_referral: true,
      referral_target_level: "phc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 45. R-MED-004: Chronic Ear Infection per IMNCI
  if (s.has("pus_draining_14_days_or_more")) {
    const action = "CHRONIC EAR INFECTION per IMNCI. Dry the ear by wicking. Refer to facility for further evaluation — do not give oral antibiotics per chronic-infection protocol.";
    return {
      urgency: "medium",
      recommended_action: action,
      citizen_message: buildCitizenMessage("medium", "phc", lang, action),
      rule_trace: ["R-MED-004"],
      requires_referral: true,
      referral_target_level: "phc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // =========================================================================
  // LOW TIER
  // =========================================================================

  // 46. R-LOW-001: No Pneumonia: Cough or Cold (IMNCI)
  if (
    s.has("cough") &&
    !s.has("chest_indrawing") &&
    !GENERAL_DANGER_SIGNS.some((sig) => s.has(sig)) &&
    !hasFastBreathing(request) &&
    !s.has("fever")
  ) {
    const action = "No general danger sign, no fast breathing or chest indrawing present. Mild symptoms — home care advice (soothe throat, keep warm, clear blocked nose), follow up if persists beyond 3 days or breathing worsens.";
    return {
      urgency: "low",
      recommended_action: action,
      citizen_message: buildCitizenMessage("low", null, lang, action),
      rule_trace: ["R-LOW-001"],
      requires_referral: false,
      referral_target_level: null,
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 47. R-LOW-002: Fever, Malaria Unlikely (IMNCI)
  if (
    s.has("fever") &&
    s.has("malaria_test_negative") &&
    !GENERAL_DANGER_SIGNS.some((sig) => s.has(sig)) &&
    !s.has("stiff_neck")
  ) {
    const action = "Fever, malaria unlikely per IMNCI. Treat visible cause of fever if any. Advise return if fever persists beyond 7 days or danger signs develop.";
    return {
      urgency: "low",
      recommended_action: action,
      citizen_message: buildCitizenMessage("low", null, lang, action),
      rule_trace: ["R-LOW-002"],
      requires_referral: false,
      referral_target_level: null,
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 48. R-LOW-003: No Ear Infection (IMNCI)
  if (
    s.has("ear_problem_reported") &&
    !s.has("ear_pain") &&
    !s.has("tender_swelling_behind_ear") &&
    !s.has("pus_draining_less_than_14_days") &&
    !s.has("pus_draining_14_days_or_more")
  ) {
    const action = "No ear infection per IMNCI. No treatment needed for ear.";
    return {
      urgency: "low",
      recommended_action: action,
      citizen_message: buildCitizenMessage("low", null, lang, action),
      rule_trace: ["R-LOW-003"],
      requires_referral: false,
      referral_target_level: null,
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 49. R-ADULT-LOW-001: Adult Universal GREEN Tier (Annexure 4 p.53)
  if (
    isOutsideImnciChildBands(request) &&
    !hasUnstableAdultVitals(request) &&
    !ADULT_RED_FAST_TRACK_SYMPTOMS.some((sig) => s.has(sig)) &&
    !ADULT_RED_TRAUMA_SYMPTOMS.some((sig) => s.has(sig)) &&
    !ADULT_YELLOW_MEDICAL_SYMPTOMS.some((sig) => s.has(sig)) &&
    !ADULT_YELLOW_TRAUMA_SYMPTOMS.some((sig) => s.has(sig)) &&
    (hasLowFeverUnder101f(request) || ADULT_GREEN_SYMPTOMS.some((sig) => s.has(sig)))
  ) {
    const action = "GREEN per Annexure 4 — manage appropriately, no observation or investigation needed. Advise follow-up in OPD if symptoms persist.";
    return {
      urgency: "low",
      recommended_action: action,
      citizen_message: buildCitizenMessage("low", null, lang, action),
      rule_trace: ["R-ADULT-LOW-001"],
      requires_referral: false,
      referral_target_level: null,
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // =========================================================================
  // HONEST FALLBACK (MEDIUM)
  // =========================================================================
  const fallbackAction = "No rule matched — flag for ASHA/doctor manual review, do not auto-clear.";
  return {
    urgency: "medium",
    recommended_action: fallbackAction,
    citizen_message: buildCitizenMessage("medium", "phc", lang, fallbackAction),
    rule_trace: ["NO_RULE_MATCHED"],
    requires_referral: true,
    referral_target_level: "phc",
    evaluated_at: now,
    is_offline_evaluation: true,
  };
}
