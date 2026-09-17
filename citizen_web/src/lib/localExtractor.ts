/**
 * localExtractor.ts
 *
 * Deterministic offline multilingual keyword/fuzzy matcher for symptom extraction.
 * Runs directly on Next.js Edge / Serverless with 0 external API dependencies.
 * Covers English, Hindi, Marathi, and Tamil (Tamil script + Tanglish + Colloquial + Phonetic).
 */

import { SYMPTOM_KEYS } from "./symptomVocab";

interface ExtractorResult {
  symptoms: string[];
  vitals_mentioned: {
    temperature_celsius?: number | null;
    pulse_bpm?: number | null;
    systolic_bp?: number | null;
    diastolic_bp?: number | null;
    respiratory_rate?: number | null;
    spo2_percent?: number | null;
  };
  duration_days?: number | null;
  _source: "deterministic_edge_nlp_matcher";
}

const KEYWORD_RULES: [string[], string][] = [
  // 1. General Danger Signs
  [
    [
      "unable to drink", "cannot drink", "drinking poorly", "not able to feed", "unable to eat", "cant swallow", "not drinking",
      "दूध पिण्यास असमर्थ", "दूध पिऊ शकत नाही", "पाणी पिऊ शकत नाही", "काही खात नाही",
      "दूध पीने में असमर्थ", "पानी नहीं पी पा रहा", "कुछ खा नहीं पा रहा",
      "பால் குடிக்க முடியவில்லை", "தண்ணீர் குடிக்க முடியவில்லை", "சாப்பிட முடியவில்லை", "விழுங்க முடியவில்லை", "குடிக்க முடியவில்லை"
    ],
    "not_able_to_drink_or_feed"
  ],
  [
    [
      "vomits everything", "vomiting everything", "throwing up everything", "cant keep anything down",
      "सर्व उलटी", "खाल्लेले सर्व उलटी होते", "पाणीही पोटात टिकत नाही",
      "सब उल्टी", "खाया पिया सब उल्टी", "पानी भी नहीं रुक रहा",
      "அனைத்தும் வாந்தி", "சாப்பிட்டதெல்லாம் வாந்தி", "எது சாப்பிட்டாலும் வாந்தி", "வாமிட் வருது எது சாப்பிட்டாலும்"
    ],
    "vomits_everything"
  ],
  [
    [
      "convulsion", "convulsions", "seizure", "seizures", "fit", "fits", "shivering badly",
      "झटके", "फेफरे", "आकडी", "फिट्स", "हातपाय थरथरणे",
      "दौरे", "झटके आना", "मिरगी",
      "வலிப்பு", "இழுப்பு", "கை கால் உதறல்", "சுன்னி", "வலிப்பு வருது"
    ],
    "convulsions"
  ],
  [
    [
      "unconscious", "lethargic", "not waking", "fainted", "fainting", "syncope", "drowsy", "dizziness", "giddiness",
      "बेशुद्ध", "सुस्त", "जागे होत नाही", "चक्कर", "भोवळ", "शुद्ध हरपणे",
      "बेहोश", "सुस्त", "होश नहीं", "चक्कर आना", "मूर्छा",
      "நினைவிழப்பு", "மயக்கம்", "மயக்கமாக", "மயக்கமாகும்", "மயங்கி", "சுயநினைவு இல்லை", "கிறுகிறுப்பு"
    ],
    "lethargic_or_unconscious"
  ],
  [
    [
      "chest indrawing", "in-drawing",
      "छाती आत ओढली", "छाती खोल जाणे",
      "छाती धंसना", "पसलियां चलना",
      "மார்பு உள்வாங்குதல்", "விலா எலும்பு உள்வாங்குதல்"
    ],
    "chest_indrawing"
  ],
  [
    [
      "stridor", "noisy breathing", "wheezing", "crowing",
      "घरघर", "खरखर", "श्वासाचा आवाज",
      "घरघराहट", "सांस में सीटी",
      "சத்தம் கொண்ட சுவாசம்", "குறட்டை போன்ற சுவாசம்", "ஈளை"
    ],
    "noisy_breathing_or_stridor"
  ],

  // 2. Respiratory & Chest
  [
    [
      "cant breathe", "cannot breathe", "can't breathe", "not breathe properly", "cant breathe properly",
      "shortness of breath", "breathless", "hard to breathe", "gasping", "asma", "asthma",
      "fast breathing", "difficult breathing", "difficulty in breathing", "breathing problem",
      "दम लागणे", "श्वास घेण्यास त्रास", "श्वास कोंडणे", "धाप लागणे", "दमा",
      "सांस फूलना", "सांस लेने में तकलीफ", "सांस की तकलीफ", "दम घुटना", "अस्थमा", "दमा",
      "மூச்சுத்திணறல்", "கடின சுவாசம்", "மூச்சு வாங்குகிறது", "மூச்சு விட சிரமம்", "மூச்சு இரைப்பு", "ஆஸ்துமா", "மூச்சு விட முடியல", "மூச்சு திணறல்"
    ],
    "difficult_breathing"
  ],
  [
    [
      "breathlessness at rest", "breathless while sitting",
      "बसल्या बसल्या दम", "विश्रांती घेताना दम",
      "बैठे बैठे सांस फूलना", "आराम करते समय भी सांस फूलना",
      "ஓய்வில் மூச்சுத்திணறல்", "சும்மா உட்கார்ந்தாலும் மூச்சு வாங்குது"
    ],
    "breathlessness_at_rest"
  ],
  [
    [
      "chest pain", "pain in chest", "chest heaviness", "chest pressure", "heart pain", "heaviness in matches",
      "poking sensation near my left side of the chest", "poking sensation near chest", "pain in left chest", "left chest pain",
      "छातीत दुखणे", "छातीत कळ", "छातीत जड वाटणे", "छातीत दुखतंय",
      "सीने में दर्द", "छाती में दर्द", "सीने में भारीपन", "दिल में दर्द",
      "மார்பு வலி", "நெஞ்சு வலி", "நெஞ்சில் பாரம்", "நெஞ்சு குத்துதல்", "நெஞ்சு வலிக்குது", "இடது பக்க நெஞ்சு வலி"
    ],
    "chest_pain"
  ],
  [
    [
      "cough", "coughing", "dry cough", "wet cough", "phlegm",
      "खोकला", "खोकणे", "कफ", "कोरडा खोकला",
      "खांसी", "खंसी", "कफ", "बलगम", "सूखी खांसी",
      "இருமல்", "இருமுவது", "சளி இருமல்", "வறட்டு இருமல்", "இருமல் வருது"
    ],
    "cough"
  ],
  [
    [
      "runny nose", "cold", "sore throat", "sneezing", "nasal congestion",
      "वाहणारे नाक", "सर्दी", "पडसे", "घसा दुखणे", "शिंका",
      "नाक बहना", "जुकाम", "सर्दी जुकाम", "गला खराब", "छींक",
      "ஜலதோஷம்", "மூக்கு ஒழுகுதல்", "தொண்டை வலி", "தும்மல்", "மூக்கடைப்பு", "சளி"
    ],
    "low_risk_cough_or_cold"
  ],
  [
    [
      "stiff neck", "neck stiffness", "cant bend neck",
      "मान ताठ", "मान दुखणे", "मान वाकवता येत नाही",
      "गर्दन अकड़ना", "गर्दन में अकड़न", "गर्दन नहीं मुड़ना",
      "கழுத்து விறைப்பு", "கழுத்து திருப்ப முடியவில்லை", "கழுத்து பிடிப்பு"
    ],
    "stiff_neck"
  ],

  // 3. Fever & Systemic
  [
    [
      "high fever", "burning fever", "very hot body", "severe fever",
      "तेज बुखार", "तीव्र ताप", "खूप ताप", "अति ताप", "अंग तापणे",
      "अत्यधिक बुखार", "तेज़ बुखार", "103 बुखार", "104 बुखार",
      "அதிக காய்ச்சல்", "கடுமையான காய்ச்சல்", "கொதிக்கும் ஜுரம்", "அதிக ஜுரம்"
    ],
    "high_fever_with_or_without_abdominal_pain_too_weak_to_get_out_of_bed"
  ],
  [
    [
      "fever", "warm body", "hot body", "temperature", "chills", "febrile",
      "ताप", "अंग गरम", "थंडी वाजून ताप", "अंगात उष्णता",
      "बुखार", "बदन गरम", "हरारत", "ठंड लगकर बुखार",
      "காய்ச்சல்", "காய்ச்ச", "ஜுரம்", "சுரம்", "உடம்பு சூடு", "உடல் சூடு", "குளிர் காய்ச்சல்", "காய்ச்சல் அடிக்குது", "காய்ச்சலா இருக்கு"
    ],
    "fever"
  ],
  [
    [
      "sugar patient", "diabetic", "diabetes", "high sugar", "sugar problem", "hiv", "chemo",
      "मधुमेह", "शुगर", "डायबिटीज", "साखर आजार",
      "मधुमेह", "शुगर की बीमारी", "शुगर पेशेंट",
      "சர்க்கரை நோய்", "சர்க்கரை வியாதி", "நீரிழிவு நோய்", "சுகர் பேஷன்ட்", "சுகர் நோயாளி"
    ],
    "fever_in_chemo_or_hiv_or_diabetic_patient"
  ],
  [
    [
      "malaria positive", "malaria test positive", "rdt positive",
      "मलेरिया पॉझिटिव्ह", "मलेरिया चाचणी पॉझिटिव्ह",
      "मलेरिया पॉजिटिव", "मलेरिया जांच पॉजिटिव",
      "மலேரியா பாசிட்டிவ்", "மலேரியா சோதனை உறுதி"
    ],
    "malaria_test_positive"
  ],
  [
    [
      "malaria negative", "malaria test negative", "rdt negative",
      "मलेरिया निगेटिव्ह", "मलेरिया चाचणी निगेटिव्ह",
      "मलेरिया नेगेटिव", "मलेरिया जांच नेगेटिव",
      "மலேரியா நெகட்டிவ்", "மலேரியா இல்லை"
    ],
    "malaria_test_negative"
  ],

  // 4. Swelling & Eyes
  [
    [
      "swelling face", "swollen face", "swollen eyes", "eyes swollen", "eyes are swollen", "swelling in eyes", "face swollen", "swollen feet", "swelling on feet", "swelling face or hands",
      "तोंडावर सूज", "डोळ्यांभोवती सूज", "पायांवर सूज", "हात पायांवर सूज", "चेहऱ्यावर सूज",
      "चेहरे पर सूजन", "आंखों में सूजन", "आंखें सूजी हुई", "पैरों में सूजन", "हाथ पैरों में सूजन",
      "முக வீக்கம்", "கண்கள் வீக்கம்", "கண் வீக்கம்", "கண்கள் வீங்கியுள்ளது", "கால் வீக்கம்", "கை கால் வீக்கம்"
    ],
    "swelling_face_or_hands"
  ],
  [
    [
      "sunken eyes", "eyes deep",
      "डोळे खोल जाणे", "डोळे आत जाणे",
      "आंखें धंसना", "आंखें अंदर जाना",
      "குழி விழுந்த கண்கள்", "கண்கள் குழிவிழுந்துள்ளது"
    ],
    "sunken_eyes"
  ],

  // 5. Gastrointestinal
  [
    [
      "diarrhea", "diarrhoea", "loose motions", "watery stools", "motions", "loose stool",
      "जुलाब", "पातळ संडास", "शौचास पातळ होणे", "पोट बिघडणे",
      "दस्त", "पतले दस्त", "पेट खराब", "लूज मोशन",
      "வயிற்றுப்போக்கு", "பேதி", "தண்ணீர் மலம்", "வயிறு சரியில்லை", "லூஸ் மோஷன்"
    ],
    "diarrhea"
  ],
  [
    [
      "vomit", "vomiting", "throwing up", "nausea", "puking",
      "उलटी", "मळमळ", "ओकारी",
      "उल्टी", "जी मिचलाना", "कै",
      "வாந்தி", "வாமிட்", "குமட்டல்", "வாந்தி வருது", "வாமிட்டிங்"
    ],
    "vomiting"
  ],
  [
    [
      "blood in stool", "bloody diarrhea", "dysentery", "red stool",
      "शौचातून रक्त", "रक्तमिश्रित जुलाब",
      "मल में खून", "खूनी दस्त", "पेचिश",
      "மலத்தில் ரத்தம்", "சீதபேதி", "ரத்த பேதி"
    ],
    "blood_in_stool"
  ],

  // 6. Maternal & Obstetric
  [
    [
      "vaginal bleeding", "bleeding per vagina", "bleeding while pregnant", "spotting pregnancy",
      "योनीतून रक्तस्त्राव", "रक्तस्त्राव गरोदरपणात",
      "योनि से रक्तस्राव", "खून बहना गर्भावस्था",
      "யோனி இரத்தப்போக்கு", "கர்ப்பத்தில் ரத்தப்போக்கு", "ரத்த கசிவு"
    ],
    "bleeding_from_vagina_any_amount"
  ],
  [
    [
      "severe headache", "blurred vision", "headache and vision",
      "तीव्र डोकेदुखी व अंधुक दिसणे", "डोकेदुखी",
      "तेज सिरदर्द और धुंधला दिखना", "सिरदर्द",
      "கடுமையான தலைவலி", "தலைவலி", "மங்கலான பார்வை", "கண் மங்கலாக தெரிகிறது"
    ],
    "headache_or_dizziness"
  ],

  // 7. Hepatic / Jaundice / Appetite
  [
    [
      "yellow eyes", "eyes turned yellow", "eyes yellow", "yellow skin", "jaundice", "yellow urine", "pale stool with yellow eyes",
      "कावीळ", "डोळे पिवळे", "पिवळे डोळे", "पिवळी लघवी",
      "पीलिया", "आंखें पीली", "पीली आंखें", "पीला पेशाब",
      "மஞ்சள் காமாலை", "மஞ்சள் கண்", "கண்கள் மஞ்சள்", "கண் மஞ்சள்", "மஞ்சள் நிற", "மஞ்சள்", "மஞ்சள் நிற சிறுநீர்", "காமாலை"
    ],
    "fever_with_headache_or_chest_pain_or_jaundice"
  ],
  [
    [
      "slight fever", "mild fever", "low fever", "light fever", "little fever",
      "बारीक ताप", "हलका ताप", "कमी ताप",
      "हल्का बुखार", "धीमा बुखार", "कम बुखार",
      "லேசான காய்ச்சல்", "சிறிய காய்ச்சல்", "மிதமான ஜுரம்"
    ],
    "fever_under_101f"
  ],
  [
    [
      "sensation not to eat", "no appetite", "loss of appetite", "dont feel like eating", "not wanting to eat", "cannot eat", "not eating", "poor appetite",
      "जेवणावर वासना नसणे", "भूक मंदावणे", "खावेसे वाटत नाही",
      "भूख न लगना", "खाने का मन न करना", "भूख खत्म होना",
      "பசியின்மை", "சாப்பிட பிடிக்கவில்லை", "சாப்பிட விருப்பமில்லை", "பசி இல்லை"
    ],
    "not_able_to_drink_or_feed"
  ]
];

