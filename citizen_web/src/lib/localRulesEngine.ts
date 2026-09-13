/**
 * localRulesEngine.ts
 *
 * In-browser & Next.js API deterministic rule engine.
 * 100% parity with backend rules_engine.py (v7).
 * Ensures zero failure rate during live hackathon demos when FastAPI backend is restarting.
 */

import { TriageRequest, TriageResponse, Urgency } from "./triageContract";

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
  "abnormal_chest_wall_movement_on_breathing",
  "subcutaneous_crackles_or_seatbelt_mark",
  "suspected_neck_injury",
  "multiple_injuries",
  "suspected_sexual_assault",
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

function getAgeYears(r: TriageRequest): number {
  const val = r.patient_age_years ?? (r as any).patient_age ?? (r as any).age_years ?? (r as any).age;
  return typeof val === "number" && !isNaN(val) ? val : 25;
}

function ageInDays(r: TriageRequest): number {
  return getAgeYears(r) * 365.25;
}

function isYoungInfant(r: TriageRequest): boolean {
  return ageInDays(r) < 60;
}

function isChild2moTo5yr(r: TriageRequest): boolean {
  const days = ageInDays(r);
  return days >= 60 && days <= 5 * 365.25;
}

function isOutsideImnciChildBands(r: TriageRequest): boolean {
  return getAgeYears(r) > 5;
}

function isChild5to9yr(r: TriageRequest): boolean {
  const age = getAgeYears(r);
  return age > 5.0 && age < 10.0;
}

function isAdolescent10to19yr(r: TriageRequest): boolean {
  const age = getAgeYears(r);
  return age >= 10.0 && age <= 19.0;
}

