/**
 * src/constants/symptoms.ts
 *
 * Frontline ASHA Screening Symptom Catalog.
 * Aligned with IMNCI, ASHA Module 6, SBA Box 7, and Common Emergencies.
 */

import { Language } from "../types";

export interface SymptomItem {
  id: string;
  isDangerSign: boolean;
  category: "danger" | "respiratory" | "fever" | "digestive" | "maternal" | "adult_emergency" | "ear" | "trauma";
  labels: Record<Language, string>;
  description: Record<Language, string>;
  applicableSex?: "female" | "all";
  onlyPregnantOrPostpartum?: boolean;
  maxAgeYears?: number;
  minAgeYears?: number;
}

export const ASHA_SYMPTOMS: SymptomItem[] = [
  // 1. General Danger Signs (IMNCI)
  {
    id: "not_able_to_drink_or_feed",
    isDangerSign: true,
    category: "danger",
    labels: {
      mr: "दूध किंवा पाणी पिण्यास असमर्थ",
      hi: "दूध या पानी पीने में असमर्थ",
      en: "Unable to drink or feed",
      ta: "பால் அல்லது தண்ணீர் குடிக்க இயலாமை",
    },
    description: {
      mr: "मूल किंवा रुग्ण काहीही पिऊ शकत नाही",
      hi: "मरीज कुछ भी पी या खा नहीं पा रहा",
      en: "Patient cannot retain any fluids or breastfeed",
      ta: "திரவங்களை உட்கொள்ள இயலாத நிலை",
    },
  },
  {
    id: "vomits_everything",
    isDangerSign: true,
    category: "danger",
    labels: {
      mr: "खाल्लेले सर्व उलटून पडणे",
      hi: "खाया-पिया सब कुछ उल्टी होना",
      en: "Vomiting everything",
      ta: "சாப்பிட்ட அனைத்தும் வாந்தியாகுதல்",
    },
    description: {
      mr: "पाणीही पोटात राहत नाही",
      hi: "पानी भी पेट में नहीं रुकता",
      en: "Inability to keep anything down",
      ta: "தண்ணீரும் வயிற்றில் தங்காத நிலை",
    },
  },
  {
    id: "convulsions",
    isDangerSign: true,
    category: "danger",
    labels: {
      mr: "झटके, आकडी किंवा फेफरे (Fits)",
      hi: "दौरे या झटके आना (Fits)",
      en: "Convulsions or seizures / fits",
      ta: "வலிப்பு / இழுப்பு / கை கால் உதறல்",
    },
    description: {
      mr: "हात-पाय ताठ होणे किंवा थरथरणे",
      hi: "शरीर अकड़ना या दौरे पड़ना",
      en: "Muscle spasms, jerking, or fits",
      ta: "தசைப்பிடிப்பு மற்றும் நடுக்கம்",
    },
  },
  {
    id: "lethargic_or_unconscious",
    isDangerSign: true,
    category: "danger",
    labels: {
      mr: "अतिसुस्त किंवा बेशुद्ध (Unresponsive)",
      hi: "अत्यधिक सुस्त या बेहोश",
      en: "Lethargic, drowsy or unconscious",
      ta: "மயக்கம் அல்லது பதிலளிக்காத நிலை",
    },
    description: {
      mr: "हाक मारल्यावर डोळे उघडत नाही",
      hi: "बुलाने पर भी होश में न आना",
      en: "Does not wake or respond normally",
      ta: "அசைவு அல்லது சுயநினைவற்ற நிலை",
    },
  },
  {
    id: "altered_sensorium",
    isDangerSign: true,
    category: "danger",
    labels: {
      mr: "गोंधळलेली अवस्था, अतिसुस्ती किंवा ओळखता न येणे",
      hi: "भ्रम, अत्यधिक सुस्ती, पहचान न पाना या मानसिक स्थिति में बदलाव",
      en: "Confusion, drowsiness, disorientation, or altered mental state",
      ta: "குழப்பம், மயக்க நிலை, சுயநினைவின்மை அல்லது மனநிலையில் திடீர் மாற்றம்",
    },
    description: {
      mr: "मेंदू किंवा चयापचयातील गंभीर बिघाड, तात्काळ संदर्भ आवश्यक",
      hi: "मानसिक स्थिति में गंभीर बदलाव, तत्काल अस्पताल रेफरल आवश्यक",
      en: "Severe neurological compromise or metabolic crisis",
      ta: "தீவிர நரம்பியல் பிரச்சனை அல்லது மருத்துவ அவசரநிலை",
    },
  },
  {
    id: "restlessness_or_sudden_behavioral_change",
    isDangerSign: false,
    category: "danger",
    labels: {
      mr: "अतिअस्वस्थता, चिडचिड किंवा वर्तनात अचानक बदल",
      hi: "अत्यधिक बेचैनी, चिड़चिड़ापन या व्यवहार में अचानक बदलाव",
      en: "Extreme restlessness, irritability, or sudden behavioral change",
      ta: "தீவிர அமைதியின்மை அல்லது திடீர் நடத்தை மாற்றம்",
    },
    description: {
      mr: "ऑक्सिजनची कमतरता किंवा शॉकचे प्रारंभिक लक्षण",
      hi: "गंभीर बेचैनी या स्वभाव में अचानक परिवर्तन, हाइपोक्सिया या शॉक का प्रारंभिक संकेत",
      en: "Early sign of cerebral hypoperfusion, severe hypoxia, or systemic shock",
      ta: "ஆக்ஸிஜன் குறைவு அல்லது தீவிர சோர்வின் தொடக்க அறிகுறி",
    },
  },
  {
    id: "snake_or_scorpion_bite",
    isDangerSign: true,
    category: "danger",
    labels: {
      mr: "साप चावणे, विंचू चावणे किंवा विषारी कीटक चावणे",
      hi: "सांप का काटना, बिच्छू का डंक या जहरीले जीव का काटना",
      en: "Snake bite, scorpion sting, or venomous animal bite",
      ta: "பாம்பு கடி, தேள் கொடுக்கு அல்லது விஷக்கடி",
    },
    description: {
      mr: "विषबाधेचा धोका; तात्काळ अँटी स्नेक व्हेनम (ASV) उपलब्ध असलेल्या केंद्रात न्या",
      hi: "विषैला दंश, तत्काल एंटी-स्नेक वेनम (ASV) युक्त अस्पताल भेजें",
      en: "Envenomation risk; immediate Anti-Snake Venom (ASV) triage required",
      ta: "விஷமுறிவு சிகிச்சை உடனடியாக தேவை",
    },
  },

  // 2. Respiratory
  {
    id: "breathlessness",
    isDangerSign: true,
    category: "respiratory",
    labels: {
      mr: "तीव्र धाप लागणे / दम लागणे",
      hi: "गंभीर सांस फूलना / दम घुटना",
      en: "Severe breathlessness / shortness of breath",
      ta: "கடுமையான மூச்சுத்திணறல்",
    },
    description: {
      mr: "बसल्या जागीही श्वास घेताना त्रास",
      hi: "बैठे-बैठे भी सांस फूलना",
      en: "Severe breathing difficulty even at rest",
      ta: "ஓய்விலும் மூச்சு விட சிரமம்",
    },
  },
  {
    id: "chest_indrawing",
    isDangerSign: true,
    category: "respiratory",
    maxAgeYears: 5,
    labels: {
      mr: "श्वास घेताना छाती आत ओढली जाणे",
      hi: "सांस लेते समय छाती अंदर धंसना",
      en: "Chest indrawing (Lower chest sucks in)",
      ta: "மார்பு உள்வாங்குதல்",
    },
    description: {
      mr: "श्वास आत घेताना छातीचा खालचा भाग आत जातो",
      hi: "सांस अंदर खींचने पर छाती धंसती है",
      en: "Lower chest wall pulls inward on inhalation",
      ta: "சுவாசத்தின் போது மார்பு உள்நோக்கி இழுக்கப்படுதல்",
    },
  },
  {
    id: "stridor_in_children",
    isDangerSign: true,
    category: "respiratory",
    maxAgeYears: 5,
    labels: {
      mr: "शांत असताना मूल श्वास घेताना शिटीसारखा कर्कश आवाज येणे (स्ट्रायडर)",
      hi: "बच्चे के सांस अंदर लेते समय सीटी जैसी तेज आवाज आना (स्ट्राइडोर)",
      en: "Harsh whistling / noisy sound when child breathes in while calm (Stridor)",
      ta: "குழந்தை அமைதியாக இருக்கும் போது சுவாசிக்கும் விசித்திர சத்தம் (ஸ்ட்ரைடர்)",
    },
    description: {
      mr: "लहान मुलांच्या श्वासनलिकेत अडथळा, तात्काळ संदर्भ आवश्यक",
      hi: "छोटे बच्चे में श्वसन नली में रुकावट, तत्काल रेफरल आवश्यक",
      en: "Upper airway obstruction in young child requiring emergency pediatric stabilization",
      ta: "மூச்சுக்குழாய் அடைப்பு அறிகுறி",
    },
  },
  {
    id: "difficult_breathing",
    isDangerSign: false,
    category: "respiratory",
    labels: {
      mr: "जलद किंवा जड श्वासोच्छ्वास",
      hi: "तेज या भारी सांस",
      en: "Fast or noisy breathing / Asthma difficulty",
      ta: "வேகமான அல்லது சிரமமான சுவாசம்",
    },
    description: {
      mr: "सामान्य गतीपेक्षा वेगवान श्वास",
      hi: "सामान्य से अधिक गति से सांस",
      en: "Visibly rapid respiratory rate",
      ta: "வழக்கத்தை விட அதிக சுவாச வேகம்",
    },
  },
  {
    id: "cough",
    isDangerSign: false,
    category: "respiratory",
    labels: {
      mr: "खोकला",
      hi: "खांसी",
      en: "Cough",
      ta: "இருமல்",
    },
    description: {
      mr: "खोकला किंवा घसा खवखवणे",
      hi: "खांसी या गले में खराश",
      en: "Persistent or productive cough",
      ta: "தொடர் இருமல்",
    },
  },
  {
    id: "low_risk_cough_or_cold",
    isDangerSign: false,
    category: "respiratory",
    labels: {
      mr: "सर्दी, शिंका किंवा घसा खवखवणे",
      hi: "जुकाम, छींकें या गले में खराश",
      en: "Common cold, runny nose or sneezing",
      ta: "சாதாரண ஜலதோஷம், மூக்கு ஒழுகுதல் அல்லது தும்மல்",
    },
    description: {
      mr: "सौम्य सर्दी व नाक वाहणे",
      hi: "हल्की सर्दी और नाक बहना",
      en: "Mild upper respiratory symptoms / runny nose",
      ta: "லேசான சளி மற்றும் மூக்கடைப்பு அறிகுறிகள்",
    },
  },

  // 3. Fever & Infectious
  {
    id: "fever",
    isDangerSign: false,
    category: "fever",
    labels: {
      mr: "ताप (अंग गरम असणे)",
      hi: "बुखार (शरीर गर्म होना)",
      en: "Fever / Elevated body temperature",
      ta: "காய்ச்சல் / ஜுரம்",
    },
    description: {
      mr: "शरीराचे तापमान वाढलेले असणे",
      hi: "शरीर गर्म लगना या थर्मामीटर पर बुखार",
      en: "Recorded or palpable fever",
      ta: "உடல் சூடாக இருத்தல்",
    },
  },
  {
    id: "stiff_neck",
    isDangerSign: true,
    category: "fever",
    labels: {
      mr: "मान ताठ होणे (Stiff Neck)",
      hi: "गर्दन अकड़ जाना",
      en: "Stiff neck (Unable to flex chin)",
      ta: "கழுத்து விறைப்பு",
    },
    description: {
      mr: "मान वाकवताना असह्य वेदना",
      hi: "गर्दन आगे झुकाने में तेज दर्द",
      en: "Sign of meningitis or central nervous system infection",
      ta: "கழுத்தை முன்னோக்கி வளைக்க இயலாமை",
    },
  },
  {
    id: "malaria_test_positive",
    isDangerSign: false,
    category: "fever",
    labels: {
      mr: "मलेरिया RDT किट पॉझिटिव्ह",
      hi: "मलेरिया RDT किट पॉजिटिव",
      en: "Malaria RDT test positive",
      ta: "மலேரியா RDT உறுதி (பாசிட்டிவ்)",
    },
    description: {
      mr: "आशा सेविकेने केलेल्या किटमध्ये मलेरिया आढळला",
      hi: "किट जांच में मलेरिया पॉजिटिव",
      en: "Confirmed positive rapid test",
      ta: "மலேரியா பரிசோதனையில் தொற்று உறுதி",
    },
  },

  // 4. Adult Emergencies (Annexure 4)
  {
    id: "chest_pain",
    isDangerSign: true,
    category: "adult_emergency",
    labels: {
      mr: "छातीत असह्य वेदना / जडपणा (Chest Pain)",
      hi: "सीने में तेज दर्द या दबाव",
      en: "Severe chest pain / Left-arm radiation",
      ta: "மார்பு வலி / நெஞ்சில் பாரம்",
    },
    description: {
      mr: "हार्ट अटॅकचे संभाव्य लक्षण; १०८ ला तात्काळ पाचारण करा",
      hi: "दिल का दौरा संकेत; 108 बुलाएं",
      en: "Suspected acute coronary syndrome / myocardial infarction",
      ta: "மாரடைப்பு அறிகுறி; 108 அழைக்கவும்",
    },
  },
  {
    id: "severe_chest_pain_radiating_to_arm_or_jaw",
    isDangerSign: true,
    category: "adult_emergency",
    labels: {
      mr: "छातीत असह्य जडपणा/वेदना जी डावा हात, मान, पाठ किंवा जबड्याकडे पसरते",
      hi: "सीने में तेज दबाव/दर्द जो बाएं हाथ, गर्दन, पीठ या जबड़े तक फैले",
      en: "Severe crushing chest pain spreading to left arm, neck, back, or jaw",
      ta: "கடுமையான நெஞ்சு வலி இடது கை, கழுத்து, முதுகு அல்லது தாடை வரை பரவுதல்",
    },
    description: {
      mr: "हार्ट अटॅकची तीव्र शक्यता; तात्काळ ईसीजी व १०८ ॲम्ब्युलन्स आवश्यक",
      hi: "हार्ट अटैक की गंभीर आशंका, तुरंत ईसीजी और आपातकालीन रेफरल",
      en: "High likelihood of Acute Myocardial Infarction; immediate ECG, aspirin and 108 ambulance",
      ta: "மாரடைப்பு அபாயம், உடனடி மருத்துவமனை அனுமதி",
    },
  },
  {
    id: "swelling_face_or_hands",
    isDangerSign: false,
    category: "adult_emergency",
    labels: {
      mr: "तोंड, डोळे किंवा हाता-पायांवर सूज",
      hi: "चेहरे, आंखों या हाथ-पैरों पर सूजन",
      en: "Swelling in face, eyes or feet (Edema)",
      ta: "முகம், கண்கள் அல்லது கை கால் வீக்கம்",
    },
    description: {
      mr: "डोळ्यांभोवती किंवा चेहऱ्यावर सूज जाणवणे",
      hi: "आंखों या चेहरे पर असामान्य सूजन",
      en: "Noticeable edema around eyes or face",
      ta: "கண்களைச் சுற்றி அல்லது முகத்தில் வீக்கம்",
    },
  },
  {
    id: "fever_in_chemo_or_hiv_or_diabetic_patient",
    isDangerSign: false,
    category: "adult_emergency",
    labels: {
      mr: "मधुमेह (डायबिटीज / Sugar) आजारासोबत अस्वस्थता",
      hi: "मधुमेह (शुगर / Diabetes) के साथ शारीरिक परेशानी",
      en: "Diabetes / High-risk condition with active illness",
      ta: "நீரிழிவு நோய் (சுகர்) பாதிப்புடன் உடல் உபாதை",
    },
    description: {
      mr: "मधुमेहाच्या रुग्णामध्ये वाढलेली गुंतागुंत",
      hi: "शुगर के मरीज में जटिलता",
      en: "Underlying diabetes requiring clinical review",
      ta: "நீரிழிவு நோயாளிக்கு மருத்துவ பரிசோதனை தேவை",
    },
  },
  {
    id: "fever_with_headache_or_chest_pain_or_jaundice",
    isDangerSign: false,
    category: "adult_emergency",
    labels: {
      mr: "डोळे पिवळे पडणे / कावीळ लक्षणे (Yellow Eyes / Jaundice)",
      hi: "आंखें पीली होना / पीलिया के लक्षण",
      en: "Yellow eyes / Jaundice with fever or malaise",
      ta: "கண்கள் மஞ்சள் நிறமாதல் / மஞ்சள் காமாலை",
    },
    description: {
      mr: "यकृताचा संसर्ग किंवा कावीळ",
      hi: "पीलिया या लिवर संक्रमण",
      en: "Acute hepatitis or hepatic involvement",
      ta: "கல்லீரல் தொற்று அல்லது மஞ்சள் காமாலை",
    },
  },

  // 5. Maternal & Obstetric (ASHA Module 6 / SBA Box 7)
  {
    id: "bleeding_from_vagina_any_amount",
    isDangerSign: true,
    category: "maternal",
    applicableSex: "female",
    onlyPregnantOrPostpartum: true,
    labels: {
      mr: "गरोदरपणात योनीतून रक्तस्त्राव",
      hi: "गर्भावस्था में योनि से रक्तस्राव",
      en: "Vaginal bleeding during pregnancy",
      ta: "கர்ப்ப காலத்தில் யோனி இரத்தப்போக்கு",
    },
    description: {
      mr: "तातडीने उपजिल्हा/जिल्हा रुग्णालयात हलवा",
      hi: "तुरंत अस्पताल रेफर करें",
      en: "Obstetric emergency requiring immediate surgical facility",
      ta: "உடனடி அவசர மருத்துவமனை பரிந்துரை",
    },
  },
  {
    id: "loss_of_foetal_movement_or_severe_abdominal_pain",
    isDangerSign: true,
    category: "maternal",
    applicableSex: "female",
    onlyPregnantOrPostpartum: true,
    labels: {
      mr: "बाळाची हालचाल बंद होणे किंवा पोटात असह्य वेदना",
      hi: "शिशु की हलचल बंद होना या असहनीय पेट दर्द",
      en: "Loss of fetal movements or severe pain",
      ta: "கருவின் அசைவு குறைதல் அல்லது தீவிர வலி",
    },
    description: {
      mr: "गर्भस्थ बालकाचा धोका",
      hi: "गर्भ में बच्चे का न हिलना",
      en: "Compromised fetal well-being",
      ta: "கருவின் பாதுகாப்பிற்கு உடனடி கவனம்",
    },
  },
  {
    id: "severe_headache_with_blurred_vision_or_spots",
    isDangerSign: true,
    category: "maternal",
    applicableSex: "female",
    onlyPregnantOrPostpartum: true,
    labels: {
      mr: "तीव्र डोकेदुखी सोबत अंधारी येणे (Pre-eclampsia)",
      hi: "तेज सिरदर्द के साथ आंखों के आगे धुंधलापन",
      en: "Severe headache with visual disturbance",
      ta: "கடுமையான தலைவலியுடன் பார்வை மங்குதல்",
    },
    description: {
      mr: "गरोदरपणातील अतिरक्तदाब (Pre-eclampsia)",
      hi: "गर्भावस्था में उच्च रक्तचाप",
      en: "Severe pre-eclampsia / hypertensive emergency",
      ta: "கர்ப்பகால உயர் இரத்த அழுத்தம்",
    },
  },
  {
    id: "heavy_bleeding_postpartum",
    isDangerSign: true,
    category: "maternal",
    applicableSex: "female",
    onlyPregnantOrPostpartum: true,
    labels: {
      mr: "बाळंतपणानंतर अचानक जास्त रक्तस्त्राव / अनेक कपडे भिजणे (PPH)",
      hi: "प्रसव के बाद अचानक बहुत अधिक रक्तस्राव / कई कपड़े भीगना (PPH)",
      en: "Sudden heavy bleeding after delivery / soaking multiple pads (PPH)",
      ta: "பிரசவத்திற்குப் பின் திடீர் அதிக இரத்தப்போக்கு (PPH)",
    },
    description: {
      mr: "बाळंतपणानंतरचा अतिरक्तस्त्राव; तात्काळ ऑक्सिटोसिन व संदर्भ आवश्यक",
      hi: "प्रसवोत्तर गंभीर रक्तस्राव, मां के जीवन के लिए तत्काल खतरा",
      en: "Postpartum hemorrhage (PPH) is an immediate maternal life threat requiring oxytocin & urgent transfer",
      ta: "பிரசவத்திற்குப் பிந்தைய தீவிர இரத்தப்போக்கு",
    },
  },
  {
    id: "eclampsia_seizures",
    isDangerSign: true,
    category: "maternal",
    applicableSex: "female",
    onlyPregnantOrPostpartum: true,
    labels: {
      mr: "गरोदरपणात किंवा बाळंतपणानंतर झटके / फेफरे येणे (एक्लेम्पसिया)",
      hi: "गर्भावस्था में या प्रसव के बाद दौरे / झटके आना (एक्लेम्पसिया)",
      en: "Fits, seizures or convulsions during pregnancy or after delivery (Eclampsia)",
      ta: "கர்ப்ப காலத்தில் அல்லது பிரசவத்திற்குப் பின் வலிப்பு / இழுப்பு (எக்ளாம்சியா)",
    },
    description: {
      mr: "गरोदरपणातील अतिरक्तदाब व झटके, तात्काळ उच्च केंद्रात हलवा",
      hi: "गर्भावस्था में जानलेवा उच्च रक्तचाप और दौरे, तुरंत रेफरल आवश्यक",
      en: "Life-threatening hypertensive obstetric emergency requiring urgent magnesium sulfate & delivery",
      ta: "உயிருக்கு ஆபத்தான கர்ப்பகால அவசரநிலை",
    },
  },

  // 6. Digestive & Dehydration
  {
    id: "diarrhea",
    isDangerSign: false,
    category: "digestive",
    labels: {
      mr: "जुलाब / पातळ शौचास होणे",
      hi: "दस्त / पतले दस्त होना",
      en: "Diarrhea / Loose watery stools",
      ta: "வயிற்றுப்போக்கு / பேதி",
    },
    description: {
      mr: "दिवसात ३ किंवा अधिक वेळा पातळ शौचास",
      hi: "दिन में 3 या अधिक बार पतला शौच",
      en: "Frequent loose stools",
      ta: "தொடர் வயிற்றுப்போக்கு",
    },
  },
  {
    id: "sunken_eyes",
    isDangerSign: false,
    category: "digestive",
    labels: {
      mr: "डोळे खोल जाणे (Sunken Eyes)",
      hi: "आंखें अंदर धंसना (निर्जलीकरण)",
      en: "Sunken eyes (Dehydration sign)",
      ta: "குழி விழுந்த கண்கள்",
    },
    description: {
      mr: "शरीरातील पाणी कमी झाल्याचे लक्षण",
      hi: "शरीर में पानी की कमी का संकेत",
      en: "Clinical sign of fluid volume deficit",
      ta: "நீர்ச்சத்து குறைபாட்டின் அறிகுறி",
    },
  },
  {
    id: "skin_pinch_goes_back_very_slowly",
    isDangerSign: true,
    category: "digestive",
    labels: {
      mr: "पोटाची त्वचा सोडल्यावर हळू मूळ स्थितीत जाणे",
      hi: "पेट की त्वचा चुटकी में खींचने पर बहुत धीरे जाना",
      en: "Skin pinch goes back very slowly (> 2s)",
      ta: "தோல் சுருக்கம் மீள 2 வினாடிகளுக்கு மேல் ஆகுதல்",
    },
    description: {
      mr: "अति-निर्जलीकरणाचे (Severe Dehydration) स्पष्ट लक्षण",
      hi: "गंभीर निर्जलीकरण",
      en: "Hallmark of severe acute dehydration",
      ta: "தீவிர நீர்ச்சத்து இழப்பு",
    },
  },

  // 7. Ear Infections
  {
    id: "tender_swelling_behind_ear",
    isDangerSign: true,
    category: "ear",
    labels: {
      mr: "कानामागच्या भागावर सूज व तीव्र दुखणे (Mastoiditis)",
      hi: "कान के पीछे सूजन और तेज दर्द",
      en: "Tender swelling behind ear (Mastoiditis)",
      ta: "காதுக்கு பின்னால் வலி மற்றும் வீக்கம்",
    },
    description: {
      mr: "कानामागच्या हाडाचा जंतुसंसर्ग",
      hi: "कान के पीछे की हड्डी का संक्रमण",
      en: "Mastoiditis requiring prompt parenteral antibiotics",
      ta: "காது எலும்பு தீவிர தொற்று",
    },
  },
  {
    id: "ear_pain",
    isDangerSign: false,
    category: "ear",
    labels: {
      mr: "कान दुखणे",
      hi: "कान में दर्द",
      en: "Ear pain",
      ta: "காது வலி",
    },
    description: {
      mr: "कानात दुखणे किंवा ठसठस",
      hi: "कान के भीतर दर्द",
      en: "Otalgia / Ear ache",
      ta: "காதில் தொடர் வலி",
    },
  },

  // 8. Trauma & Acute Injury
  {
    id: "fracture_with_exposed_bone",
    isDangerSign: true,
    category: "trauma",
    labels: {
      mr: "हाड मोडलेले असून त्वचेबाहेर दिसणे किंवा मोठी जखम असणे (ओपन फ्रॅक्चर)",
      hi: "टूटी हुई हड्डी का त्वचा से बाहर निकलना / खुला घाव (कंपाउंड फ्रैक्चर)",
      en: "Broken bone piercing through skin / visible open wound (Compound fracture)",
      ta: "எலும்பு முறிவு தோலை கிழித்து வெளியே தெரிதல் (திறந்த எலும்பு முறிவு)",
    },
    description: {
      mr: "ओपन फ्रॅक्चर व रक्तस्त्राव; स्थिर करा व तात्काळ संदर्भ द्या",
      hi: "खुला फ्रैक्चर और गंभीर संक्रमण का खतरा, तुरंत सर्जरी सेंटर रेफर करें",
      en: "Open fracture with major hemorrhage and osteomyelitis risk; immobilize and transfer urgently",
      ta: "அவசர அறுவை சிகிச்சை தேவைப்படும் திறந்த எலும்பு முறிவு",
    },
  },
  {
    id: "burn_special_area_hands_face_perineum_or_airway",
    isDangerSign: true,
    category: "trauma",
    labels: {
      mr: "चेहरा, डोळे, हात, पाय, जननेंद्रिये किंवा श्वसनमार्ग भाजणे",
      hi: "चेहरे, आंख, हाथ, पैर, गुप्तांग या सांस की नली का जलना",
      en: "Burns on face, eyes, hands, feet, groin/genitals, or breathing airway",
      ta: "முகம், கண்கள், கைகள், கால்கள், பிறப்புறுப்பு அல்லது சுவாசப்பாதையில் தீக்காயம்",
    },
    description: {
      mr: "संवेदनशील भागावरील भाजणे, तात्काळ बर्न युनिटकडे संदर्भ आवश्यक",
      hi: "अति-संवेदनशील अंगों का जलना, तुरंत बर्न यूनिट में रेफर करें",
      en: "Critical site burn risking airway compromise, permanent contractures or severe sepsis",
      ta: "முக்கிய உறுப்புகளில் தீவிர தீக்காயம்",
    },
  },
];
