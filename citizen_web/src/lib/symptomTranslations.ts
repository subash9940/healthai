import { Language } from './useTranslation';

export interface SymptomTranslationItem {
  key: string;
  is_danger: boolean;
  category: 'maternal' | 'cardiac' | 'respiratory' | 'fever' | 'general' | 'pediatric';
  names: Record<Language, string>;
  keywords: Record<Language, string[]>;
}

export const SYMPTOM_DEFINITIONS: SymptomTranslationItem[] = [
  // 1. CARDIAC / EMERGENCY
  {
    key: 'chest_pain',
    is_danger: true,
    category: 'cardiac',
    names: {
      en: 'Chest Pain or Heavy Pressure',
      hi: 'सीने में तेज दर्द या भारीपन',
      ta: 'நெஞ்சு வலி அல்லது கடுமையான அழுத்தம்',
      mr: 'छातीत तीव्र दुखणे किंवा दाब वाटणे',
    },
    keywords: {
      en: ['chest pain', 'chest pressure', 'heart pain', 'chest hurt'],
      hi: ['सीने में दर्द', 'छाती में दर्द', 'दिल में दर्द', 'सीने में भारीपन'],
      ta: ['நெஞ்சு வலி', 'மார்பு வலி', 'நெஞ்சில் வலி', 'நெஞ்சு பாரம்', 'இதய வலி'],
      mr: ['छातीत दुखणे', 'छातीत कळ', 'छातीवर वजन', 'छाती दुखते'],
    },
  },
  {
    key: 'severe_chest_pain_radiating_to_arm_or_jaw',
    is_danger: true,
    category: 'cardiac',
    names: {
      en: 'Chest pain spreading to left arm, neck, or jaw',
      hi: 'सीने का दर्द जो बाएं हाथ, गर्दन या जबड़े में फैले',
      ta: 'இடது கை, கழுத்து அல்லது தாடைக்கு பரவும் நெஞ்சு வலி',
      mr: 'डाव्या हाताकडे, मानेकडे किंवा जबड्याकडे पसरणारे छातीतील दुखणे',
    },
    keywords: {
      en: ['radiating pain', 'left arm pain', 'jaw pain chest', 'heart attack pain'],
      hi: ['हाथ में दर्द फैलना', 'जबड़े में दर्द', 'गर्दन में दर्द सीना'],
      ta: ['கைக்கு பரவும் வலி', 'தாடை வலி', 'கழுத்து வலி நெஞ்சு', 'மாரடைப்பு வலி'],
      mr: ['हातात कळ', 'मानेत कळ', 'जबडा दुखणे'],
    },
  },

  // 2. NEUROLOGICAL / CONVULSIONS
  {
    key: 'altered_sensorium',
    is_danger: true,
    category: 'general',
    names: {
      en: 'Confusion, Drowsiness, or Loss of Consciousness',
      hi: 'बेहोशी, भ्रम या अत्यधिक सुस्ती',
      ta: 'குழப்பம், தூக்க மயக்கம் அல்லது சுயநினைவின்மை',
      mr: 'शुद्ध हरपणे, गोंधळलेली अवस्था किंवा बेशुद्धी',
    },
    keywords: {
      en: ['unconscious', 'fainted', 'confusion', 'drowsy', 'not responding'],
      hi: ['बेहोश', 'बेहोशी', 'सुस्ती', 'जवाब नहीं दे रहा', 'भ्रम'],
      ta: ['மயக்கம்', 'சுயநினைவு இல்லை', 'பதிலளிக்கவில்லை', 'குழப்பம்', 'தூக்க மயக்கம்'],
      mr: ['बेशुद्ध', 'शुद्ध हरपली', 'गुंगी', 'प्रतिसाद देत नाही'],
    },
  },
  {
    key: 'convulsions',
    is_danger: true,
    category: 'general',
    names: {
      en: 'Convulsions, Fits, or Seizures',
      hi: 'दौरे पड़ना, झटके या मिर्गी',
      ta: 'வலிப்பு, ஜன்னி அல்லது நடுக்கம்',
      mr: 'फिट येणे, झटके किंवा फेफरे',
    },
    keywords: {
      en: ['fits', 'seizures', 'convulsions', 'shaking violently'],
      hi: ['दौरा', 'दौरे', 'झटके', 'मिर्गी', 'फिट्स'],
      ta: ['வலிப்பு', 'ஜன்னி', 'இழுப்பு', 'உடல் நடுக்கம்', 'ஃபிட்ஸ்'],
      mr: ['फिट', 'झटके', 'फेफरे', 'थरथर'],
    },
  },

  // 3. MATERNAL EMERGENCIES
  {
    key: 'heavy_bleeding_postpartum',
    is_danger: true,
    category: 'maternal',
    names: {
      en: 'Heavy bleeding after childbirth (Postpartum)',
      hi: 'प्रसव के बाद अत्यधिक रक्तस्राव',
      ta: 'பிரசவத்திற்குப் பின் அதிக ரத்தப்போக்கு',
      mr: 'प्रसूतीनंतर अतिरक्तस्राव',
    },
    keywords: {
      en: ['postpartum bleeding', 'heavy bleeding after delivery', 'excessive bleeding'],
      hi: ['प्रसव बाद खून बहना', 'ज्यादा ब्लीडिंग', 'खून का बहाव'],
      ta: ['பிரசவ ரத்தப்போக்கு', 'அதிக ரத்தம்', 'பிரசவத்திற்கு பின் ரத்தம்'],
      mr: ['प्रसूतीनंतर रक्तस्राव', 'जास्त रक्त जाणे'],
    },
  },
  {
    key: 'eclampsia_seizures',
    is_danger: true,
    category: 'maternal',
    names: {
      en: 'Seizures or fits in pregnancy (Eclampsia)',
      hi: 'गर्भावस्था में दौरे पड़ना (एक्लेम्पसिया)',
      ta: 'கர்ப்ப காலத்தில் வலிப்பு அல்லது ஜன்னி (எக்லாம்சியா)',
      mr: 'गरोदरपणात येणारे झटके (एक्लॅम्पसिया)',
    },
    keywords: {
      en: ['pregnancy fits', 'eclampsia', 'pregnancy seizure'],
      hi: ['गर्भावस्था में दौरा', 'गर्भवती को झटके'],
      ta: ['கர்ப்பத்தில் வலிப்பு', 'கர்ப்பிணி ஜன்னி'],
      mr: ['गरोदरपणात फिट'],
    },
  },
  {
    key: 'severe_headache_pregnancy',
    is_danger: true,
    category: 'maternal',
    names: {
      en: 'Severe persistent headache during pregnancy',
      hi: 'गर्भावस्था में तेज लगातार सिरदर्द',
      ta: 'கர்ப்ப காலத்தில் கடுமையான தொடர் தலைவலி',
      mr: 'गरोदरपणात सतत तीव्र डोकेदुखी',
    },
    keywords: {
      en: ['pregnancy headache', 'severe headache pregnant'],
      hi: ['गर्भावस्था में सिरदर्द', 'गर्भवती का सिर दर्द'],
      ta: ['கர்ப்பத்தில் தலைவலி', 'கர்ப்பிணி தலைவலி'],
      mr: ['गरोदरपणात डोकेदुखी'],
    },
  },
  {
    key: 'blurred_vision_pregnancy',
    is_danger: true,
    category: 'maternal',
    names: {
      en: 'Blurred or distorted vision in pregnancy',
      hi: 'गर्भावस्था में आंखों के आगे धुंधलापन',
      ta: 'கர்ப்ப காலத்தில் பார்வை மங்குதல் அல்லது கண்ணில் மின்னிடுதல்',
      mr: 'गरोदरपणात अंधुक किंवा कमी दिसणे',
    },
    keywords: {
      en: ['pregnancy blurred vision', 'vision blur pregnant'],
      hi: ['धुंधला दिखना गर्भावस्था', 'आंखों के आगे अंधेरा'],
      ta: ['கர்ப்பத்தில் பார்வை மங்குதல்', 'மங்கலான பார்வை'],
      mr: ['डोळ्यासमोर अंधारी'],
    },
  },

  // 4. RESPIRATORY EMERGENCIES & SYMPTOMS
  {
    key: 'severe_breathlessness',
    is_danger: true,
    category: 'respiratory',
    names: {
      en: 'Severe breathlessness / Inability to speak full sentence',
      hi: 'सांस लेने में अत्यधिक तकलीफ / दम फूलना',
      ta: 'தீவிர மூச்சுத் திணறல் / மூச்சு விட முடியாமை',
      mr: 'श्वास घेण्यास तीव्र अडचण / धाप लागणे',
    },
    keywords: {
      en: ['severe breathlessness', 'cant breathe', 'gasping', 'shortness of breath'],
      hi: ['सांस फूलना', 'सांस नहीं आ रही', 'दम घुटना', 'तेज सांस'],
      ta: ['மூச்சுத் திணறல்', 'சுவாசிக்க முடியவில்லை', 'மூச்சு வாங்கல்', 'மூச்சு திணறுகிறது'],
      mr: ['श्वास लागतोय', 'धाप भरली', 'श्वास गुदमरणे'],
    },
  },
  {
    key: 'breathlessness',
    is_danger: false,
    category: 'respiratory',
    names: {
      en: 'Difficulty breathing or mild wheezing',
      hi: 'सांस लेने में हल्की तकलीफ या घरघराहट',
      ta: 'மூச்சு விடுவதில் சிரமம் அல்லது இரைப்பு',
      mr: 'श्वास घेण्यास त्रास किंवा धाप',
    },
    keywords: {
      en: ['breathless', 'mild breathlessness', 'wheezing', 'heavy breathing'],
      hi: ['सांस लेने में परेशानी', 'सांस की तकलीफ'],
      ta: ['மூச்சு கஷ்டம்', 'இரைப்பு', 'சுவாசக் கோளாறு'],
      mr: ['श्वास घेण्यास त्रास', 'दम लागणे'],
    },
  },
  {
    key: 'cough',
    is_danger: false,
    category: 'respiratory',
    names: {
      en: 'Cough (Recent / Short duration)',
      hi: 'खांसी (हाल ही में शुरू हुई)',
      ta: 'இருமல் (சமீபத்தியது)',
      mr: 'खोकला (नुकताच सुरू झालेला)',
    },
    keywords: {
      en: ['cough', 'coughing', 'dry cough', 'wet cough', 'sore throat'],
      hi: ['खांसी', 'खोकला', 'गले में खराश'],
      ta: ['இருமல்', 'சளி இருமல்', 'வறட்டு இருமல்', 'தொண்டை வலி'],
      mr: ['खोकला', 'घशात खवखव'],
    },
  },
  {
    key: 'low_risk_cough_or_cold',
    is_danger: false,
    category: 'respiratory',
    names: {
      en: 'Common cold, runny nose or sneezing',
      hi: 'जुकाम, छींकें या गले में खराश',
      ta: 'சாதாரண ஜலதோஷம், மூக்கு ஒழுகுதல் அல்லது தும்மல்',
      mr: 'सर्दी, शिंका किंवा घसा खवखवणे',
    },
    keywords: {
      en: ['cold', 'common cold', 'runny nose', 'sneezing', 'blocked nose', 'sore throat'],
      hi: ['जुकाम', 'सर्दी', 'छींक', 'नाक बहना', 'गले में खराश'],
      ta: ['ஜலதோஷம்', 'சளி', 'மூக்கு ஒழுகுதல்', 'தும்மல்'],
      mr: ['सर्दी', 'पडसे', 'शिंका', 'नाक वाहणे', 'घसा खवखवणे'],
    },
  },
  {
    key: 'cough_more_than_2_weeks',
    is_danger: false,
    category: 'respiratory',
    names: {
      en: 'Cough lasting more than 2 weeks (TB Warning)',
      hi: '2 सप्ताह से अधिक समय से लगातार खांसी (टीबी लक्षण)',
      ta: '2 வாரங்களுக்கும் மேலாக நீடிக்கும் இருமல் (காசநோய் அறிகுறி)',
      mr: '२ आठवड्यांपेक्षा जास्त काळ खोकला (टीबी संशय)',
    },
    keywords: {
      en: ['cough two weeks', 'cough more than 2 weeks', 'chronic cough', 'tb cough'],
      hi: ['दो हफ्ते से खांसी', '2 हफ्ते से ज्यादा खांसी', 'लगातार खांसी'],
      ta: ['இரண்டு வார இருமல்', '2 வாரம் இருமல்', 'நீண்ட நாள் இருமல்', 'காசநோய் இருமல்'],
      mr: ['दोन आठवडे खोकला', 'दीर्घकाळ खोकला'],
    },
  },
  {
    key: 'contact_with_known_tb_patient',
    is_danger: false,
    category: 'respiratory',
    names: {
      en: 'Contact with known TB (Tuberculosis) patient',
      hi: 'घर में टीबी मरीज के संपर्क में होना',
      ta: 'காசநோய் (TB) நோயாளியுடன் தொடர்பு',
      mr: 'घरातील टीबी रुग्णाच्या संपर्कात असणे',
    },
    keywords: {
      en: ['tb contact', 'tuberculosis contact', 'tb patient in house'],
      hi: ['टीबी मरीज के संपर्क', 'घर में टीबी'],
      ta: ['காசநோய் தொடர்பு', 'டிபி நோயாளி தொடர்பு'],
      mr: ['टीबी रुग्ण संपर्क'],
    },
  },

  // 5. PEDIATRIC SPECIFIC DANGERS
  {
    key: 'stridor_in_children',
    is_danger: true,
    category: 'pediatric',
    names: {
      en: 'Harsh noisy breathing / Stridor in child while calm',
      hi: 'बच्चे में सांस लेते समय सीटी या घरघराहट की तेज आवाज',
      ta: 'குழந்தையில் மூச்சு விடும்போது ஏற்படும் கடுமையான இரைச்சல் ஒலி',
      mr: 'लहान मुलांमध्ये श्वास घेताना येणारा मोठा घरघर आवाज',
    },
    keywords: {
      en: ['stridor', 'child noisy breathing', 'barking cough'],
      hi: ['बच्चे की सीटी जैसी सांस', 'घरघराहट'],
      ta: ['குழந்தை இரைச்சல்', 'ஸ்ட்ரைடர்', 'குழந்தை மூச்சு சத்தம்'],
      mr: ['मुलाचा घरघर आवाज'],
    },
  },
  {
    key: 'lethargic_or_unconscious',
    is_danger: true,
    category: 'pediatric',
    names: {
      en: 'Child abnormally lethargic, sleepy, or unresponsive',
      hi: 'बच्चा अत्यधिक सुस्त, बेहोश या जगाने पर न जागना',
      ta: 'குழந்தை மிக சோம்பலாக இருத்தல் அல்லது பதிலளிக்காத நிலை',
      mr: 'मूल अतिशय सुस्त, प्रतिसाद न देणारे किंवा बेशुद्ध',
    },
    keywords: {
      en: ['child lethargic', 'baby not waking up', 'unresponsive child'],
      hi: ['बच्चा सुस्त है', 'बच्चा जाग नहीं रहा'],
      ta: ['குழந்தை கண் திறக்கவில்லை', 'குழந்தை மயக்கம்', 'குழந்தை சோம்பல்'],
      mr: ['मूल डोळे उघडत नाही', 'अतिसुस्त मूल'],
    },
  },
  {
    key: 'not_able_to_drink_or_feed',
    is_danger: true,
    category: 'pediatric',
    names: {
      en: 'Baby or child unable to drink or breastfeed at all',
      hi: 'बच्चा स्तनपान या कुछ भी पीने में असमर्थ',
      ta: 'குழந்தை பால் குடிக்கவோ அல்லது திரவம் பருகவோ இயலாமை',
      mr: 'मूल दूध पिण्यास किंवा गिळण्यास पूर्णपणे असमर्थ',
    },
    keywords: {
      en: ['unable to feed', 'cant drink milk', 'baby not drinking', 'not sucking'],
      hi: ['दूध नहीं पी रहा', 'बच्चा पी नहीं पा रहा', 'स्तनपान नहीं कर रहा'],
      ta: ['பால் குடிக்கவில்லை', 'தாய்ப்பால் குடிக்க முடியவில்லை', 'தண்ணீர் குடிக்க முடியவில்லை'],
      mr: ['दूध पीत नाही', 'अन्न गिळत नाही'],
    },
  },

  // 6. FEVERS & INFECTIONS
  {
    key: 'high_fever',
    is_danger: false,
    category: 'fever',
    names: {
      en: 'High Fever (≥101°F / 38.5°C)',
      hi: 'तेज बुखार (101°F या अधिक)',
      ta: 'அதிக காய்ச்சல் (101°F அல்லது அதற்கு மேல்)',
      mr: 'तीव्र ताप (१०१°F पेक्षा जास्त)',
    },
    keywords: {
      en: ['high fever', 'burning fever', 'severe fever', 'very hot body'],
      hi: ['तेज बुखार', 'शरीर तप रहा है', 'ज्यादा बुखार'],
      ta: ['அதிக காய்ச்சல்', 'சுரம்', 'உடல் கொதிக்கிறது', 'தீவிர காய்ச்சல்'],
      mr: ['तीव्र ताप', 'अंग खूप तापले आहे', 'जास्त ताप'],
    },
  },
  {
    key: 'fever',
    is_danger: false,
    category: 'fever',
    names: {
      en: 'Fever / Warm body',
      hi: 'बुखार / शरीर गर्म',
      ta: 'காய்ச்சல் / உடல் சூடு',
      mr: 'ताप / अंग गरम',
    },
    keywords: {
      en: ['fever', 'mild fever', 'hot body', 'temperature'],
      hi: ['बुखार', 'ताप', 'हल्का बुखार', 'गर्म बदन'],
      ta: ['காய்ச்சல்', 'சுரம்', 'உடல் சூடு', 'லேசான காய்ச்சல்'],
      mr: ['ताप', 'अंग गरम', 'बारीक ताप'],
    },
  },
  {
    key: 'chills_and_rigors',
    is_danger: false,
    category: 'fever',
    names: {
      en: 'Fever with severe chills and shivering (Malaria Sign)',
      hi: 'तेज कंपकंपी और ठंड लगकर बुखार आना (मलेरिया लक्षण)',
      ta: 'கடுமையான குளிர் மற்றும் நடுக்கத்துடன் காய்ச்சல் (மலேரியா அறிகுறி)',
      mr: 'थंडी वाजून आणि हुडहुडी भरून येणारा ताप (हिवताप/मलेरिया)',
    },
    keywords: {
      en: ['chills', 'rigors', 'shivering fever', 'cold shivering', 'malaria chills'],
      hi: ['ठंड लगकर बुखार', 'कंपकंपी', 'कांपना बुखार', 'ठंड लगना'],
      ta: ['குளிர் காய்ச்சல்', 'நடுக்கம்', 'குளிருடன் காய்ச்சல்', 'நடுங்கும் காய்ச்சல்'],
      mr: ['थंडी वाजून ताप', 'हुडहुडी', 'थरथर ताप'],
    },
  },
  {
    key: 'fever_with_chills',
    is_danger: false,
    category: 'fever',
    names: {
      en: 'Fever with feeling cold',
      hi: 'हल्की ठंड के साथ बुखार',
      ta: 'குளிர்ச்சியுடன் கூடிய காய்ச்சல்',
      mr: 'थंडीसह ताप',
    },
    keywords: {
      en: ['fever with chills', 'cold with fever'],
      hi: ['ठंड के साथ बुखार'],
      ta: ['குளிர் காய்ச்சல்'],
      mr: ['थंडी आणि ताप'],
    },
  },
  {
    key: 'fever_more_than_2_weeks',
    is_danger: false,
    category: 'fever',
    names: {
      en: 'Fever lasting more than 2 weeks',
      hi: '2 सप्ताह से अधिक समय से लगातार बुखार',
      ta: '2 வாரங்களுக்கும் மேலாக நீடிக்கும் காய்ச்சல்',
      mr: '२ आठवड्यांपेक्षा जास्त काळ सतत ताप',
    },
    keywords: {
      en: ['fever two weeks', 'prolonged fever', 'long fever'],
      hi: ['दो हफ्ते से बुखार', 'लगातार बुखार'],
      ta: ['இரண்டு வார காய்ச்சல்', 'நீண்ட நாள் காய்ச்சல்', '2 வாரம் காய்ச்சல்'],
      mr: ['दोन आठवडे ताप'],
    },
  },
  {
    key: 'dark_or_cola_coloured_urine',
    is_danger: true,
    category: 'fever',
    names: {
      en: 'Dark brown / Cola-coloured urine (Blackwater fever warning)',
      hi: 'गहरे काले या कोला रंग का पेशाब (काला पानी बुखार संकेत)',
      ta: 'அடர் பழுப்பு / கோலா நிற சிறுநீர் (கடும் காய்ச்சல் எச்சரிக்கை)',
      mr: 'गडद तपकिरी किंवा कोला रंगाची लघवी (धोक्याचा इशारा)',
    },
    keywords: {
      en: ['dark urine', 'cola urine', 'black urine', 'brown urine'],
      hi: ['काला पेशाब', 'गहरा पेशाब', 'कोला रंग पेशाब'],
      ta: ['கருப்பு சிறுநீர்', 'அடர் சிறுநீர்', 'கோலா நிற சிறுநீர்'],
      mr: ['काळी लघवी', 'गडद लघवी'],
    },
  },

  // 7. GASTROINTESTINAL & DENGUE WARNING SIGNS
  {
    key: 'persistent_vomiting',
    is_danger: false,
    category: 'general',
    names: {
      en: 'Persistent / Frequent vomiting (Dengue sign)',
      hi: 'लगातार या बार-बार उल्टी होना (डेंगू चेतावनी)',
      ta: 'தொடர் வாந்தி அல்லது அடிக்கடி வாந்தி எடுத்தல்',
      mr: 'सतत किंवा वारंवार उलट्या होणे (डेंग्यू लक्षण)',
    },
    keywords: {
      en: ['vomiting', 'throwing up', 'frequent vomit', 'puking'],
      hi: ['उल्टी', 'बार-बार उल्टी', 'उल्टियां'],
      ta: ['வாந்தி', 'தொடர் வாந்தி', 'அடிக்கடி வாந்தி'],
      mr: ['उलटी', 'उलट्या', 'वारंवार उलट्या'],
    },
  },
  {
    key: 'persistent_or_severe_abdominal_pain_or_tenderness',
    is_danger: false,
    category: 'general',
    names: {
      en: 'Severe or continuous stomach pain',
      hi: 'पेट में गंभीर या लगातार तेज दर्द',
      ta: 'கடுமையான அல்லது தொடர்ச்சியான வயிற்று வலி',
      mr: 'पोटात तीव्र किंवा सतत दुखणे',
    },
    keywords: {
      en: ['stomach pain', 'belly pain', 'abdominal pain', 'tummy ache'],
      hi: ['पेट दर्द', 'पेट में तेज दर्द', 'पेट दुखना'],
      ta: ['வயிற்று வலி', 'வயிறு வலி', 'கடுமையான வயிற்று வலி', 'வயிற்றில் குடைச்சல்'],
      mr: ['पोटदुखी', 'पोटात दुखणे', 'पोटात कळ'],
    },
  },
  {
    key: 'diarrhea',
    is_danger: false,
    category: 'general',
    names: {
      en: 'Loose watery motions / Diarrhea',
      hi: 'पानी जैसे पतले दस्त / डायरिया',
      ta: 'வயிற்றுப்போக்கு / நீர் போன்ற பேதி',
      mr: 'पाण्यासारखे पातळ जुलाब / डायरिया',
    },
    keywords: {
      en: ['diarrhea', 'loose motions', 'watery stool', 'loose stools'],
      hi: ['दस्त', 'पतले दस्त', 'लूज मोशन', 'झाड़ा'],
      ta: ['வயிற்றுப்போக்கு', 'பேதி', 'லூஸ் மோஷன்', 'வயிற்றோட்டம்'],
      mr: ['जुलाब', 'पातळ संडास', 'संडास लागणे'],
    },
  },
  {
    key: 'vomiting_diarrhea',
    is_danger: false,
    category: 'general',
    names: {
      en: 'Vomiting and loose motions together',
      hi: 'उल्टी और दस्त दोनों एक साथ होना',
      ta: 'வாந்தி மற்றும் வயிற்றுப்போக்கு இரண்டும் சேர்ந்து இருத்தல்',
      mr: 'उलट्या आणि जुलाब दोन्ही एकत्र होणे',
    },
    keywords: {
      en: ['vomiting and diarrhea', 'cholera like symptoms'],
      hi: ['उल्टी और दस्त', 'हैजा जैसे लक्षण'],
      ta: ['வாந்தியும் பேதியும்', 'வாந்தி வயிற்றுப்போக்கு'],
      mr: ['उलट्या व जुलाब'],
    },
  },
  {
    key: 'abdominal_distension_or_swelling',
    is_danger: false,
    category: 'general',
    names: {
      en: 'Abdominal swelling or bloating',
      hi: 'पेट का असामान्य रूप से फूलना या सूजन',
      ta: 'வயிறு வீக்கம் அல்லது வயிறு பெரிதாதல்',
      mr: 'पोट फुगणे किंवा पोटाला सूज येणे',
    },
    keywords: {
      en: ['swollen belly', 'distended stomach', 'bloating'],
      hi: ['पेट फूलना', 'पेट में सूजन'],
      ta: ['வயிறு வீக்கம்', 'வயிறு உப்புசம்', 'தொப்பை வீக்கம்'],
      mr: ['पोट फुगणे', 'पोटाला सूज'],
    },
  },
  {
    key: 'restlessness_or_sudden_behavioral_change',
    is_danger: false,
    category: 'general',
    names: {
      en: 'Extreme restlessness or sudden behavioral change',
      hi: 'अत्यधिक बेचैनी या व्यवहार में अचानक बदलाव',
      ta: 'தீவிர அமைதியின்மை அல்லது திடீர் நடத்தை மாற்றம்',
      mr: 'अतिअस्वस्थता किंवा वर्तनात अचानक बदल',
    },
    keywords: {
      en: ['restlessness', 'agitated', 'irritability', 'mood change'],
      hi: ['बेचैनी', 'घबराहट', 'स्वभाव बदलना'],
      ta: ['அமைதியின்மை', 'பதட்டம்', 'நடத்தை மாற்றம்'],
      mr: ['अस्वस्थता', 'घाबरणे'],
    },
  },

  // 8. ANEMIA & GENERAL SYMPTOMS
  {
    key: 'pallor_or_pale_skin_or_conjunctiva',
    is_danger: false,
    category: 'general',
    names: {
      en: 'Pale skin, pale inner eyelids, nails or tongue (Anemia sign)',
      hi: 'त्वचा, आंखें, नाखून या जीभ का पीला/सफेद पड़ना (खून की कमी)',
      ta: 'வெளிறிய தோல், கண்கள், நகங்கள் அல்லது நாக்கு (ரத்த சோகை அறிகுறி)',
      mr: 'त्वचा, डोळे, नखे किंवा जीभ पांढरी पडणे (रक्तक्षय / ॲनिमिया)',
    },
    keywords: {
      en: ['pale', 'paleness', 'white eyelids', 'anemia', 'low blood'],
      hi: ['खून की कमी', 'पीला पड़ना', 'सफेद आंखें', 'एनीमिया'],
      ta: ['ரத்த சோகை', 'வெளிறிய தோல்', 'வெள்ளை நகங்கள்', 'ரத்தம் குறைவு'],
      mr: ['रक्ताची कमतरता', 'पांढरी नखे', 'ॲनिमिया'],
    },
  },
  {
    key: 'headache',
    is_danger: false,
    category: 'general',
    names: {
      en: 'Headache',
      hi: 'सिरदर्द',
      ta: 'தலைவலி',
      mr: 'डोकेदुखी',
    },
    keywords: {
      en: ['headache', 'head pain', 'throbbing head'],
      hi: ['सिरदर्द', 'सिर में दर्द', 'सर दर्द'],
      ta: ['தலைவலி', 'மண்டை வலி', 'தலையில் வலி'],
      mr: ['डोकेदुखी', 'डोके दुखणे', 'माथेदुखी'],
    },
  },
  {
    key: 'dizziness',
    is_danger: false,
    category: 'general',
    names: {
      en: 'Dizziness or lightheadedness',
      hi: 'चक्कर आना या सिर घूमना',
      ta: 'தலைச்சுற்றல் அல்லது மயக்கம் போன்ற உணர்வு',
      mr: 'चक्कर येणे किंवा तोल जाणे',
    },
    keywords: {
      en: ['dizzy', 'dizziness', 'giddiness', 'lightheaded'],
      hi: ['चक्कर आना', 'चक्कर', 'सिर घूमना'],
      ta: ['தலைச்சுற்றல்', 'மயக்கம்', 'கிறுகிறுப்பு'],
      mr: ['चक्कर येणे', 'गरगरणे'],
    },
  },
  {
    key: 'fatigue',
    is_danger: false,
    category: 'general',
    names: {
      en: 'Extreme fatigue, weakness, or exhaustion',
      hi: 'अत्यधिक थकान या शारीरिक कमजोरी',
      ta: 'அதிக சோர்வு, பலவீனம் அல்லது உடல் தளர்ச்சி',
      mr: 'अतिशय थकवा किंवा अशक्तपणा',
    },
    keywords: {
      en: ['tired', 'fatigue', 'weakness', 'exhausted'],
      hi: ['थकान', 'कमजोरी', 'सुस्ती'],
      ta: ['சோர்வு', 'அசதி', 'பலவீனம்', 'உடல் வலிமை குறைவு'],
      mr: ['थकवा', 'अशक्तपणा', 'गळाल्यासारखे'],
    },
  },
  {
    key: 'significant_weight_loss',
    is_danger: false,
    category: 'general',
    names: {
      en: 'Significant unexplained weight loss or loss of appetite',
      hi: 'बिना कारण तेजी से वजन घटना या भूख न लगना',
      ta: 'காரணமின்றி உடல் எடை குறைதல் அல்லது பசியின்மை',
      mr: 'वजन वेगाने कमी होणे किंवा भूक मंदावणे',
    },
    keywords: {
      en: ['weight loss', 'loss of appetite', 'losing weight', 'thinning'],
      hi: ['वजन घटना', 'भूख न लगना', 'दुबला होना'],
      ta: ['எடை குறைவு', 'பசியின்மை', 'உடல் மெலிதல்'],
      mr: ['वजन कमी होणे', 'भूक न लागणे'],
    },
  },
  {
    key: 'burning_micturition',
    is_danger: false,
    category: 'general',
    names: {
      en: 'Burning pain during urination (UTI)',
      hi: 'पेशाब करते समय तेज जलन या दर्द',
      ta: 'சிறுநீர் கழிக்கும் போது எரிச்சல் அல்லது வலி',
      mr: 'लघवी करताना जळजळ किंवा वेदना',
    },
    keywords: {
      en: ['burning urination', 'uti', 'urine burning', 'pain peeing'],
      hi: ['पेशाब में जलन', 'पेशाब करते दर्द'],
      ta: ['சிறுநீர் எரிச்சல்', 'மூத்திரம் எரிச்சல்', 'சிறுநீர் வலி'],
      mr: ['लघवी करताना आग', 'लघवीची जळजळ'],
    },
  },

  // 9. TRAUMA & INJURY EMERGENCIES
  {
    key: 'burn_special_area_hands_face_perineum_or_airway',
    is_danger: true,
    category: 'general',
    names: {
      en: 'Severe burns on face, hands, joints, or airway inhalation',
      hi: 'चेहरे, हाथ, जोड़ों या सांस नली का गंभीर रूप से जलना',
      ta: 'முகம், கைகள் அல்லது சுவாசப்பாதையில் தீவிர தீக்காயம்',
      mr: 'चेहरा, हात किंवा श्वासनलिकेवरील गंभीर भाजणे',
    },
    keywords: {
      en: ['burns', 'fire burn', 'face burn', 'hand burn'],
      hi: ['जलना', 'आग से जलना', 'चेहरा जलना'],
      ta: ['தீக்காயம்', 'சுட்ட காயம்', 'தீக்காயங்கள்'],
      mr: ['भाजणे', 'आगीत भाजणे'],
    },
  },
  {
    key: 'fracture_with_exposed_bone',
    is_danger: true,
    category: 'general',
    names: {
      en: 'Bone fracture with visible exposed bone / Open wound',
      hi: 'हड्डी टूटना और त्वचा से बाहर दिखना (खुला फ्रैक्चर)',
      ta: 'எலும்பு முறிவு மற்றும் எலும்பு வெளியே தெரிதல் (திறந்த முறிவு)',
      mr: 'हाड मोडणे आणि त्वचेतून बाहेर दिसणे (ओपन फ्रॅक्चर)',
    },
    keywords: {
      en: ['fracture', 'broken bone', 'exposed bone', 'compound fracture'],
      hi: ['हड्डी टूटना', 'खुला फ्रैक्चर', 'हड्डी बाहर'],
      ta: ['எலும்பு முறிவு', 'எலும்பு உடைந்தது', 'எலும்பு வெளியே தெரிகிறது'],
      mr: ['हाड मोडले', 'फ्रॅक्चर'],
    },
  },
  {
    key: 'snake_or_scorpion_bite',
    is_danger: true,
    category: 'general',
    names: {
      en: 'Snake bite or Venomous Scorpion sting',
      hi: 'सांप का काटना या बिच्छू का डंक',
      ta: 'பாம்பு கடி அல்லது விஷத் தேள் கடி',
      mr: 'साप चावणे किंवा विंचू दंश',
    },
    keywords: {
      en: ['snake bite', 'scorpion sting', 'snakebite', 'poisonous bite'],
      hi: ['सांप काटना', 'सांप ने काटा', 'बिच्छू का डंक', 'बिच्छू'],
      ta: ['பாம்பு கடி', 'பாம்பு கடித்தது', 'தேள் கடி', 'விஷக்கடி'],
      mr: ['साप चावला', 'विंचू चावला', 'सर्पदंश'],
    },
  },
];

export function getSymptomName(key: string, lang: Language): string {
  const sym = SYMPTOM_DEFINITIONS.find((s) => s.key === key);
  if (sym && sym.names[lang]) {
    return sym.names[lang];
  }
  if (sym && sym.names.en) {
    return sym.names.en;
  }
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function extractSymptomsFromSpeech(text: string, lang: Language): string[] {
  if (!text || text.trim().length === 0) return [];
  const normalizedText = text.toLowerCase();
  const matchedKeys = new Set<string>();

  for (const sym of SYMPTOM_DEFINITIONS) {
    // 1. Check keywords in current language
    const langKeywords = sym.keywords[lang] || [];
    for (const kw of langKeywords) {
      if (normalizedText.includes(kw.toLowerCase())) {
        matchedKeys.add(sym.key);
        break;
      }
    }

    // 2. Also check English keywords as cross-lingual fallback
    if (!matchedKeys.has(sym.key) && lang !== 'en') {
      const enKeywords = sym.keywords.en || [];
      for (const kw of enKeywords) {
        if (normalizedText.includes(kw.toLowerCase())) {
          matchedKeys.add(sym.key);
          break;
        }
      }
    }
  }

  return Array.from(matchedKeys);
}
