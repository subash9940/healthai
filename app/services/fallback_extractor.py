"""
fallback_extractor.py — Deterministic offline keyword/fuzzy matcher for symptom extraction.

Used when the external LLM proxy (OmniRoute / Kiro / OpenAI / Anthropic) is offline
or has exhausted its credits. This ensures the Swasthya Setu NLP feature works 100%
of the time, locally, offline in rural health sub-centres with 0 API dependencies.

Includes comprehensive conversational, colloquial, and phonetic variants across:
- English
- Hindi (Devanagari + Hinglish)
- Marathi (Devanagari + Marathlini)
- Tamil (தமிழ் script + Tanglish)
"""

import re
from app.symptom_vocab import SYMPTOM_KEYS, SYMPTOM_LABELS

KEYWORD_RULES: list[tuple[list[str], str]] = [
    # -----------------------------------------------------------------------
    # 1. General Danger Signs
    # -----------------------------------------------------------------------
    (
        [
            "unable to drink", "cannot drink", "drinking poorly", "not able to feed", "unable to eat", "cant swallow",
            "दूध पिण्यास असमर्थ", "दूध पिऊ शकत नाही", "पाणी पिऊ शकत नाही", "काही खात नाही",
            "दूध पीने में असमर्थ", "पानी नहीं पी पा रहा", "कुछ खा नहीं पा रहा",
            "பால் குடிக்க முடியவில்லை", "தண்ணீர் குடிக்க முடியவில்லை", "சாப்பிட முடியவில்லை", "விழுங்க முடியவில்லை"
        ],
        "not_able_to_drink_or_feed"
    ),
    (
        [
            "vomits everything", "vomiting everything", "throwing up everything", "cant keep anything down",
            "सर्व उलटी", "खाल्लेले सर्व उलटी होते", "पाणीही पोटात टिकत नाही",
            "सब उल्टी", "खाया पिया सब उल्टी", "पानी भी नहीं रुक रहा",
            "அனைத்தும் வாந்தி", "சாப்பிட்டதெல்லாம் வாந்தி", "எது சாப்பிட்டாலும் வாந்தி", "வாமிட் வருது எது சாப்பிட்டாலும்", "வாமிட் வருது"
        ],
        "vomits_everything"
    ),
    (
        [
            "convulsion", "convulsions", "seizure", "seizures", "fit", "fits", "shivering badly",
            "झटके", "फेफरे", "आकडी", "फिट्स", "हातपाय थरथरणे",
            "दौरे", "झटके आना", "मिरगी",
            "வலிப்பு", "இழுப்பு", "கை கால் உதறல்", "சுன்னி"
        ],
        "convulsions"
    ),
    (
        [
            "unconscious", "lethargic", "not waking", "fainted", "fainting", "syncope", "drowsy", "dizziness", "giddiness",
            "बेशुद्ध", "सुस्त", "जागे होत नाही", "चक्कर", "भोवळ", "शुद्ध हरपणे",
            "बेहोश", "सुस्त", "होश नहीं", "चक्कर आना", "मूर्छा",
            "நினைவிழப்பு", "மயக்கம்", "மயக்கமாக", "மயக்கமாகும்", "மயங்கி", "சுயநினைவு இல்லை", "கிறுகிறுப்பு"
        ],
        "lethargic_or_unconscious"
    ),
    (
        [
            "chest indrawing", "in-drawing",
            "छाती आत ओढली", "छाती खोल जाणे",
            "छाती धंसना", "पसलियां चलना",
            "மார்பு உள்வாங்குதல்", "விலா எலும்பு உள்வாங்குதல்"
        ],
        "chest_indrawing"
    ),
    (
        [
            "stridor", "noisy breathing", "wheezing", "crowing",
            "घरघर", "खरखर", "श्वासाचा आवाज",
            "घरघराहट", "सांस में सीटी",
            "சத்தம் கொண்ட சுவாசம்", "குறட்டை போன்ற சுவாசம்", "ஈளை"
        ],
        "noisy_breathing_or_stridor"
    ),

    # -----------------------------------------------------------------------
    # 2. Respiratory & Chest
    # -----------------------------------------------------------------------
    (
        [
            "fast breathing", "difficult breathing", "difficulty in breathing", "shortness of breath", "breathless", "hard to breathe", "gasping",
            "दम लागणे", "श्वास घेण्यास त्रास", "श्वास कोंडणे", "धाप लागणे",
            "सांस फूलना", "सांस लेने में तकलीफ", "सांस की तकलीफ", "दम घुटना",
            "மூச்சுத்திணறல்", "கடின சுவாசம்", "மூச்சு வாங்குகிறது", "மூச்சு விட சிரமம்", "மூச்சு இரைப்பு"
        ],
        "difficult_breathing"
    ),
    (
        [
            "breathlessness at rest", "breathless while sitting",
            "बसल्या बसल्या दम", "विश्रांती घेताना दम",
            "बैठे बैठे सांस फूलना", "आराम करते समय भी सांस फूलना",
            "ஓய்வில் மூச்சுத்திணறல்", "சும்மா உட்கார்ந்தாலும் மூச்சு வாங்குது"
        ],
        "breathlessness_at_rest"
    ),
    (
        [
            "chest pain", "pain in chest", "chest heaviness", "chest pressure", "heart pain",
            "छातीत दुखणे", "छातीत कळ", "छातीत जड वाटणे", "छातीत दुखतंय",
            "सीने में दर्द", "छाती में दर्द", "सीने में भारीपन", "दिल में दर्द",
            "மார்பு வலி", "நெஞ்சு வலி", "நெஞ்சில் பாரம்", "நெஞ்சு குத்துதல்"
        ],
        "chest_pain"
    ),
    (
        [
            "cough", "coughing", "dry cough", "wet cough", "phlegm",
            "खोकला", "खोकणे", "कफ", "कोरडा खोकला",
            "खांसी", "खंसी", "कफ", "बलगम", "सूखी खांसी",
            "இருமல்", "இருமுவது", "சளி இருமல்", "வறட்டு இருமல்"
        ],
        "cough"
    ),
    (
        [
            "runny nose", "cold", "sore throat", "sneezing", "nasal congestion",
            "वाहणारे नाक", "सर्दी", "पडसे", "घसा दुखणे", "शिंका",
            "नाक बहना", "जुकाम", "सर्दी जुकाम", "गला खराब", "छींक",
            "ஜலதோஷம்", "மூக்கு ஒழுகுதல்", "தொண்டை வலி", "தும்மல்", "மூக்கடைப்பு"
        ],
        "low_risk_cough_or_cold"
    ),
    (
        [
            "stiff neck", "neck stiffness", "cant bend neck",
            "मान ताठ", "मान दुखणे", "मान वाकवता येत नाही",
            "गर्दन अकड़ना", "गर्दन में अकड़न", "गर्दन नहीं मुड़ना",
            "கழுத்து விறைப்பு", "கழுத்து திருப்ப முடியவில்லை", "கழுத்து பிடிப்பு"
        ],
        "stiff_neck"
    ),

    # -----------------------------------------------------------------------
    # 3. Fever & Systemic
    # -----------------------------------------------------------------------
    (
        [
            "high fever", "burning fever", "very hot body", "severe fever",
            "तेज बुखार", "तीव्र ताप", "खूप ताप", "अति ताप", "अंग तापणे",
            "अत्यधिक बुखार", "तेज़ बुखार", "103 बुखार", "104 बुखार",
            "அதிக காய்ச்சல்", "கடுமையான காய்ச்சல்", "கொதிக்கும் ஜுரம்"
        ],
        "high_fever_with_or_without_abdominal_pain_too_weak_to_get_out_of_bed"
    ),
    (
        [
            "fever", "warm body", "hot body", "temperature", "chills",
            "ताप", "अंग गरम", "थंडी वाजून ताप",
            "बुखार", "बदन गर्म", "हरारत", "ठंड लगकर बुखार",
            "காய்ச்சல்", "ஜுரம்", "சூடு", "சுரம்", "உடல் சூடு", "குளிர் காய்ச்சல்", "ஜுரம் அடிக்கிறது"
        ],
        "fever"
    ),
    (
        [
            "severe headache", "headache", "head pain", "head throbbing", "migraine",
            "डोकेदुखी", "डोके दुखणे", "डोक्यात कळ", "डोकं दुखतंय",
            "सिरदर्द", "सर दर्द", "सिर में भयंकर दर्द", "माथा दर्द",
            "தலைவலி", "தலை வலிக்குது", "கடுமையான தலைவலி", "தலை பாரம்", "தலை குடைச்சல்"
        ],
        "headache_or_dizziness"
    ),

    # -----------------------------------------------------------------------
    # 4. Digestive & Abdomen
    # -----------------------------------------------------------------------
    (
        [
            "loose motion", "loose stool", "diarrhea", "watery stool", "motions", "dysentery",
            "जुलाब", "पातळ शौचास", "संडास", "अतिसार",
            "दस्त", "पतले दस्त", "झाड़े लगना", "पेचिश",
            "வயிற்றுப்போக்கு", "பேதி", "வயிற்றால போகுது", "தண்ணீராக மலம்"
        ],
        "diarrhea"
    ),
    (
        [
            "abdominal pain", "stomach pain", "belly pain", "stomach ache", "cramps",
            "पोटदुखी", "पोटात दुखणे", "पोटात कळ", "पोट फुगणे",
            "पेट दर्द", "पेट में दर्द", "मरोड़", "पेट फूलना",
            "வயிற்று வலி", "வயிறு வலி", "வயித்து வலி", "வயிற்று பிடிப்பு", "வயிறு உப்புசம்"
        ],
        "abdominal_pain_or_loose_motions_gt_3_episodes"
    ),
    (
        [
            "vomit", "vomiting", "nausea", "throwing up", "puking", "vomit sensation",
            "उलटी", "मळमळ", "उलट्या", "उलटीसारखे वाटणे",
            "उल्टी", "मतली", "जी मिचलाना", "कै",
            "வாந்தி", "வாமிட்", "வாமிட் வருது", "குமட்டல்", "வாந்தி வருவது போன்ற உணர்வு"
        ],
        "vomiting"
    ),
    (
        [
            "sunken eyes", "dry mouth", "dehydration",
            "डोळे खोल", "डोळे खोल जाणे", "तोंड सुकणे",
            "आंखें धंसना", "आंखें अंदर जाना", "मुंह सूखना",
            "குழிந்த கண்கள்", "கண் உள்ளே போதல்", "வாய் வறட்சி"
        ],
        "sunken_eyes"
    ),

    # -----------------------------------------------------------------------
    # 5. Maternal, Pregnancy & Reproductive
    # -----------------------------------------------------------------------
    (
        [
            "bleeding", "blood per vagina", "vaginal bleeding", "spotting", "blood flow",
            "रक्तस्राव", "रक्तस्त्राव", "योनीतून रक्त", "खून जाणे",
            "खून बहना", "योनि से रक्तस्राव", "ब्लीडिंग",
            "இரத்தப்போக்கு", "ரத்தப்போக்கு", "ரத்தம் போகுது", "தீட்டு ரத்தம்"
        ],
        "bleeding_from_vagina_any_amount"
    ),
    (
        [
            "water broke", "amniotic fluid", "leaking water",
            "पाणी सुटणे", "अंगावरून पाणी जाणे",
            "पानी छूटना", "अंग से पानी जाना",
            "பனிக்குடம் உடைந்தது", "தண்ணீர் உடைந்தது", "நீர் கசிவு"
        ],
        "water_broke_no_labour_within_24h"
    ),
    (
        [
            "blurred vision", "spots before eyes", "cannot see properly",
            "दिसायला त्रास", "धुरकट दिसणे", "डोळ्यांसमोर अंधारी",
            "धुंधला दिखना", "आंखों के आगे अंधेरा",
            "மங்கலான பார்வை", "கண் மங்கலாக தெரிகிறது", "கண்ணில் இருட்டு"
        ],
        "blurred_vision"
    ),
    (
        [
            "swelling face", "swelling hands", "swollen face", "puffy face", "swelling feet",
            "चेहऱ्यावर सूज", "हातावर सूज", "पायावर सूज", "अंगावर सूज",
            "चेहरे पर सूजन", "हाथों में सूजन", "पैरों में सूजन",
            "முக வீக்கம்", "கை வீக்கம்", "கால் வீக்கம்", "உடல் வீக்கம்"
        ],
        "swelling_face_or_hands"
    ),
    (
        [
            "foetal movement", "fetal movement", "baby movement decreased", "baby not moving",
            "बाळाची हालचाल", "बाळाची हालचाल कमी", "बाळ हलत नाही",
            "बच्चे की हलचल", "बच्चा हिल नहीं रहा", "हलचल कम",
            "குழந்தை அசைவு", "குழந்தை அசையவில்லை", "குழந்தை துடிப்பு குறைவு"
        ],
        "loss_of_foetal_movement_or_severe_abdominal_pain"
    ),

    # -----------------------------------------------------------------------
    # 6. Trauma, Bites, Burns & Poisoning
    # -----------------------------------------------------------------------
    (
        [
            "snake bite", "snakebite", "scorpion bite", "insect bite",
            "साप चावला", "विंचू चावला", "सर्पदंश",
            "सांप काटना", "बिच्छू काटना",
            "பாம்பு கடி", "தேள் கடி", "பூச்சி கடி", "விஷக்கடி"
        ],
        "snake_or_scorpion_bite"
    ),
    (
        [
            "burn", "burnt", "fire injury", "acid burn", "boiling water",
            "भाजणे", "आगीने होरपळणे", "गरम पाणी पडणे",
            "जलना", "आग से जलना", "अग्नि से झुलसना",
            "தீக்காயம்", "சுட்ட காயம்", "சூடு பட்டது", "வெந்நீர் பட்டது"
        ],
        "burn_present"
    ),
    (
        [
            "fracture", "broken bone", "bone crack", "dislocation",
            "हाड मोडणे", "हाड मोडले", "अस्थिभंग",
            "हड्डी टूटना", "हड्डी टूट गई", "हड्डी खिसकना",
            "எலும்பு முறிவு", "எலும்பு உடைந்தது", "கை கால் முறிவு"
        ],
        "isolated_long_bone_fracture"
    ),
    (
        [
            "stroke", "facial drooping", "paralysis", "slurred speech", "one side weak",
            "पक्षाघात", "लकवा", "तोंड वाकडे", "एक बाजू लुळी पडणे",
            "लकवा", "फालिज", "मुंह टेढ़ा होना",
            "பக்கவாதம்", "முகம் ஒரு பக்கமாக இழுத்தல்", "பேச்சு குளறுதல்", "கை கால் செயலிழப்பு"
        ],
        "stroke_fast_signs"
    ),
    (
        [
            "poison", "poisoning", "insecticide", "pesticide", "consumed medicine overdose",
            "विषबाधा", "विष पिणे", "कीटकनाशक पिणे",
            "जहर", "कीटनाशक पीना", "दवा का ओवरडोज",
            "விஷம்", "பூச்சிக்கொல்லி குடித்தது", "விஷம் அருந்தியது", "மருந்து அதிகம் சாப்பிட்டது"
        ],
        "drug_overdose_or_poisoning_with_stable_vitals"
    ),
]

