/**
 * problemSummary.ts
 *
 * Intelligent Clinical Narrative & Patient Problem Summary Generator.
 * Synthesizes natural-language patient problem summaries from voice transcripts,
 * selected symptoms, demographics, and vitals across Tamil, Hindi, Marathi, and English.
 */

import { Language } from './useTranslation';
import { getSymptomName, SYMPTOM_DEFINITIONS } from './symptomTranslations';

export interface ProblemSummaryContext {
  language: Language;
  symptoms: string[];
  voiceTranscript?: string;
  patientName?: string;
  ageYears?: number;
  sex?: 'male' | 'female' | 'other';
  isPregnant?: boolean;
  isPostpartum?: boolean;
  vitals?: {
    temperature_f?: number | null;
    temperature_c?: number | null;
    systolic_bp?: number | null;
    diastolic_bp?: number | null;
    heart_rate_bpm?: number | null;
    spo2_percent?: number | null;
    hemoglobin_g_dl?: number | null;
  };
}

export function generateProblemSummary(ctx: ProblemSummaryContext): string {
  const { language, symptoms, voiceTranscript, patientName, ageYears, sex, isPregnant, vitals } = ctx;

  const symptomLabels = symptoms.map((key) => getSymptomName(key, language));
  const dangerCount = symptoms.filter((k) => SYMPTOM_DEFINITIONS.find((s) => s.key === k)?.is_danger).length;

  // 1. Demographics narrative segment
  const patientSex = sex || 'male';
  let demoText = '';
  if (language === 'ta') {
    const ageStr = ageYears != null ? `${ageYears} வயது` : '';
    const sexStr = isPregnant
      ? 'கர்ப்பிணிப் பெண்'
      : patientSex === 'female'
      ? 'பெண்'
      : patientSex === 'male'
      ? 'ஆண்'
      : 'நோயாளி';
    const nameStr = patientName ? `${patientName} (${ageStr} ${sexStr})` : `${ageStr} ${sexStr}`;
    demoText = nameStr.trim();
  } else if (language === 'hi') {
    const ageStr = ageYears != null ? `${ageYears} वर्षीय` : '';
    const sexStr = isPregnant
      ? 'गर्भवती महिला'
      : patientSex === 'female'
      ? 'महिला'
      : patientSex === 'male'
      ? 'पुरुष'
      : 'मरीज';
    const nameStr = patientName ? `${patientName} (${ageStr} ${sexStr})` : `${ageStr} ${sexStr}`;
    demoText = nameStr.trim();
  } else if (language === 'mr') {
    const ageStr = ageYears != null ? `${ageYears} वर्षे` : '';
    const sexStr = isPregnant
      ? 'गरोदर महिला'
      : patientSex === 'female'
      ? 'महिला'
      : patientSex === 'male'
      ? 'पुरुष'
      : 'रुग्ण';
    const nameStr = patientName ? `${patientName} (${ageStr} ${sexStr})` : `${ageStr} ${sexStr}`;
    demoText = nameStr.trim();
  } else {
    const ageStr = ageYears != null ? `${ageYears}-year-old` : '';
    const sexStr = isPregnant
      ? 'pregnant woman'
      : patientSex === 'female'
      ? 'female'
      : patientSex === 'male'
      ? 'male'
      : 'patient';
    const nameStr = patientName ? `${patientName} (${ageStr} ${sexStr})` : `${ageStr} ${sexStr}`;
    demoText = nameStr.trim();
  }

  // 2. Vitals narrative segment
  const vitalsSegments: string[] = [];
  if (vitals) {
    if (vitals.temperature_f && vitals.temperature_f >= 100.4) {
      if (language === 'ta') vitalsSegments.push(`காய்ச்சல் ${vitals.temperature_f}°F`);
      else if (language === 'hi') vitalsSegments.push(`बुखार ${vitals.temperature_f}°F`);
      else if (language === 'mr') vitalsSegments.push(`ताप ${vitals.temperature_f}°F`);
      else vitalsSegments.push(`Fever ${vitals.temperature_f}°F`);
    }
    if (vitals.spo2_percent && vitals.spo2_percent < 94) {
      if (language === 'ta') vitalsSegments.push(`ஆக்சிஜன் அளவு குறைவு (SpO2 ${vitals.spo2_percent}%)`);
      else if (language === 'hi') vitalsSegments.push(`कम ऑक्सीजन (SpO2 ${vitals.spo2_percent}%)`);
      else if (language === 'mr') vitalsSegments.push(`कमी ऑक्सिजन पातळी (${vitals.spo2_percent}%)`);
      else vitalsSegments.push(`Low SpO2 (${vitals.spo2_percent}%)`);
    }
    if (vitals.systolic_bp && vitals.diastolic_bp && (vitals.systolic_bp >= 140 || vitals.diastolic_bp >= 90)) {
      if (language === 'ta') vitalsSegments.push(`உயர் இரத்த அழுத்தம் (${vitals.systolic_bp}/${vitals.diastolic_bp} mmHg)`);
      else if (language === 'hi') vitalsSegments.push(`उच्च रक्तचाप (${vitals.systolic_bp}/${vitals.diastolic_bp} mmHg)`);
      else if (language === 'mr') vitalsSegments.push(`उच्च रक्तदाब (${vitals.systolic_bp}/${vitals.diastolic_bp} mmHg)`);
      else vitalsSegments.push(`Elevated BP (${vitals.systolic_bp}/${vitals.diastolic_bp} mmHg)`);
    }
    if (vitals.hemoglobin_g_dl && vitals.hemoglobin_g_dl < 11.0) {
      if (language === 'ta') vitalsSegments.push(`குறைந்த ஹீமோகுளோபின் (${vitals.hemoglobin_g_dl} g/dL இரத்த சோகை)`);
      else if (language === 'hi') vitalsSegments.push(`कम हीमोग्लोबिन (${vitals.hemoglobin_g_dl} g/dL एनीमिया)`);
      else if (language === 'mr') vitalsSegments.push(`कमी हिमोग्लोबिन (${vitals.hemoglobin_g_dl} g/dL एनिमिया)`);
      else vitalsSegments.push(`Low Hemoglobin (${vitals.hemoglobin_g_dl} g/dL)`);
    }
  }

  // 3. Construct natural language synthesis
  if (language === 'ta') {
    let summary = '';
    if (demoText) summary += `நோயாளி: ${demoText}. `;

    if (voiceTranscript && voiceTranscript.trim().length > 5) {
      summary += `நோயாளியின் கூற்று: "${voiceTranscript.trim()}". `;
    }

    if (symptomLabels.length > 0) {
      summary += `முக்கிய அறிகுறிகள்: ${symptomLabels.join(', ')}. `;
    } else {
      summary += `குறிப்பிட்ட அறிகுறிகள் எதுவும் பதிவு செய்யப்படவில்லை. `;
    }

    if (vitalsSegments.length > 0) {
      summary += `உயிராதார அளவுகள்: ${vitalsSegments.join(', ')}. `;
    }

    if (dangerCount > 0) {
      summary += `எச்சரிக்கை: ${dangerCount} அவசர ஆபத்து அறிகுறிகள் கண்டறியப்பட்டுள்ளன. உடனடி மருத்துவ கவனிப்பு அவசியம்.`;
    }

    return summary.trim();
  }

  if (language === 'hi') {
    let summary = '';
    if (demoText) summary += `मरीज: ${demoText}। `;

    if (voiceTranscript && voiceTranscript.trim().length > 5) {
      summary += `मरीज का विवरण: "${voiceTranscript.trim()}"। `;
    }

    if (symptomLabels.length > 0) {
      summary += `प्रमुख लक्षण: ${symptomLabels.join(', ')}। `;
    } else {
      summary += `कोई विशिष्ट लक्षण दर्ज नहीं किया गया। `;
    }

    if (vitalsSegments.length > 0) {
      summary += `शारीरिक संकेत (वाइटल्स): ${vitalsSegments.join(', ')}। `;
    }

    if (dangerCount > 0) {
      summary += `चेतावनी: ${dangerCount} गंभीर खतरे के लक्षण पाए गए हैं। तुरंत चिकित्सीय जांच आवश्यक है।`;
    }

    return summary.trim();
  }

  if (language === 'mr') {
    let summary = '';
    if (demoText) summary += `रुग्ण: ${demoText}. `;

    if (voiceTranscript && voiceTranscript.trim().length > 5) {
      summary += `रुग्णाचे कथन: "${voiceTranscript.trim()}". `;
    }

    if (symptomLabels.length > 0) {
      summary += `प्रमुख लक्षणे: ${symptomLabels.join(', ')}. `;
    } else {
      summary += `कोणतीही विशिष्ट लक्षणे नोंदवली गेली नाहीत. `;
    }

    if (vitalsSegments.length > 0) {
      summary += `महत्त्वाचे शारीरिक निर्देशांक: ${vitalsSegments.join(', ')}. `;
    }

    if (dangerCount > 0) {
      summary += `धोक्याचा इशारा: ${dangerCount} गंभीर धोक्याची लक्षणे आढळली आहेत. त्वरित वैद्यकीय तपासणी आवश्यक.`;
    }

    return summary.trim();
  }

  // English
  let summary = '';
  if (demoText) summary += `Patient: ${demoText}. `;

  if (voiceTranscript && voiceTranscript.trim().length > 5) {
    summary += `Reported complaints: "${voiceTranscript.trim()}". `;
  }

  if (symptomLabels.length > 0) {
    summary += `Active symptoms: ${symptomLabels.join(', ')}. `;
  } else {
    summary += `No specific symptoms recorded. `;
  }

  if (vitalsSegments.length > 0) {
    summary += `Clinical vitals: ${vitalsSegments.join(', ')}. `;
  }

  if (dangerCount > 0) {
    summary += `Alert: ${dangerCount} red-flag danger sign(s) present. Immediate clinical evaluation required.`;
  }

  return summary.trim();
}
