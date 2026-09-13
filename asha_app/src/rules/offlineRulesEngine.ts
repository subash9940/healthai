/**
 * src/rules/offlineRulesEngine.ts
 *
 * 100% Offline Deterministic Rule Engine for ASHA Field Workers.
 * Direct implementation of NHM, IMNCI (2023), ASHA Module 6, SBA Box 7,
 * and Common Emergencies Annexure 4.
 *
 * Zero AI/LLM dependency for clinical safety decisions.
 */

import {
  TriageEvaluationRequest,
  TriageEvaluationResponse,
  Urgency,
  FacilityLevel,
  Language,
} from "../types";

const GENERAL_DANGER_SIGNS = [
  "not_able_to_drink_or_feed",
  "vomits_everything",
  "convulsions",
  "lethargic_or_unconscious",
];

const ADULT_RED_FAST_TRACK_SYMPTOMS = [
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

const ADULT_RED_TRAUMA_SYMPTOMS = [
  "stab_or_penetrating_injury",
  "limb_injury_with_absent_distal_pulse",
  "fracture_with_exposed_bone",
  "two_or_more_long_bone_fractures",
  "subcutaneous_crackles_or_seatbelt_mark",
  "multiple_injuries",
  "burn_percent_bsa_gt_20",
  "burn_special_area_hands_face_perineum_or_airway",
  "suspected_neck_injury",
  "suspected_spine_injury",
  "noisy_breathing_or_stridor",
  "uncontrolled_bleeding_or_deep_wound",
];

const ADULT_YELLOW_MEDICAL_SYMPTOMS = [
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

const ADULT_YELLOW_TRAUMA_SYMPTOMS = [
  "fracture_of_hand_or_feet",
  "isolated_long_bone_fracture",
  "minor_head_injury",
  "suspected_spine_injury",
];

const ADULT_GREEN_SYMPTOMS = [
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

function hasFastBreathing(r: TriageEvaluationRequest): boolean {
  if (
    r.symptoms.includes("fast_breathing") ||
    r.symptoms.includes("fast_or_difficult_breathing") ||
    r.symptoms.includes("difficult_breathing")
  ) {
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

function hasUnstableVitals(r: TriageEvaluationRequest): boolean {
  if (!r.vitals) return false;
  const v = r.vitals;
  if (v.pulse_bpm != null && (v.pulse_bpm > 140 || v.pulse_bpm < 50)) return true;
  if (v.systolic_bp != null && v.systolic_bp < 90) return true;
  if (v.spo2_percent != null && v.spo2_percent < 90) return true;
  if (v.respiratory_rate != null && (v.respiratory_rate > 35 || v.respiratory_rate < 8)) return true;
  if (v.temperature_celsius != null && (v.temperature_celsius > 40.0 || v.temperature_celsius < 35.5)) return true;
  return false;
}

function hasLowFeverUnder101f(r: TriageEvaluationRequest): boolean {
  if (r.symptoms.includes("fever_under_101f")) return true;
  if (r.vitals && r.vitals.temperature_celsius != null) {
    return r.vitals.temperature_celsius >= 37.5 && r.vitals.temperature_celsius < 38.3;
  }
  return false;
}

function buildFeverAction(r: TriageEvaluationRequest): string {
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
      district_hospital: "जिल्हा रुग्णालय किंवा उपजिल्हा रुग्णालय",
    },
    hi: {
      sub_centre: "आरोग्य उपकेंद्र / हेल्थ एंड वेलनेस सेंटर",
      phc: "प्राथमिक स्वास्थ्य केंद्र (PHC)",
      chc: "सामुदायिक स्वास्थ्य केंद्र (CHC)",
      district_hospital: "जिला अस्पताल या रेफरल अस्पताल",
    },
    en: {
      sub_centre: "Sub-Centre / Health and Wellness Centre",
      phc: "Primary Health Centre (PHC)",
      chc: "Community Health Centre (CHC)",
      district_hospital: "District Hospital or First Referral Unit (FRU)",
    },
    ta: {
      sub_centre: "துணை சுகாதார நிலையம் / நல்வாழ்வு மையம்",
      phc: "முதன்மை சுகாதார மையம் (PHC)",
      chc: "சமூக சுகாதார மையம் (CHC)",
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
    // NOTE: do NOT add "fever_with_headache_or_chest_pain_or_jaundice" here.
  }
  if (s.has("fever_with_chills") || s.has("chills_and_rigors")) {
    s.add("fever");
    s.add("chills_and_rigors");
    // NOTE: do NOT add "fever_with_headache_or_chest_pain_or_jaundice" here.
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
  // EMERGENCY TIER (RED)
  // =========================================================================

  // 1. IMNCI General Danger Signs (child 2mo - 5yr)
  if (isChild2moTo5yr(request) && GENERAL_DANGER_SIGNS.some((sig) => s.has(sig))) {
    const action = "General danger sign present (IMNCI 2023). Refer URGENTLY to hospital/FRU.";
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

  // 2. IMNCI Severe Pneumonia / Chest Indrawing or SpO2 < 90
  if (
    (s.has("breathlessness") || s.has("difficult_breathing")) &&
    (s.has("chest_indrawing") ||
      (request.vitals?.spo2_percent != null && request.vitals.spo2_percent < 90))
  ) {
    const action = "Chest indrawing or SpO2 < 90% with breathing difficulty — Severe Pneumonia. Refer urgently.";
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

  // 3. IMNCI Stridor in Calm Child
  if (
    isChild2moTo5yr(request) &&
    s.has("noisy_breathing_or_stridor") &&
    (s.has("breathlessness") || s.has("difficult_breathing"))
  ) {
    const action = "Stridor in calm child — Severe Croup / Laryngeal obstruction. Refer urgently.";
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

  // 4. IMNCI Severe Dehydration
  if (
    s.has("diarrhea") &&
    (s.has("lethargic_or_unconscious") ||
      s.has("sunken_eyes") ||
      s.has("not_able_to_drink_or_feed") ||
      s.has("skin_pinch_goes_back_very_slowly"))
  ) {
    const count = [
      s.has("lethargic_or_unconscious"),
      s.has("sunken_eyes"),
      s.has("not_able_to_drink_or_feed"),
      s.has("skin_pinch_goes_back_very_slowly"),
    ].filter(Boolean).length;
    if (count >= 2 || s.has("skin_pinch_goes_back_very_slowly")) {
      const action = "Severe Dehydration — start IV/ORS Plan C and refer urgently to hospital.";
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
  }

  // 5. Very Severe Febrile Disease (IMNCI)
  if (s.has("fever") && (GENERAL_DANGER_SIGNS.some((sig) => s.has(sig)) || s.has("stiff_neck"))) {
    const action = "Very Severe Febrile Disease / Meningitis sign per IMNCI. Refer urgently.";
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

  // 6. Mastoiditis
  if (s.has("tender_swelling_behind_ear")) {
    const action = "Tender swelling behind ear — Mastoiditis. Urgent hospital referral for IV antibiotics.";
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

  // 7. Maternal Red Flags (ASHA Module 6 / SBA Box 7)
  if (
    request.is_pregnant &&
    (s.has("bleeding_from_vagina_any_amount") ||
      s.has("loss_of_foetal_movement_or_severe_abdominal_pain") ||
      s.has("severe_headache_with_blurred_vision_or_spots") ||
      s.has("convulsions"))
  ) {
    const action = "Maternal Obstetric Emergency (APH / Pre-eclampsia / Eclampsia). Immediate FRU referral.";
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

  // 7b. Malaria Severe Danger Signs (NVBDCP)
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

  // 8. Adult Red Fast Track (Annexure 4)
  if (isOutsideImnciChildBands(request) && ADULT_RED_FAST_TRACK_SYMPTOMS.some((sig) => s.has(sig))) {
    const action = "RED / Fast Track Medical Emergency (Annexure 4). High-priority transfer to District Hospital.";
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

  // 9. Adult Red Trauma
  if (isOutsideImnciChildBands(request) && ADULT_RED_TRAUMA_SYMPTOMS.some((sig) => s.has(sig))) {
    const action = "RED / Major Trauma Emergency (Annexure 4). Stabilize airway and transfer immediately.";
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

  // 10. Unstable Vitals Red Override
  if (hasUnstableVitals(request)) {
    const action = "Physiological Instability (Critically abnormal vitals). Immediate hospital referral.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-VITALS-001"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // =========================================================================
  // HIGH TIER (YELLOW)
  // =========================================================================

  // 11. IMNCI Pneumonia (Child Fast Breathing)
  if (isChild2moTo5yr(request) && (s.has("cough") || s.has("difficult_breathing")) && hasFastBreathing(request)) {
    const action = "Pneumonia (Fast Breathing) per IMNCI. Initiate oral Amoxicillin, refer to PHC today.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "phc", lang, action),
      rule_trace: ["R-HIGH-001"],
      requires_referral: true,
      referral_target_level: "phc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 12. IMNCI Malaria High Risk
  if (s.has("fever") && s.has("malaria_test_positive")) {
    const action = "Malaria Test Positive per IMNCI. Start ACT regimen and refer to PHC.";
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

  // 13. Adult Yellow Medical Symptoms
  if (isOutsideImnciChildBands(request) && ADULT_YELLOW_MEDICAL_SYMPTOMS.some((sig) => s.has(sig))) {
    const action = "YELLOW / Medical Evaluation required at PHC/CHC within 24 hours.";
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

  // 14. Adult Yellow Trauma
  if (isOutsideImnciChildBands(request) && ADULT_YELLOW_TRAUMA_SYMPTOMS.some((sig) => s.has(sig))) {
    const action = "YELLOW / Moderate Trauma. Splint/dress injury, transfer to CHC/PHC for X-ray.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "chc", lang, action),
      rule_trace: ["R-ADULT-HIGH-002"],
      requires_referral: true,
      referral_target_level: "chc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // =========================================================================
  // MEDIUM TIER (ORANGE)
  // =========================================================================

  // 15. IMNCI Acute Ear Infection
  if (s.has("ear_pain") || s.has("pus_draining_less_than_14_days")) {
    const action = "Acute Ear Infection. Provide dry wicking, refer to PHC within 48 hours.";
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

  // 15b. Presumptive Tuberculosis (NTEP Protocol)
  if (
    s.has("cough_more_than_2_weeks") ||
    s.has("contact_with_known_tb_patient") ||
    (s.has("fever_more_than_2_weeks") && s.has("cough"))
  ) {
    const action = "Presumptive Pulmonary TB per NTEP guidelines (cough/fever > 2 weeks, weight loss, or TB contact). Refer to nearest PHC/DMC or NAAT facility for sputum examination and chest X-ray.";
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

  // 16. IMNCI Chronic Ear Infection
  if (s.has("pus_draining_14_days_or_more")) {
    const action = "Chronic Ear Infection (> 14 days). Refer to ENT specialist at CHC/Hospital.";
    return {
      urgency: "medium",
      recommended_action: action,
      citizen_message: buildCitizenMessage("medium", "chc", lang, action),
      rule_trace: ["R-MED-002"],
      requires_referral: true,
      referral_target_level: "chc",
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 17. Diarrhea with Some Dehydration (IMNCI Plan B)
  if (
    s.has("diarrhea") ||
    s.has("loose_motions") ||
    s.has("vomiting_diarrhea") ||
    (s.has("diarrhea") && s.has("vomiting"))
  ) {
    const action = "Acute diarrhoea / Gastroenteritis per IMNCI / MoHFW guidelines. Start ORS and extra fluids, administer Zinc (for children), monitor for danger signs, refer to PHC if not resolving.";
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

  // 17b. Dysuria / Urinary Tract Infection
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

  // 17c. Acute Abdominal Presentation
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

  // 17d. Acute Febrile Presentation
  // v12 FIX: Guard against <38.3C when vitals are provided (falls through to GREEN / R-ADULT-LOW-001)
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

  // =========================================================================
  // LOW TIER (GREEN)
  // =========================================================================

  // 18. IMNCI No Pneumonia / Simple Cold
  if (
    (s.has("cough") || s.has("low_risk_cough_or_cold")) &&
    !hasFastBreathing(request) &&
    !s.has("chest_indrawing")
  ) {
    const action = "No Pneumonia: Cough or Cold (IMNCI). Home remedies, soothing fluids, counsel mother.";
    return {
      urgency: "low",
      recommended_action: action,
      citizen_message: buildCitizenMessage("low", "sub_centre", lang, action),
      rule_trace: ["R-LOW-001"],
      requires_referral: false,
      referral_target_level: null,
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // 19. Adult Green Symptoms
  if (
    isOutsideImnciChildBands(request) &&
    !hasUnstableVitals(request) &&
    !ADULT_RED_FAST_TRACK_SYMPTOMS.some((sig) => s.has(sig)) &&
    !ADULT_RED_TRAUMA_SYMPTOMS.some((sig) => s.has(sig)) &&
    !ADULT_YELLOW_MEDICAL_SYMPTOMS.some((sig) => s.has(sig)) &&
    !ADULT_YELLOW_TRAUMA_SYMPTOMS.some((sig) => s.has(sig)) &&
    (hasLowFeverUnder101f(request) || ADULT_GREEN_SYMPTOMS.some((sig) => s.has(sig)))
  ) {
    const action = "GREEN / Minor illness. Advise home rest, fluids, follow up in 3 days.";
    return {
      urgency: "low",
      recommended_action: action,
      citizen_message: buildCitizenMessage("low", "sub_centre", lang, action),
      rule_trace: ["R-ADULT-LOW-001"],
      requires_referral: false,
      referral_target_level: null,
      evaluated_at: now,
      is_offline_evaluation: true,
    };
  }

  // =========================================================================
  // HONEST FALLBACK (NO RULE MATCHED)
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