function hasFastBreathing(r: TriageRequest): boolean {
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

function hasHighBP(r: TriageRequest): boolean {
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

function hasUnstableAdultVitals(r: TriageRequest): boolean {
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

function hasMajorAdultBurn(r: TriageRequest): boolean {
  if (r.symptoms.includes("burn_special_area_hands_face_perineum_or_airway") || r.symptoms.includes("severe_burns_or_chemical_burn")) {
    return true;
  }
  if (r.patient_age_years > 60 && (r.symptoms.includes("burn_present") || r.symptoms.includes("burns"))) {
    return true;
  }
  if (r.symptoms.includes("burn_percent_bsa_gt_20")) {
    return true;
  }
  return false;
}

function hasLowFeverUnder101f(r: TriageRequest): boolean {
  if (r.symptoms.includes("fever_under_101f")) return true;
  if (r.vitals && r.vitals.temperature_celsius != null) {
    return r.vitals.temperature_celsius >= 37.5 && r.vitals.temperature_celsius < 38.3;
  }
  return false;
}

function buildFeverAction(r: TriageRequest): string {
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
  referralTarget: string | null | undefined,
  lang: string = "en",
  actionText: string = ""
): string {
  const isMarathi = lang === "mr";
  const isHindi = lang === "hi";
  const isTamil = lang === "ta";

  const facilityNames: Record<string, { mr: string; hi: string; ta: string; en: string }> = {
    phc: {
      mr: "तुमच्या जवळच्या प्राथमिक आरोग्य केंद्रात (PHC)",
      hi: "अपने नजदीकी प्राथमिक स्वास्थ्य केंद्र (PHC)",
      ta: "உங்கள் அருகிலுள்ள முதன்மை சுகாதார மையத்திற்கு (PHC)",
      en: "your nearest Primary Health Centre (PHC)",
    },
    chc: {
      mr: "तुमच्या जवळच्या ग्रामीण/सामुदायिक रुग्णालयात (CHC)",
      hi: "अपने नजदीकी सामुदायिक स्वास्थ्य केंद्र (CHC)",
      ta: "உங்கள் அருகிலுள்ள சமூக சுகாதார மையத்திற்கு (CHC)",
      en: "your nearest Community Health Centre (CHC)",
    },
    district_hospital: {
      mr: "जिल्हा रुग्णालय किंवा उपजिल्हा रुग्णालयात (FRU)",
      hi: "जिला अस्पताल या नजदीकी आपातकालीन केंद्र (FRU)",
      ta: "அருகிலுள்ள மாவட்ட மருத்துவமனை அல்லது முதல் பரிந்துரை பிரிவுக்கு (FRU)",
      en: "the nearest District Hospital or First Referral Unit (FRU)",
    },
  };

  const targetKey = referralTarget || "phc";
  const facility = facilityNames[targetKey]
    ? (isMarathi
        ? facilityNames[targetKey].mr
        : isHindi
        ? facilityNames[targetKey].hi
        : isTamil
        ? facilityNames[targetKey].ta
        : facilityNames[targetKey].en)
    : (isMarathi
        ? "जवळच्या आरोग्य केंद्रात"
        : isHindi
        ? "नजदीकी अस्पताल में"
        : isTamil
        ? "அருகிலுள்ள சுகாதார மையத்திற்கு"
        : "your nearest health facility");

  if (urgency === "emergency") {
    if (isMarathi) {
      return `तातडीचा वैद्यकीय धोका (आणीबाणी). कृपया विलंब न करता ताबडतोब ${facility} जा. जाण्यासाठी मदत हवी असल्यास आपल्या आशा ताईंशी संपर्क साधा किंवा १०८ रुग्णवाहिकेला फोन करा.`;
    }
    if (isHindi) {
      return `यह एक गंभीर आपातकालीन स्थिति लग रही है। कृपया तुरंत ${facility} जाएं। पहुंचने के लिए सहायता चाहिए तो अपनी आशा कार्यकर्ता से संपर्क करें या 108 एम्बुलेंस को कॉल करें।`;
    }
    if (isTamil) {
      return `இது ஒரு மருத்துவ அவசரநிலையாகத் தெரிகிறது. தயவுசெய்து உடனடியாக ${facility} செல்லுங்கள். அங்கு செல்ல உதவி தேவைப்பட்டால், உங்கள் ASHA ஊழியரைத் தொடர்புகொள்ளவும் அல்லது 108 ஆம்புலன்ஸை அழைக்கவும்.`;
    }
    return `This looks like a medical emergency. Please go to ${facility} right now. If you need help getting there, contact your ASHA worker or call 108.`;
  }

  if (urgency === "high") {
    if (isMarathi) {
      return `कृपया आजच ${facility} भेट द्या. हे काही दिवस पुढे ढकलणे धोक्याचे ठरू शकते, परंतु घाबरून जाण्याचे कारण नाही.`;
    }
    if (isHindi) {
      return `कृपया आज ही ${facility} जाएं। इसे कई दिनों तक टालना ठीक नहीं है, हालांकि अभी घबराने की आवश्यकता नहीं है।`;
    }
    if (isTamil) {
      return `தயவுசெய்து இன்றே ${facility} செல்லுங்கள். இதை பல நாட்கள் தள்ளிப்போடக் கூடாது, ஆனால் இது உடனடியாக மருத்துவமனை அவசரநிலை அல்ல.`;
    }
    return `Please visit ${facility} today. This should not wait several days, but it is not a hospital emergency right now.`;
  }

  if (urgency === "medium") {
    const isFallback = actionText.toLowerCase().includes("no rule matched") || actionText.toLowerCase().includes("flag for asha");
    if (isFallback) {
      if (isMarathi) {
        return `आपण दिलेल्या माहितीवरून अचूक निष्कर्ष काढणे शक्य नाही आणि आम्ही कोणताही खोटा अंदाज बांधू इच्छित नाही. कृपया आपल्या आशा ताईंशी संपर्क साधा किंवा ${facility} भेट द्या, जेणेकरून आरोग्य कर्मचारी आपली समक्ष तपासणी करू शकतील.`;
      }
      if (isHindi) {
        return `आपकी दी गई जानकारी के आधार पर हम कोई गलत अनुमान नहीं लगाना चाहते। कृपया अपनी आशा कार्यकर्ता से संपर्क करें या ${facility} जाएं ताकि स्वास्थ्य कर्मी प्रत्यक्ष जांच कर सकें।`;
      }
      if (isTamil) {
        return `நீங்கள் வழங்கிய தகவலின் அடிப்படையில் எங்களால் முழுமையாகக் கணிக்க முடியாது, மேலும் தவறான கணிப்புகளைச் செய்ய விரும்பவில்லை. தயவுசெய்து உங்கள் ASHA ஊழியரைத் தொடர்புகொள்ளவும் அல்லது ${facility} செல்லவும்.`;
      }
      return `We can't fully assess this from what you've told us, so we don't want to guess. Please contact your ASHA worker or visit ${facility} so a health worker can check you in person.`;
    } else {
      if (isMarathi) {
        return `वैद्यकीय तपासणी आवश्यक आहे. कृपया प्रत्यक्ष तपासणी आणि पुढील उपचारांसाठी ${facility} भेट द्या.`;
      }
      if (isHindi) {
        return `चिकित्सीय जांच आवश्यक है। कृपया प्रत्यक्ष जांच और उचित उपचार के लिए ${facility} जाएं।`;
      }
      if (isTamil) {
        return `மருத்துவ பரிசோதனை பரிந்துரைக்கப்படுகிறது. நேரில் பரிசோதனை மற்றும் தகுந்த சிகிச்சைக்காக ${facility} செல்லவும்.`;
      }
      return `Clinical assessment recommended. Please visit ${facility} for an in-person examination and prescribed treatment.`;
    }
  }

  // LOW
  if (isMarathi) {
    return `लक्षणे सौम्य आहेत. घरगुती काळजी घ्या आणि विश्रांती घ्या. ३ दिवसांत आराम न पडल्यास किंवा लक्षणे वाढल्यास आपल्या आशा ताईंशी संपर्क साधा किंवा प्राथमिक आरोग्य केंद्रात जा.`;
  }
  if (isHindi) {
    return `लक्षण हल्के हैं। घरेलू देखभाल करें व आराम करें। यदि 3 दिनों में सुधार न हो या स्थिति बिगड़े, तो अपनी आशा कार्यकर्ता से संपर्क करें या स्वास्थ्य केंद्र जाएं।`;
  }
  if (isTamil) {
    return `லேசான அறிகுறிகள் காணப்படுகின்றன. வீட்டில் கவனிப்பு, போதுமான நீர்ச்சத்து மற்றும் ஓய்வு எடுக்கவும். சில நாட்களில் குணமாகவில்லை என்றாலோ அல்லது மோசமடைந்தாலோ, உங்கள் ASHA ஊழியரைத் தொடர்புகொள்ளவும் அல்லது ${facility} செல்லவும்.`;
  }
  return `Mild symptoms observed. Continue home care, hydration, and rest. If it doesn't improve in a few days or gets worse, contact your ASHA worker or visit your nearest PHC.`;
}

export function evaluateTriage(request: TriageRequest): TriageResponse {
  const lang = request.language || "en";
  const s = new Set(request.symptoms);

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
  // EMERGENCY TIER
  // =========================================================================

  // 1. IMNCI General Danger Signs (child 2 months - 5 years)
  if (isChild2moTo5yr(request) && GENERAL_DANGER_SIGNS.some((sig) => s.has(sig))) {
    const action = "General danger sign present (IMNCI). Refer URGENTLY to hospital.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-001"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      fhir_ready: true,
    };
  }

  // 2. IMNCI Severe Pneumonia / Chest Indrawing or SpO2 < 90
  if (
    (s.has("breathlessness") || s.has("difficult_breathing")) &&
    (s.has("chest_indrawing") || (request.vitals?.spo2_percent != null && request.vitals.spo2_percent < 90))
  ) {
    const action = "Chest indrawing or SpO2 < 90% with breathing difficulty — classify as Severe Pneumonia. Refer urgently.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-002"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      fhir_ready: true,
    };
  }

  // 3. IMNCI Severe Dehydration (child 2mo-5yr, 2+ signs)
  if (isChild2moTo5yr(request)) {
    const signs = [
      "lethargic_or_unconscious",
      "sunken_eyes",
      "not_able_to_drink_or_drinking_poorly",
      "skin_pinch_goes_back_very_slowly",
    ];
    const matchCount = signs.filter((sig) => s.has(sig)).length;
    if (matchCount >= 2) {
      const action = "SEVERE DEHYDRATION (2+ signs) per IMNCI. Refer urgently.";
      return {
        urgency: "emergency",
        recommended_action: action,
        citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
        rule_trace: ["R-EMG-003"],
        requires_referral: true,
        referral_target_level: "district_hospital",
        fhir_ready: true,
      };
    }
  }

  // 4. IMNCI Severe Dehydration (young infant 0-2mo, 2+ signs)
  if (isYoungInfant(request)) {
    const infantSigns = [
      "movement_only_when_stimulated_or_none",
      "sunken_eyes",
      "skin_pinch_goes_back_very_slowly",
    ];
    const matchCount = infantSigns.filter((sig) => s.has(sig)).length;
    if (matchCount >= 2) {
      const action = "SEVERE DEHYDRATION (young infant, 2+ signs) per IMNCI. Refer urgently.";
      return {
        urgency: "emergency",
        recommended_action: action,
        citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
        rule_trace: ["R-EMG-004"],
        requires_referral: true,
        referral_target_level: "district_hospital",
        fhir_ready: true,
      };
    }
  }

  // 5. Very Severe Febrile Disease
  if (s.has("fever") && (GENERAL_DANGER_SIGNS.some((sig) => s.has(sig)) || s.has("stiff_neck"))) {
    const action = "VERY SEVERE FEBRILE DISEASE (danger sign or stiff neck + fever) per IMNCI. Refer urgently.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-005"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      fhir_ready: true,
    };
  }

  // 6. Mastoiditis
  if (s.has("tender_swelling_behind_ear")) {
    const action = "MASTOIDITIS per IMNCI. Refer urgently.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-006"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      fhir_ready: true,
    };
  }

  // 7. Pregnancy Emergency Signs
  if (
    request.is_pregnant &&
    [
      "bleeding_from_vagina_any_amount",
      "loss_of_foetal_movement_or_severe_abdominal_pain",
      "severe_headache_with_blurred_vision_or_spots",
      "swollen_face_or_hands_pitting_oedema",
      "convulsions_or_fits",
    ].some((sig) => s.has(sig))
  ) {
    const action = "Antenatal danger sign per ASHA Module 6 — facilitate IMMEDIATE referral to a facility equipped for obstetric complications.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-007"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      fhir_ready: true,
    };
  }

  // 8. Labour & Delivery Danger Signs
  if (
    [
      "placenta_not_delivered_after_30_min",
      "severe_bleeding_after_delivery",
      "hand_or_foot_or_cord_prolapsing",
    ].some((sig) => s.has(sig))
  ) {
    const action = "Obstetric emergency in labour/delivery per ASHA Module 6. Urgent referral to FRU.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-008"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      fhir_ready: true,
    };
  }

  // 9. Postpartum Severe Bleeding or Convulsions
  if (
    request.is_postpartum &&
    ["severe_bleeding_pads_soaked_quickly", "convulsions_after_delivery"].some((sig) => s.has(sig))
  ) {
    const action = "Postpartum haemorrhage or eclampsia danger sign per ASHA Module 6. Urgent referral to FRU.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-009"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      fhir_ready: true,
    };
  }

  // 10. Young Infant Possible Serious Bacterial Infection
  if (
    isYoungInfant(request) &&
    [
      "convulsions_reported",
      "fast_breathing_60_or_more",
      "severe_chest_indrawing",
      "movement_only_when_stimulated_or_none",
    ].some((sig) => s.has(sig))
  ) {
    const action = "POSSIBLE SERIOUS BACTERIAL INFECTION (clinical sign) per IMNCI young infant module. Refer urgently.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-010"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      fhir_ready: true,
    };
  }

  // 11. Young Infant Hypothermia
  if (
    isYoungInfant(request) &&
    request.vitals?.temperature_celsius != null &&
    request.vitals.temperature_celsius < 35.5
  ) {
    const action = "Young infant (<2 months) with axillary temperature <35.5°C — hypothermia. Re-warm, refer urgently.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-EMG-011"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      fhir_ready: true,
    };
  }

  // 12. Adult / Universal RED Fast Track (Annexure 4 p.51)
  if (isOutsideImnciChildBands(request) && ADULT_RED_FAST_TRACK_SYMPTOMS.some((sig) => s.has(sig))) {
    const action = "RED / Fast Track per Annexure 4. Do urgent resuscitation and basic management, refer to higher centre at the earliest — highest priority.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-ADULT-EMG-001"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      fhir_ready: true,
    };
  }

  // 13. Adult / Universal RED Burns
  if (isOutsideImnciChildBands(request) && hasMajorAdultBurn(request)) {
    const action = "RED — major burn (>20% BSA, special area, or age >60y) per Annexure 4/Annexure 1. Refer to higher centre urgently.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-ADULT-EMG-002"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      fhir_ready: true,
    };
  }

  // 14. Adult / Universal RED Trauma
  if (isOutsideImnciChildBands(request) && ADULT_RED_TRAUMA_SYMPTOMS.some((sig) => s.has(sig))) {
    const action = "RED trauma per Annexure 4. Control bleeding, immobilise as appropriate, refer to higher centre at the earliest.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-ADULT-EMG-003"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      fhir_ready: true,
    };
  }

  // 15. Adult / Universal RED Unstable Vitals
  if (isOutsideImnciChildBands(request) && hasUnstableAdultVitals(request)) {
    const action = "RED — unstable vital signs per Annexure 4, regardless of presenting complaint. Secure IV line, start oxygen, monitor vitals, refer urgently.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-ADULT-EMG-004"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      fhir_ready: true,
    };
  }

  // --- v8: Malaria (NVBDCP 2009/2013) EMERGENCY ---
  // Hyperpyrexia (temp >= 40.0 C / 104 F)
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
      fhir_ready: true,
    };
  }

  // Haemoglobinuria / Blackwater fever
  if (s.has("dark_or_cola_coloured_urine")) {
    const action = "Dark/cola-coloured urine (haemoglobinuria / blackwater fever) — severe malaria manifestation per NVBDCP. High risk of acute renal failure. Refer immediately to District Hospital.";
    return {
      urgency: "emergency",
      recommended_action: action,
      citizen_message: buildCitizenMessage("emergency", "district_hospital", lang, action),
      rule_trace: ["R-MAL-EMG-002"],
      requires_referral: true,
      referral_target_level: "district_hospital",
      fhir_ready: true,
    };
  }

  // --- v11: Anemia Mukt Bharat EMERGENCY ---
  // Severe Anemia in Pregnancy (Hb < 5.0 g/dL)
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
      fhir_ready: true,
    };
  }

  // =========================================================================
  // HIGH TIER
  // =========================================================================

  // Young Infant fever >= 37.5
  if (isYoungInfant(request) && request.vitals?.temperature_celsius != null && request.vitals.temperature_celsius >= 37.5) {
    const action = "Young infant (<2 months) with axillary temperature ≥37.5°C — possible serious bacterial infection per IMNCI. Refer urgently to hospital.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "chc", lang, action),
      rule_trace: ["R-HIGH-001"],
      requires_referral: true,
      referral_target_level: "chc",
      fhir_ready: true,
    };
  }

  // SBA Guidelines Box 7 — 24-hour-PHC-tier danger signs
  if (
    request.is_pregnant &&
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
      fhir_ready: true,
    };
  }

  // Puerperal Sepsis
  if (request.is_postpartum && s.has("foul_smelling_discharge")) {
    const action = "Suspected puerperal sepsis per ASHA Module 6. Refer same day — mother needs antibiotics.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "chc", lang, action),
      rule_trace: ["R-HIGH-003"],
      requires_referral: true,
      referral_target_level: "chc",
      fhir_ready: true,
    };
  }

  // Child Pneumonia (fast breathing, no danger sign, no chest indrawing)
  if (
    isChild2moTo5yr(request) &&
    hasFastBreathing(request) &&
    !s.has("chest_indrawing") &&
    !GENERAL_DANGER_SIGNS.some((sig) => s.has(sig)) &&
    !(request.vitals?.spo2_percent != null && request.vitals.spo2_percent < 90)
  ) {
    const action = "PNEUMONIA (fast breathing, no danger sign, no chest indrawing) per IMNCI. Give oral amoxicillin, soothe throat, advise when to return immediately.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "phc", lang, action),
      rule_trace: ["R-HIGH-004"],
      requires_referral: true,
      referral_target_level: "phc",
      fhir_ready: true,
    };
  }

  // Severe Malnutrition
  if (isChild2moTo5yr(request) && (s.has("severe_wasting") || s.has("oedema_both_feet"))) {
    const action = "SEVERE ACUTE MALNUTRITION (severe wasting or bilateral pedal oedema) per IMNCI. Refer to Nutrition Rehabilitation Centre (NRC) / CHC.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "chc", lang, action),
      rule_trace: ["R-HIGH-005"],
      requires_referral: true,
      referral_target_level: "chc",
      fhir_ready: true,
    };
  }

  // Severe Persistent Diarrhoea
  if (
    isChild2moTo5yr(request) &&
    s.has("diarrhoea_14_days_or_more") &&
    [
      "lethargic_or_unconscious",
      "sunken_eyes",
      "not_able_to_drink_or_drinking_poorly",
      "restless_and_irritable",
      "drinks_eagerly_thirsty",
      "skin_pinch_goes_back_slowly",
      "skin_pinch_goes_back_very_slowly",
    ].some((sig) => s.has(sig))
  ) {
    const action = "SEVERE PERSISTENT DIARRHOEA per IMNCI. Treat dehydration before referral, then refer to hospital.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "chc", lang, action),
      rule_trace: ["R-HIGH-006"],
      requires_referral: true,
      referral_target_level: "chc",
      fhir_ready: true,
    };
  }

  // Dysentery (blood in stool)
  if (isChild2moTo5yr(request) && s.has("blood_in_stool")) {
    const action = "DYSENTERY (blood in stool) per IMNCI. Give ciprofloxacin for 3 days, follow up in 2 days.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "phc", lang, action),
      rule_trace: ["R-HIGH-007"],
      requires_referral: true,
      referral_target_level: "phc",
      fhir_ready: true,
    };
  }

  // Adult YELLOW Medical (Annexure 4 p.52)
  if (isOutsideImnciChildBands(request) && ADULT_YELLOW_MEDICAL_SYMPTOMS.some((sig) => s.has(sig))) {
    const action = "YELLOW medical per Annexure 4 — manage at HW/MO level, refer if condition persists or worsens.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "phc", lang, action),
      rule_trace: ["R-ADULT-HIGH-001"],
      requires_referral: true,
      referral_target_level: "phc",
      fhir_ready: true,
    };
  }

  // Adult YELLOW Trauma (Annexure 4 p.52)
  if (isOutsideImnciChildBands(request) && ADULT_YELLOW_TRAUMA_SYMPTOMS.some((sig) => s.has(sig))) {
    const action = "YELLOW trauma per Annexure 4. First aid, analgesia, splinting, refer to CHC/hospital for definitive care.";
    return {
      urgency: "high",
      recommended_action: action,
      citizen_message: buildCitizenMessage("high", "chc", lang, action),
      rule_trace: ["R-ADULT-HIGH-002"],
      requires_referral: true,
      referral_target_level: "chc",
      fhir_ready: true,
    };
  }

  // --- v9: Dengue (NCVBDC 2023) HIGH ---
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
      fhir_ready: true,
    };
  }

  // --- v11: Anemia Mukt Bharat HIGH (Severe Anemia by population band) ---
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
      fhir_ready: true,
    };
  }

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
      fhir_ready: true,
    };
  }

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
      fhir_ready: true,
    };
  }

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
      fhir_ready: true,
    };
  }

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
      fhir_ready: true,
    };
  }

  // =========================================================================
  // MEDIUM TIER
  // =========================================================================

  // Diarrhea & Gastroenteritis
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
      rule_trace: ["R-MED-001"],
      requires_referral: true,
      referral_target_level: "phc",
      fhir_ready: true,
    };
  }

  // Dysuria / Urinary Tract Infection
  if (s.has("burning_micturition") || s.has("painful_urination") || s.has("dysuria")) {
    const action = "Dysuria / Suspected Urinary Tract Infection per clinical protocols. Encourage fluid intake, refer to PHC for urine examination and antibiotic treatment.";
    return {
      urgency: "medium",
      recommended_action: action,
      citizen_message: buildCitizenMessage("medium", "phc", lang, action),
      rule_trace: ["R-MED-UTI-001"],
      requires_referral: true,
      referral_target_level: "phc",
      fhir_ready: true,
    };
  }

  // Acute Abdominal Presentation
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
      fhir_ready: true,
    };
  }

  // Acute Febrile Illness (Fever without danger signs and without known malaria test result)
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
      fhir_ready: true,
    };
  }

  // Malaria uncomplicated
  if (s.has("fever") && s.has("malaria_test_positive") && !GENERAL_DANGER_SIGNS.some((sig) => s.has(sig)) && !s.has("stiff_neck")) {
    const action = "MALARIA (uncomplicated) per IMNCI. Give oral antimalarial. Refer if not improving or new danger signs develop.";
    return {
      urgency: "medium",
      recommended_action: action,
      citizen_message: buildCitizenMessage("medium", "phc", lang, action),
      rule_trace: ["R-MED-002"],
      requires_referral: true,
      referral_target_level: "phc",
      fhir_ready: true,
    };
  }

  // Acute Ear Infection
  if ((s.has("pus_draining_less_than_14_days") || s.has("ear_pain")) && !s.has("pus_draining_14_days_or_more")) {
    const action = "ACUTE EAR INFECTION per IMNCI. Give antibiotic course, paracetamol for pain, dry the ear by wicking. Follow up in 5 days.";
    return {
      urgency: "medium",
      recommended_action: action,
      citizen_message: buildCitizenMessage("medium", "phc", lang, action),
      rule_trace: ["R-MED-003"],
      requires_referral: true,
      referral_target_level: "phc",
      fhir_ready: true,
    };
  }

  // Chronic Ear Infection
  if (s.has("pus_draining_14_days_or_more")) {
    const action = "CHRONIC EAR INFECTION per IMNCI. Dry the ear by wicking. Refer to facility for further evaluation.";
    return {
      urgency: "medium",
      recommended_action: action,
      citizen_message: buildCitizenMessage("medium", "phc", lang, action),
      rule_trace: ["R-MED-004"],
      requires_referral: true,
      referral_target_level: "phc",
      fhir_ready: true,
    };
  }

  // --- v8: Malaria (NVBDCP 2009/2013) MEDIUM ---
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
      fhir_ready: true,
    };
  }

  // --- v10: TB (NTEP/MoHFW) MEDIUM ---
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
      fhir_ready: true,
    };
  }

  // --- v11: Anemia Mukt Bharat MEDIUM (Visible Pallor fallback without Hb value) ---
  if (
    (s.has("pallor_or_pale_skin_or_conjunctiva") || s.has("pallor")) &&
    !(request.vitals?.hemoglobin_g_dl != null)
  ) {
    const action = "Clinical pallor observed without digital haemoglobin test per Anemia Mukt Bharat. Screen with digital haemoglobinometer, provide age-appropriate IFA supplementation, refer to PHC if severe.";
    return {
      urgency: "medium",
      recommended_action: action,
      citizen_message: buildCitizenMessage("medium", "phc", lang, action),
      rule_trace: ["R-ANE-MED-001"],
      requires_referral: true,
      referral_target_level: "phc",
      fhir_ready: true,
    };
  }

  // =========================================================================
  // LOW TIER
  // =========================================================================

  // Child No Pneumonia Cough or Cold
  if (
    s.has("cough") &&
    !s.has("chest_indrawing") &&
    !GENERAL_DANGER_SIGNS.some((sig) => s.has(sig)) &&
    !hasFastBreathing(request) &&
    !s.has("fever")
  ) {
    const action = "No general danger sign, no fast breathing or chest indrawing present. Mild symptoms — home care advice (soothe throat, keep warm, clear blocked nose).";
    return {
      urgency: "low",
      recommended_action: action,
      citizen_message: buildCitizenMessage("low", null, lang, action),
      rule_trace: ["R-LOW-001"],
      requires_referral: false,
      referral_target_level: null,
      fhir_ready: true,
    };
  }

  // Fever, malaria negative
  if (s.has("fever") && s.has("malaria_test_negative") && !GENERAL_DANGER_SIGNS.some((sig) => s.has(sig)) && !s.has("stiff_neck")) {
    const action = "Fever, malaria unlikely per IMNCI. Treat visible cause of fever if any.";
    return {
      urgency: "low",
      recommended_action: action,
      citizen_message: buildCitizenMessage("low", null, lang, action),
      rule_trace: ["R-LOW-002"],
      requires_referral: false,
      referral_target_level: null,
      fhir_ready: true,
    };
  }

  // Adult Universal GREEN Tier
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
      fhir_ready: true,
    };
  }

  // =========================================================================
  // HONEST FALLBACK (MEDIUM)
  // =========================================================================
  const defaultAction = "No rule matched — flag for ASHA/doctor manual review, do not auto-clear.";
  return {
    urgency: "medium",
    recommended_action: defaultAction,
    citizen_message: buildCitizenMessage("medium", "phc", lang, defaultAction),
    rule_trace: ["NO_RULE_MATCHED"],
    requires_referral: true,
    referral_target_level: "phc",
    fhir_ready: true,
  };
}