export function extractSymptomsLocal(transcript: string, _lang: string = "en"): ExtractorResult {
  if (!transcript || typeof transcript !== "string") {
    return { symptoms: [], vitals_mentioned: {}, _source: "deterministic_edge_nlp_matcher" };
  }

  const textLower = transcript.toLowerCase();
  const matchedSymptoms = new Set<string>();

  for (const [keywords, symptomKey] of KEYWORD_RULES) {
    for (const kw of keywords) {
      if (textLower.includes(kw.toLowerCase())) {
        matchedSymptoms.add(symptomKey);
        break;
      }
    }
  }

  // Extract vitals via regex
  const vitals: ExtractorResult["vitals_mentioned"] = {};

  // BP regex: e.g., "140/90", "BP 130/80"
  const bpMatch = textLower.match(/(?:bp\s*)?(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (bpMatch) {
    const sbp = parseInt(bpMatch[1], 10);
    const dbp = parseInt(bpMatch[2], 10);
    if (sbp >= 60 && sbp <= 260 && dbp >= 30 && dbp <= 160) {
      vitals.systolic_bp = sbp;
      vitals.diastolic_bp = dbp;
    }
  }

  // Temp regex: e.g., "102 f", "38.5 c", "temp 101"
  const tempMatch = textLower.match(/(?:temp(?:erature)?\s*)?(\d{2,3}(?:\.\d)?)\s*(?:°?\s*(f|c)|fev)/i);
  if (tempMatch) {
    const val = parseFloat(tempMatch[1]);
    const unit = tempMatch[2]?.toLowerCase();
    if (unit === "f" || val >= 95) {
      // Fahrenheit to Celsius
      vitals.temperature_celsius = Math.round(((val - 32) * (5 / 9)) * 10) / 10;
    } else if (unit === "c" || (val >= 34 && val <= 43)) {
      vitals.temperature_celsius = val;
    }
  }

  // SpO2 regex: e.g., "spo2 94%", "oxygen 92%"
  const spo2Match = textLower.match(/(?:spo2|oxygen|o2)\s*(?:is\s*)?(\d{2,3})\s*%/i);
  if (spo2Match) {
    const sp = parseInt(spo2Match[1], 10);
    if (sp >= 50 && sp <= 100) {
      vitals.spo2_percent = sp;
    }
  }

  // Pulse regex: e.g., "pulse 88", "heart rate 92 bpm"
  const pulseMatch = textLower.match(/(?:pulse|heart\s*rate|hr)\s*(?:is\s*)?(\d{2,3})/i);
  if (pulseMatch) {
    const p = parseInt(pulseMatch[1], 10);
    if (p >= 30 && p <= 220) {
      vitals.pulse_bpm = p;
    }
  }

  // Parse duration mentioned in transcript (days)
  let duration_days: number | null = null;
  const numberWords: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    a: 1, an: 1,
    "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5, "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
    "दोन": 2, "पाच": 5, "सहा": 6, "नऊ": 9, "दहा": 10,
    "ஒரு": 1, "ஒன்று": 1, "இரண்டு": 2, "ரெண்டு": 2, "மூன்று": 3, "மூணு": 3, "நான்கு": 4, "நாலு": 4,
    "ஐந்து": 5, "அஞ்சு": 5, "ஆறு": 6, "ஏழு": 7, "எட்டு": 8, "ஒன்பது": 9, "பத்து": 10,
  };

  const numPattern = "(\\d+|" + Object.keys(numberWords).join("|") + ")";

  if (/(?:^|\s)(?:today|since\s+morning|just\s+started|आज|आज\s*से|आजपासून|सकाळपासून|இன்று|இன்னைக்கு|இன்னிக்கு|காலையிலிருந்து)(?:$|\s|[.,!])/i.test(textLower)) {
    duration_days = 0;
  } else if (/(?:^|\s)(?:yesterday|since\s+yesterday|कल\s*से|कालपासून|काल\s*झाला|நேற்று|நேத்திலிருந்து|நேத்து)(?:$|\s|[.,!])/i.test(textLower)) {
    duration_days = 1;
  } else {
    const weekRegex = new RegExp(numPattern + "\\s*(?:weeks?|हफ्ते|आठवडे|வாரம்|வாரமாக)", "i");
    const weekMatch = textLower.match(weekRegex);
    if (weekMatch) {
      const valStr = weekMatch[1];
      const num = /^\d+$/.test(valStr) ? parseInt(valStr, 10) : numberWords[valStr] || 1;
      duration_days = num * 7;
    } else {
      const dayRegex = new RegExp(numPattern + "\\s*(?:-|to)?\\s*(?:\\d+)?\\s*(?:days?|दिन|दिवस|दिवसांपासून|நாட்கள்|நாளாக|நாளா)", "i");
      const dayMatch = textLower.match(dayRegex);
      if (dayMatch) {
        const valStr = dayMatch[1];
        const num = /^\d+$/.test(valStr) ? parseInt(valStr, 10) : numberWords[valStr] || 1;
        duration_days = num;
      }
    }
  }

  return {
    symptoms: Array.from(matchedSymptoms),
    vitals_mentioned: vitals,
    duration_days,
    _source: "deterministic_edge_nlp_matcher",
  };
}