def extract_symptoms_fallback(transcript: str, language: str = "en") -> dict:
    """
    Deterministically matches transcript against multilingual symptom keywords.
    Also parses common numerical vitals (BP like 140/90, Temp like 39C / 102F, Pulse, SpO2).
    """
    text = transcript.lower()
    matched_symptoms: set[str] = set()

    for keywords, sym_key in KEYWORD_RULES:
        for kw in keywords:
            if kw.lower() in text:
                matched_symptoms.add(sym_key)
                break

    # Parse vitals mentioned in transcript
    vitals: dict[str, float | None] = {}

    # Blood pressure: e.g. "BP 140/90" or "130/80"
    bp_match = re.search(r'(?:bp\s*|blood\s*pressure\s*)?(\d{2,3})\s*/\s*(\d{2,3})', text)
    if bp_match:
        try:
            vitals["systolic_bp"] = float(bp_match.group(1))
            vitals["diastolic_bp"] = float(bp_match.group(2))
        except (ValueError, IndexError):
            pass

    # Temperature: e.g. "101.5 F" or "38.5 C" or "temp 39"
    temp_f_match = re.search(r'(\d{2,3}(?:\.\d+)?)\s*(?:f|fahrenheit)', text)
    temp_c_match = re.search(r'(\d{2}(?:\.\d+)?)\s*(?:c|celsius|°c)', text)
    if temp_c_match:
        try:
            vitals["temperature_celsius"] = float(temp_c_match.group(1))
        except ValueError:
            pass
    elif temp_f_match:
        try:
            f_val = float(temp_f_match.group(1))
            vitals["temperature_celsius"] = round((f_val - 32.0) * 5.0 / 9.0, 1)
        except ValueError:
            pass

    # SpO2 / Oxygen: e.g. "spo2 88" or "oxygen 92%"
    spo2_match = re.search(r'(?:spo2|oxygen|oximeter)\s*(?:is|=|:)?\s*(\d{2,3})%?', text)
    if spo2_match:
        try:
            vitals["spo2_percent"] = float(spo2_match.group(1))
        except ValueError:
            pass

    # Pulse / Heart rate: e.g. "pulse 110" or "hr 95"
    pulse_match = re.search(r'(?:pulse|heart\s*rate|hr)\s*(?:is|=|:)?\s*(\d{2,3})', text)
    if pulse_match:
        try:
            vitals["pulse_bpm"] = float(pulse_match.group(1))
        except ValueError:
            pass

    return {
        "symptoms": sorted(list(matched_symptoms)),
        "vitals_mentioned": vitals,
        "_source": "deterministic_offline_matcher"
    }
