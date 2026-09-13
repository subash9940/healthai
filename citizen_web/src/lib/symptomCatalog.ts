/**
 * symptomCatalog.ts
 *
 * Sourced directly from NHM/MoHFW guidelines:
 * - IMNCI 2023 Module & Chart Booklet (Child health)
 * - ASHA Module 6 & SBA Guidelines Box 7 (Maternal & Postpartum health)
 * - Common Emergencies Annexure 4 (Adult & Elderly emergency indicators)
 */

export interface SymptomDefinition {
  id: string;
  category: "danger" | "respiratory" | "fever" | "digestive" | "maternal" | "adult_emergency" | "ear";
  isDangerSign: boolean;
  label: {
    mr: string;
    hi: string;
    en: string;
    ta: string;
  };
  description: {
    mr: string;
    hi: string;
    en: string;
    ta: string;
  };
  applicableSex?: "female" | "all";
  onlyPregnantOrPostpartum?: boolean;
}

export const SYMPTOM_CATALOG: SymptomDefinition[] = [
  // --- General Danger Signs (IMNCI / All ages) ---
  {
    id: "not_able_to_drink_or_feed",
    category: "danger",
    isDangerSign: true,
    label: {
      mr: "दूध किंवा पाणी पिण्यास पूर्णपणे असमर्थ",
      hi: "दूध या पानी पीने में पूरी तरह असमर्थ",
      en: "Unable to drink or breastfeed",
      ta: "பால் அல்லது தண்ணீர் குடிக்க முற்றிலும் முடியவில்லை",
    },
    description: {
      mr: "मूल किंवा रुग्ण काहीही पिऊ किंवा खाऊ शकत नाही",
      hi: "बच्चा या मरीज कुछ भी पी या खा नहीं पा रहा",
      en: "Patient cannot take fluids or breastmilk at all",
      ta: "நோயாளி திரவங்கள் அல்லது தாய்ப்பால் எதையும் உட்கொள்ள இயலாது",
    },
  },
  {
    id: "vomits_everything",
    category: "danger",
    isDangerSign: true,
    label: {
      mr: "खाल्लेले किंवा प्यायलेले सर्व उलटी होते",
      hi: "खाया-पिया सब कुछ उल्टी हो जाना",
      en: "Vomits everything",
      ta: "சாப்பிட்ட அல்லது குடித்த அனைத்தும் வாந்தியாகிறது",
    },
    description: {
      mr: "थोड्याही पाण्याचा किंवा अन्नाचा घोट पोटात टिकत नाही",
      hi: "पानी या खाने का एक भी घूंट पेट में नहीं रुकता",
      en: "Inability to retain any liquids or food",
      ta: "உணவோ தண்ணீரோ வயிற்றில் தங்காமல் உடனடியாக வாந்தியாகுதல்",
    },
  },
  {
    id: "convulsions",
    category: "danger",
    isDangerSign: true,
    label: {
      mr: "झटके, आकडी किंवा फेफरे येणे (Fits)",
      hi: "दौरे या झटके आना (Convulsions / Fits)",
      en: "Convulsions or seizures / fits",
      ta: "வலிப்பு / இழுப்பு / கை கால் உதறல் (Fits)",
    },
    description: {
      mr: "हात-पाय ताठ होणे किंवा थरथरणे, बेशुद्धी",
      hi: "शरीर अकड़ना, झटके आना या आंखें उलट जाना",
      en: "Involuntary muscle spasms or loss of consciousness",
      ta: "தசைப்பிடிப்பு, கை கால் இழுத்தல் அல்லது சுயநினைவு இழப்பு",
    },
  },
  {
    id: "lethargic_or_unconscious",
    category: "danger",
    isDangerSign: true,
    label: {
      mr: "अतिसुस्त, प्रतिसाद न देणे किंवा बेशुद्ध",
      hi: "अत्यधिक सुस्त, प्रतिक्रिया न देना या बेहोश",
      en: "Abnormally lethargic, unresponsive or unconscious",
      ta: "அதிக மந்தநிலை, பதிலளிக்காத நிலை அல்லது மயக்கம்",
    },
    description: {
      mr: "हाक मारल्यावर किंवा हलवल्यावर डोळे उघडत नाही",
      hi: "बुलाने या हिलाने पर भी होश में न आना",
      en: "Does not wake up or respond normally when addressed",
      ta: "அழைத்தாலோ அசைத்தாலோ கண் திறக்காத அல்லது சுயநினைவற்ற நிலை",
    },
  },

  // --- Respiratory / Breathing ---
  {
    id: "breathlessness",
    category: "respiratory",
    isDangerSign: true,
    label: {
      mr: "श्वास घेण्यास तीव्र त्रास किंवा धाप लागणे",
      hi: "सांस लेने में अत्यधिक कठिनाई या दम फूलना",
      en: "Breathlessness / Severe shortness of breath",
      ta: "கடுமையான மூச்சுத்திணறல் / மூச்சு வாங்குதல்",
    },
    description: {
      mr: "बसल्या जागीही श्वास घेताना त्रास होणे",
      hi: "बैठे-बैठे भी सांस फूलना और तकलीफ होना",
      en: "Severe breathing difficulty even at rest",
      ta: "ஓய்வாக உட்கார்ந்திருக்கும் போதும் மூச்சு விட இயலாத நிலை",
    },
  },
  {
    id: "chest_indrawing",
    category: "respiratory",
    isDangerSign: true,
    label: {
      mr: "श्वास घेताना छाती आत ओढली जाणे (Chest Indrawing)",
      hi: "सांस लेते समय छाती का अंदर धंसना",
      en: "Chest indrawing (Lower chest sucks in)",
      ta: "மூச்சு விடும்போது மார்பு கூடு உள்வாங்குதல்",
    },
    description: {
      mr: "लहान मुलांमध्ये श्वास आत घेताना छातीची खालची बाजू आत खेचली जाते",
      hi: "सांस भीतर खींचते वक्त छाती का निचला हिस्सा अंदर धंस जाता है",
      en: "Lower chest wall pulls inward abnormally on inspiration",
      ta: "மூச்சு உள்ளிழுக்கும் போது மார்பின் கீழ்ப்பகுதி உள்வாங்குவது",
    },
  },
  {
    id: "cough",
    category: "respiratory",
    isDangerSign: false,
    label: {
      mr: "खोकला",
      hi: "खांसी",
      en: "Cough",
      ta: "இருமல் (சளி அல்லது வறட்டு இருமல்)",
    },
    description: {
      mr: "सामान्य खोकला किंवा छातीत घरघर",
      hi: "सामान्य खांसी या गले में खराश",
      en: "Persistent or mild cough",
      ta: "தொடர் இருமல் அல்லது தொண்டை கரகரப்பு",
    },
  },
  {
    id: "difficult_breathing",
    category: "respiratory",
    isDangerSign: false,
    label: {
      mr: "जलद किंवा जड श्वासोच्छ्वास",
      hi: "तेज या भारी सांस चलना",
      en: "Fast or noisy breathing / Asthma difficulty",
      ta: "வேகமான அல்லது கடினமான சுவாசம் / ஆஸ்துமா சிரமம்",
    },
    description: {
      mr: "नेहमीपेक्षा वेगाने छाती हलणे",
      hi: "सामान्य से अधिक गति से सांस लेना",
      en: "Breathing visibly faster than ordinary",
      ta: "வழக்கத்தை விட வேகமாக அல்லது சிரமப்பட்டு மூச்சு வாங்குதல்",
    },
  },

  // --- Fever & Infections ---
  {
    id: "fever",
    category: "fever",
    isDangerSign: false,
    label: {
      mr: "ताप (अंगात उष्णता)",
      hi: "बुखार (शरीर गर्म होना)",
      en: "Fever (High body temperature)",
      ta: "காய்ச்சல் / ஜுரம் (உடம்பு கொதித்தல்)",
    },
    description: {
      mr: "कपाळ किंवा शरीर गरम असणे",
      hi: "शरीर गर्म लगना या थर्मामीटर पर अधिक तापमान",
      en: "Hot body temperature or recorded fever",
      ta: "உடல் சூடாக இருத்தல் அல்லது காய்ச்சல் பதிவு செய்யப்படுதல்",
    },
  },
  {
    id: "stiff_neck",
    category: "fever",
    isDangerSign: true,
    label: {
      mr: "मान ताठ होणे (Stiff Neck)",
      hi: "गर्दन अकड़ जाना (आगे झुकाने में असमर्थ)",
      en: "Stiff neck (Unable to touch chin to chest)",
      ta: "கழுத்து விறைப்பு (கழுத்தை அசைக்க இயலாமை)",
    },
    description: {
      mr: "मान वाकवताना तीव्र वेदना किंवा मान ताठ राहणे",
      hi: "गर्दन हिलाने में तेज दर्द या अकड़न",
      en: "Severe neck stiffness, sign of meningitis",
      ta: "கழுத்தை முன்னோக்கி வளைக்க முடியாத கடுமையான பிடிப்பு",
    },
  },
  {
    id: "malaria_test_positive",
    category: "fever",
    isDangerSign: false,
    label: {
      mr: "मलेरिया चाचणी पॉझिटिव्ह (RDT Kit / लॅब)",
      hi: "मलेरिया जांच पॉजिटिव (RDT किट या लैब रिपोर्ट)",
      en: "Malaria test positive (RDT or smear)",
      ta: "மலேரியா சோதனை உறுதி (பாசிட்டிவ்)",
    },
    description: {
      mr: "आशा वर्करने केलेली किट चाचणी पॉझिटिव्ह आली आहे",
      hi: "आशा कार्यकर्ता द्वारा की गई जांच में मलेरिया निकला",
      en: "Confirmed positive result on rapid diagnostic kit",
      ta: "மலேரியா இரத்தப் பரிசோதனை முடிவில் மலேரியா உறுதி செய்யப்பட்டுள்ளது",
    },
  },
  {
    id: "malaria_test_negative",
    category: "fever",
    isDangerSign: false,
    label: {
      mr: "मलेरिया चाचणी निगेटिव्ह (RDT Kit)",
      hi: "मलेरिया जांच नेगेटिव (RDT किट)",
      en: "Malaria test negative (RDT or smear)",
      ta: "மலேரியா சோதனை இல்லை (நெகட்டிவ்)",
    },
    description: {
      mr: "तापाची मलेरिया चाचणी निगेटिव्ह आली आहे",
      hi: "जांच में मलेरिया नहीं पाया गया",
      en: "Rapid diagnostic test confirmed negative for malaria",
      ta: "மலேரியா பரிசோதனையில் தொற்று இல்லை என்பது உறுதி செய்யப்பட்டுள்ளது",
    },
  },

  // --- Ear Infections (IMNCI) ---
  {
    id: "tender_swelling_behind_ear",
    category: "ear",
    isDangerSign: true,
    label: {
      mr: "कानामागच्या हाडावर सूज व तीव्र दुखणे (Mastoiditis)",
      hi: "कान के पीछे सूजन और तेज दर्द (मैस्टॉयडाइटिस)",
      en: "Tender, painful swelling behind the ear (Mastoiditis)",
      ta: "காதுக்கு பின்னால் வலி மற்றும் வீக்கம் (மாஸ்டாய்டிடிஸ்)",
    },
    description: {
      mr: "कानामागचा भाग सुजलेला व हात लावल्यास अतिशय दुखतो",
      hi: "कान के पीछे का हिस्सा सूजा हुआ व छूने पर बहुत दर्द",
      en: "Painful, hot swelling on bone behind ear",
      ta: "காதுக்கு பின்புறமுள்ள எலும்பில் தொட்டால் கடுமையான வலி மற்றும் வீக்கம்",
    },
  },
  {
    id: "ear_pain",
    category: "ear",
    isDangerSign: false,
    label: {
      mr: "कान दुखणे",
      hi: "कान में दर्द",
      en: "Ear pain",
      ta: "காது வலி",
    },
    description: {
      mr: "कानात सतत ठसठस किंवा ठणका",
      hi: "कान के अंदर लगातार दर्द या टीस",
      en: "Ache or sharp pain inside ear",
      ta: "காதின் உட்பகுதியில் தொடர்ச்சியான குத்தல் அல்லது வலி",
    },
  },
  {
    id: "pus_draining_less_than_14_days",
    category: "ear",
    isDangerSign: false,
    label: {
      mr: "कानातून पू वाहणे (१४ दिवसांपेक्षा कमी काळ)",
      hi: "कान से मवाद बहना (14 दिनों से कम समय से)",
      en: "Pus draining from ear (< 14 days)",
      ta: "காதில் இருந்து சீழ் வடிதல் (14 நாட்களுக்குள்)",
    },
    description: {
      mr: "नुकताच सुरू झालेला कानाचा संसर्ग",
      hi: "हाल ही में शुरू हुआ कान का रिसाव",
      en: "Acute ear discharge for fewer than 14 days",
      ta: "சமீபத்தில் தொடங்கிய காது சீழ் தொற்று",
    },
  },
  {
    id: "pus_draining_14_days_or_more",
    category: "ear",
    isDangerSign: false,
    label: {
      mr: "कानातून पू वाहणे (१४ दिवस किंवा अधिक काळ - जुनाट)",
      hi: "कान से मवाद बहना (14 दिन या उससे अधिक समय से - पुराना)",
      en: "Chronic pus draining from ear (≥ 14 days)",
      ta: "காதில் இருந்து நாள்பட்ட சீழ் வடிதல் (14 நாட்களுக்கு மேல்)",
    },
    description: {
      mr: "दीर्घकालीन कानाचा संसर्ग, तज्ज्ञांच्या तपासणीची गरज",
      hi: "लंबे समय से कान का बहना",
      en: "Ear drainage lasting 2 weeks or longer",
      ta: "இரண்டு வாரங்களுக்கும் மேலாக நீடிக்கும் காது சீழ் தொற்று",
    },
  },

  // --- Dehydration & Digestive ---
  {
    id: "diarrhea",
    category: "digestive",
    isDangerSign: false,
    label: {
      mr: "जुलाब / पातळ शौचास होणे",
      hi: "दस्त / पतले दस्त होना",
      en: "Diarrhea (Watery stools)",
      ta: "வயிற்றுப்போக்கு / பேதி (தண்ணீர் மலம்)",
    },
    description: {
      mr: "दिवसात ३ किंवा अधिक वेळा पातळ शौचास होणे",
      hi: "दिन में 3 या अधिक बार पतला शौच होना",
      en: "Frequent loose or watery bowel movements",
      ta: "ஒரு நாளில் 3 அல்லது அதற்கு மேற்பட்ட முறை நீர் போன்ற மலம் கழித்தல்",
    },
  },
  {
    id: "vomiting",
    category: "digestive",
    isDangerSign: false,
    label: {
      mr: "उलटी किंवा मळमळ",
      hi: "उल्टी या जी मिचलाना",
      en: "Vomiting or nausea",
      ta: "வாந்தி அல்லது குமட்டல்",
    },
    description: {
      mr: "अन्नाची उलटी होणे",
      hi: "उल्टी आना",
      en: "Episodes of throwing up",
      ta: "உண்ட உணவு வாந்தியாக வெளியேறுதல்",
    },
  },
  {
    id: "sunken_eyes",
    category: "digestive",
    isDangerSign: false,
    label: {
      mr: "डोळे खोल जाणे (Sunken Eyes)",
      hi: "आंखें अंदर धंस जाना (निर्जलीकरण लक्षण)",
      en: "Sunken eyes (Dehydration sign)",
      ta: "குழி விழுந்த கண்கள் (நீர்ச்சத்து குறைபாடு)",
    },
    description: {
      mr: "शरीरातील पाण्याचे प्रमाण कमी झाल्याचे लक्षण",
      hi: "शरीर में पानी की गंभीर कमी का संकेत",
      en: "Noticeable sunken appearance of eyeballs",
      ta: "உடலில் நீர்ச்சத்து மிகக் குறைவாக உள்ளதற்கான அறிகுறி",
    },
  },
  {
    id: "skin_pinch_goes_back_very_slowly",
    category: "digestive",
    isDangerSign: true,
    label: {
      mr: "पोटाची त्वचा चिमटीत ओढल्यावर अतिशय हळू मूळ स्थितीत जाणे",
      hi: "पेट की त्वचा चुटकी में खींचने पर बहुत धीरे वापस जाना",
      en: "Skin pinch goes back very slowly (> 2 seconds)",
      ta: "தோலை கிள்ளி விட்டால் மெதுவாக மீளுதல் (> 2 வினாடிகள்)",
    },
    description: {
      mr: "अति-निर्जलीकरणाचे (Severe Dehydration) मुख्य लक्षण",
      hi: "गंभीर निर्जलीकरण का महत्वपूर्ण संकेत",
      en: "Clear clinical sign of acute severe dehydration",
      ta: "கடுமையான தீவிர நீர்ச்சத்து குறைபாட்டின் நேரடி அறிகுறி",
    },
  },

  // --- Maternal & Obstetric (ASHA Module 6 / SBA Box 7) ---
  {
    id: "bleeding_from_vagina_any_amount",
    category: "maternal",
    isDangerSign: true,
    applicableSex: "female",
    onlyPregnantOrPostpartum: true,
    label: {
      mr: "गरोदरपणात योनीतून रक्तस्त्राव (किंचित किंवा जास्त)",
      hi: "गर्भावस्था में योनि से रक्तस्राव (कम या अधिक)",
      en: "Vaginal bleeding during pregnancy (any amount)",
      ta: "கர்ப்ப காலத்தில் யோனி இரத்தப்போக்கு",
    },
    description: {
      mr: "गरोदरपणात रक्तस्त्राव होणे हा धोकादायक इशारा आहे; तात्काळ रुग्णालयात जा",
      hi: "गर्भावस्था में रक्तस्राव खतरनाक आपातकालीन लक्षण है",
      en: "Emergency sign requiring immediate surgical/obstetric hospital",
      ta: "உடனடி மருத்துவமனை சிகிச்சை தேவைப்படும் அவசர மகப்பேறு அறிகுறி",
    },
  },
  {
    id: "loss_of_foetal_movement_or_severe_abdominal_pain",
    category: "maternal",
    isDangerSign: true,
    applicableSex: "female",
    onlyPregnantOrPostpartum: true,
    label: {
      mr: "बाळाची हालचाल बंद होणे किंवा पोटात असह्य वेदना",
      hi: "शिशु की हलचल बंद होना या पेट में असहनीय दर्द",
      en: "Loss of fetal movements or severe abdominal pain",
      ta: "கருவின் அசைவு குறைதல் அல்லது கடுமையான வயிற்று வலி",
    },
    description: {
      mr: "पोटातील बाळाची हालचाल जाणवत नाही किंवा सतत तीव्र वेदना",
      hi: "गर्भ में बच्चे का न हिलना या तेज निरंतर दर्द",
      en: "Decreased fetal movement or acute continuous pain",
      ta: "வயிற்றில் குழந்தையின் அசைவு தெரியாமல் போதல் அல்லது இடைவிடாத தீவிர வலி",
    },
  },
  {
    id: "severe_headache_with_blurred_vision_or_spots",
    category: "maternal",
    isDangerSign: true,
    applicableSex: "female",
    onlyPregnantOrPostpartum: true,
    label: {
      mr: "तीव्र डोकेदुखी सोबत डोळ्यांसमोर अंधारी किंवा ठिपके",
      hi: "तेज सिरदर्द के साथ आंखों के आगे धुंधलापन या चमक",
      en: "Severe headache with blurred vision or seeing spots",
      ta: "கடுமையான தலைவலியுடன் மங்கலான பார்வை / புள்ளிகள் தெரிதல்",
    },
    description: {
      mr: "गरोदरपणात रक्तदाब अतिवाढल्याचे (Pre-eclampsia) लक्षण",
      hi: "गर्भावस्था में उच्च रक्तचाप (प्री-एक्लेम्पसिया) का गंभीर लक्षण",
      en: "Hallmark sign of severe pre-eclampsia / hypertensive emergency",
      ta: "கர்ப்பகால உயர் இரத்த அழுத்தத்தின் (Pre-eclampsia) தீவிர அறிகுறி",
    },
  },
  {
    id: "swollen_face_or_hands_pitting_oedema",
    category: "maternal",
    isDangerSign: true,
    applicableSex: "female",
    onlyPregnantOrPostpartum: true,
    label: {
      mr: "चेहऱ्यावर किंवा हातांवर सूज (दाबल्यास खड्डा पडणे)",
      hi: "चेहरे या हाथों पर सूजन (दबाने पर गड्ढा पड़ना)",
      en: "Swelling on face or hands (Pitting edema)",
      ta: "முகம் அல்லது கைகளில் வீக்கம் (அழுத்தினால் குழி விழுதல்)",
    },
    description: {
      mr: "फक्त पायावर नाही, तर सकाळी उठल्यावर चेहरा व हातावर सूज",
      hi: "चेहरे और हाथों पर सूजन जो दबाने पर आसानी से नहीं उठती",
      en: "Facial and hand edema in pregnancy",
      ta: "கர்ப்ப காலத்தில் முகம் மற்றும் கைகளில் ஏற்படும் வீக்கம்",
    },
  },
  {
    id: "foul_smelling_discharge",
    category: "maternal",
    isDangerSign: true,
    applicableSex: "female",
    onlyPregnantOrPostpartum: true,
    label: {
      mr: "प्रसूतीनंतर दुर्गंधीयुक्त स्राव (Puerperal Sepsis)",
      hi: "प्रसव के बाद दुर्गंधयुक्त स्राव (संक्रमण का संकेत)",
      en: "Foul-smelling vaginal discharge postpartum",
      ta: "பிரசவத்திற்குப் பின் துர்நாற்றத்துடன் கூடிய யோனி திரவம்",
    },
    description: {
      mr: "गर्भाशयाचा जंतुसंसर्ग (Puerperal Sepsis) - अँटिबायोटिक्सची गरज",
      hi: "प्रसूति संक्रमण, उसी दिन अस्पताल में जांच करवाएं",
      en: "Indicates serious postpartum uterine infection (sepsis)",
      ta: "பிரசவத்திற்குப் பின் ஏற்படும் தீவிர கர்ப்பப்பை நோய்த்தொற்றின் அறிகுறி",
    },
  },

  // --- Adult & Elderly Emergencies (Common Emergencies Annexure 4) ---
  {
    id: "chest_pain",
    category: "adult_emergency",
    isDangerSign: true,
    label: {
      mr: "छातीत असह्य कळ, डाव्या हातात किंवा जबड्यात पसरणे (Chest Pain)",
      hi: "सीने में तेज दर्द या दबाव, बाएं हाथ या जबड़े में फैलना (Chest Pain)",
      en: "Chest pain / Pressure or stabbing left-side chest sensation",
      ta: "மார்பு வலி / நெஞ்சில் பாரம் / இடது பக்க நெஞ்சு குத்தல் வலி",
    },
    description: {
      mr: "हार्ट अटॅकचे संभाव्य लक्षण; ताबडतोब १०८ रुग्णवाहिका बोलवा",
      hi: "संभावित दिल का दौरा (Heart Attack); तुरंत 108 पर कॉल करें",
      en: "High suspicion of acute coronary event / myocardial infarction",
      ta: "மாரடைப்பு அல்லது தீவிர இதயக் கோளாறுக்கான அவசர சிகிச்சை அறிகுறி",
    },
  },
  {
    id: "swelling_face_or_hands",
    category: "adult_emergency",
    isDangerSign: false,
    label: {
      mr: "तोंड, डोळे किंवा हात-पायांवर सूज",
      hi: "चेहरे, आंखों या हाथ-पैरों पर सूजन",
      en: "Swelling in face, around eyes, or feet/hands",
      ta: "முகம், கண்கள் அல்லது கை கால்களில் வீக்கம்",
    },
    description: {
      mr: "डोळ्यांभोवती किंवा चेहऱ्यावर सूज जाणवणे",
      hi: "आंखों या चेहरे पर असामान्य सूजन",
      en: "Noticeable edema around eyes, face or extremities",
      ta: "கண்களைச் சுற்றியோ முகத்திலோ ஏற்படும் வீக்கம்",
    },
  },
  {
    id: "fever_in_chemo_or_hiv_or_diabetic_patient",
    category: "adult_emergency",
    isDangerSign: false,
    label: {
      mr: "मधुमेह (डायबिटीज / Sugar) आजारासोबत अस्वस्थता",
      hi: "मधुमेह (शुगर / Diabetes) के साथ शारीरिक परेशानी",
      en: "Diabetes (Sugar) or high-risk condition with active symptoms",
      ta: "நீரிழிவு (சர்க்கரை நோய் / Sugar) பாதிப்புடன் கூடிய உபாதை",
    },
    description: {
      mr: "दीर्घकालीन मधुमेहाच्या रुग्णांमध्ये वाढलेली लक्षणे",
      hi: "लंबे समय से शुगर के मरीजों में जटिलताओं का खतरा",
      en: "Underlying diabetes mellitus with acute symptoms requiring facility check",
      ta: "நீரிழிவு நோயாளிக்கு ஏற்படும் தொடர் உபாதைகள், மருத்துவ பரிசோதனை தேவை",
    },
  },
  {
    id: "headache_or_dizziness",
    category: "adult_emergency",
    isDangerSign: false,
    label: {
      mr: "तीव्र डोकेदुखी किंवा चक्कर येणे",
      hi: "तेज सिरदर्द या चक्कर आना",
      en: "Severe headache, giddiness or dizziness",
      ta: "கடுமையான தலைவலி அல்லது கிறுகிறுப்பு / மயக்கம்",
    },
    description: {
      mr: "डोके जड होणे किंवा चक्कर येऊन तोल जाणे",
      hi: "सिर में तेज दर्द या चक्कर आना",
      en: "Acute headache or postural dizziness",
      ta: "தீவிர தலைபாரம் அல்லது தடுமாற்றம் ஏற்படுத்தும் தலைசுற்றல்",
    },
  },
  {
    id: "low_risk_cough_or_cold",
    category: "respiratory",
    isDangerSign: false,
    label: {
      mr: "सर्दी, शिंका किंवा घसा खवखवणे",
      hi: "जुकाम, छींकें या गले में खराश",
      en: "Common cold, runny nose or sneezing",
      ta: "சாதாரண ஜலதோஷம், மூக்கு ஒழுகுதல் அல்லது தும்மல்",
    },
    description: {
      mr: "सौम्य सर्दी व नाक वाहणे",
      hi: "हल्की सर्दी और नाक बहना",
      en: "Mild upper respiratory symptoms",
      ta: "லேசான சளி மற்றும் மூக்கடைப்பு அறிகுறிகள்",
    },
  },
  {
    id: "severe_burns_or_chemical_burn",
    category: "adult_emergency",
    isDangerSign: true,
    label: {
      mr: "गंभीर भाजणे किंवा रासायनिक इजा (Severe Burns)",
      hi: "गंभीर रूप से जलना या रासायनिक जलन",
      en: "Severe burns (Fire, scalding, chemical or electrical)",
      ta: "கடுமையான தீக்காயம் அல்லது இரசாயன காயம்",
    },
    description: {
      mr: "मोठ्या प्रमाणात कातडी जळणे किंवा ६० वर्षांवरील व्यक्ती भाजणे",
      hi: "गंभीर जलन जिसमें तुरंत अस्पताल में ड्रेसिंग व ड्रिप जरूरी है",
      en: "Extensive body surface area burn or elderly burn patient",
      ta: "அவசர மருத்துவமனை சிகிச்சை தேவைப்படும் தீவிர தீக்காயம்",
    },
  },
  {
    id: "uncontrolled_bleeding_or_deep_wound",
    category: "adult_emergency",
    isDangerSign: true,
    label: {
      mr: "न थांबणारा मोठा रक्तस्त्राव किंवा खोल जखम",
      hi: "न रुकने वाला गंभीर रक्तस्राव या गहरा घाव",
      en: "Uncontrolled active bleeding or deep traumatic wound",
      ta: "நிற்காத தீவிர இரத்தப்போக்கு அல்லது ஆழமான காயம்",
    },
    description: {
      mr: "दाबून धरल्यावरही रक्त न थांबणे किंवा मोठी दुखापत",
      hi: "दबाव बनाने पर भी खून का न रुकना",
      en: "Severe traumatic injury requiring surgical hemostasis",
      ta: "அழுத்தினாலும் நிற்காத தீவிர இரத்தப்போக்கு",
    },
  },
];
