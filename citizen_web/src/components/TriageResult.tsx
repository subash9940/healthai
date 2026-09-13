'use client';

import React, { useState } from 'react';
import { useI18n } from '../lib/useTranslation';

export interface TriageResultData {
  urgency: 'EMERGENCY' | 'HIGH' | 'MEDIUM' | 'LOW';
  rule_name: string;
  action_needed: string;
  recommended_action?: string;
  citizen_message?: string;
  recommended_facility_level: string;
  primary_protocol: string;
  danger_signs_present: string[];
  timestamp: string;
  problem_summary?: string;
  voice_transcript?: string;
  patient_summary: {
    age: number;
    symptoms: string[];
    name?: string;
    phone?: string;
    village?: string;
    address?: string;
    sex?: string;
    is_pregnant?: boolean;
    vitals?: {
      temperature_f?: number | null;
      systolic_bp?: number | null;
      diastolic_bp?: number | null;
      spo2_percent?: number | null;
      hemoglobin_g_dl?: number | null;
    };
  };
}

interface Props {
  result: TriageResultData;
  onRestart: () => void;
}

export default function TriageResult({ result, onRestart }: Props) {
  const { language, t } = useI18n();
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const urgencyClass = result.urgency.toLowerCase();

  // Localized urgency labels
  const urgencyLabel =
    language === 'ta'
      ? result.urgency === 'EMERGENCY'
        ? 'அவசர சிகிச்சை முன்னுரிமை (EMERGENCY)'
        : result.urgency === 'HIGH'
        ? 'உயர் முன்னுரிமை பராமரிப்பு (HIGH)'
        : result.urgency === 'MEDIUM'
        ? 'நடுத்தர முன்னுரிமை பராமரிப்பு (MEDIUM)'
        : 'குறைந்த முன்னுரிமை / இயல்பான பராமரிப்பு (LOW)'
      : language === 'hi'
      ? result.urgency === 'EMERGENCY'
        ? 'आपातकालीन प्राथमिकता (EMERGENCY)'
        : result.urgency === 'HIGH'
        ? 'उच्च प्राथमिकता देखभाल (HIGH)'
        : result.urgency === 'MEDIUM'
        ? 'मध्यम प्राथमिकता देखभाल (MEDIUM)'
        : 'सामान्य / कम प्राथमिकता देखभाल (LOW)'
      : language === 'mr'
      ? result.urgency === 'EMERGENCY'
        ? 'तातडीची आणीबाणी सेवा (EMERGENCY)'
        : result.urgency === 'HIGH'
        ? 'उच्च प्राधान्य काळजी (HIGH)'
        : result.urgency === 'MEDIUM'
        ? 'मध्यम प्राधान्य काळजी (MEDIUM)'
        : 'सामान्य प्राधान्य काळजी (LOW)'
      : `${result.urgency} PRIORITY CARE`;

  // Localized urgency descriptions
  const urgencyDesc =
    language === 'ta'
      ? result.urgency === 'EMERGENCY'
        ? 'உடனடி மருத்துவ கவனிப்பு அவசியம். உடனடியாக அவசர சிகிச்சை மையத்திற்கு செல்லவும்.'
        : result.urgency === 'HIGH'
        ? 'அவசர மருத்துவ ஆலோசனை தேவை. 12 முதல் 24 மணி நேரத்திற்குள் மருத்துவரை அணுகவும்.'
        : result.urgency === 'MEDIUM'
        ? 'உங்கள் ஆரம்ப சுகாதார நிலையத்தில் மருத்துவ பரிசோதனை செய்து கொள்ளவும்.'
        : 'லேசான அறிகுறிகள் காணப்படுகின்றன. வீட்டில் கவனிப்பு மற்றும் ASHA கண்காணிப்பு பரிந்துரைக்கப்படுகிறது.'
      : language === 'hi'
      ? result.urgency === 'EMERGENCY'
        ? 'तत्काल चिकित्सीय सहायता आवश्यक है। अविलंब नजदीकी आपातकालीन केंद्र जाएं।'
        : result.urgency === 'HIGH'
        ? 'शीघ्र परामर्श आवश्यक है। अगले 12 से 24 घंटों के भीतर डॉक्टर को दिखाएं।'
        : result.urgency === 'MEDIUM'
        ? 'अपने नजदीकी प्राथमिक स्वास्थ्य केंद्र में चिकित्सीय जांच कराएं।'
        : 'हल्के लक्षण हैं। घरेलू देखभाल और आशा कार्यकर्ता की निगरानी पर्याप्त है।'
      : language === 'mr'
      ? result.urgency === 'EMERGENCY'
        ? 'तातडीची वैद्यकीय मदत आवश्यक आहे. ताबडतोब रुग्णालयात जा.'
        : result.urgency === 'HIGH'
        ? 'तातडीने वैद्यकीय सल्ला घ्या. पुढील १२ ते २४ तासांत तपासणी करा.'
        : result.urgency === 'MEDIUM'
        ? 'आपल्या प्राथमिक आरोग्य केंद्रात वैद्यकीय तपासणी करून घ्या.'
        : 'लक्षणे सौम्य आहेत. घरगुती काळजी आणि आशा ताईंचे मार्गदर्शन पुरेसे आहे.'
      : result.urgency === 'EMERGENCY'
      ? 'Immediate medical intervention required. Proceed to emergency facility immediately.'
      : result.urgency === 'HIGH'
      ? 'Urgent consultation recommended within 12 to 24 hours.'
      : result.urgency === 'MEDIUM'
      ? 'Schedule a clinical assessment at your primary health centre.'
      : 'Mild symptoms detected. Supportive self-care and ASHA monitoring advised.';

  // Build 100% natural, fully localized speech synthesis script
  const handleSpeakAdvice = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported on this browser.');
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    const name = result.patient_summary.name;
    const summary = result.problem_summary || '';
    const isEmergencyOrHigh = result.urgency === 'EMERGENCY' || result.urgency === 'HIGH';

    let textToSpeak = '';

    if (language === 'ta') {
      textToSpeak =
        (name ? `வணக்கம் ${name} அவர்களே. ` : 'வணக்கம். ') +
        `உங்கள் ட்ரியாஜ் நிலை: ${urgencyLabel}. ` +
        (summary ? `நோயாளி பிரச்சனை சுருக்கம்: ${summary}. ` : '') +
        `பரிந்துரைக்கப்பட்ட மருத்துவ நடவடிக்கை: ${result.action_needed}. ` +
        `பரிந்துரைக்கப்பட்ட சுகாதார மையம்: ${result.recommended_facility_level}. ` +
        (isEmergencyOrHigh
          ? 'அவசர சிகிச்சை மற்றும் உதவிக்கு உடனடியாக 108 ஆம்புலன்ஸை அழைக்கவும்.'
          : 'தேவைப்பட்டால் உங்கள் ஏரியா ஆஷா ஊழியரைத் தொடர்பு கொள்ளவும்.');
    } else if (language === 'hi') {
      textToSpeak =
        (name ? `नमस्ते ${name} जी। ` : 'नमस्ते। ') +
        `आपकी ट्रायज प्राथमिकता: ${urgencyLabel}। ` +
        (summary ? `मरीज की समस्या का सारांश: ${summary}। ` : '') +
        `अनुशंसित चिकित्सीय कार्यवाही: ${result.action_needed}। ` +
        `अनुशंसित स्वास्थ्य केंद्र: ${result.recommended_facility_level}। ` +
        (isEmergencyOrHigh
          ? 'आपातकालीन सहायता के लिए तुरंत 108 एम्बुलेंस पर कॉल करें।'
          : 'आवश्यकता पड़ने पर अपनी आशा कार्यकर्ता से संपर्क करें।');
    } else if (language === 'mr') {
      textToSpeak =
        (name ? `नमस्कार ${name} जी. ` : 'नमस्कार. ') +
        `आपला ट्रायज स्तर: ${urgencyLabel}. ` +
        (summary ? `रुग्णाची समस्या सारांश: ${summary}. ` : '') +
        `शिफारस केलेली कृती: ${result.action_needed}. ` +
        `शिफारस केलेले रुग्णालय: ${result.recommended_facility_level}. ` +
        (isEmergencyOrHigh
          ? 'तातडीच्या मदतीसाठी लगेच १०८ रुग्णवाहिकेला कॉल करा.'
          : 'गरज भासल्यास आपल्या आशा ताईंशी संपर्क साधा.');
    } else {
      textToSpeak =
        (name ? `Hello ${name}. ` : 'Hello. ') +
        `Triage priority level: ${result.urgency}. ` +
        (summary ? `Patient problem summary: ${summary}. ` : '') +
        `Recommended clinical action: ${result.action_needed}. ` +
        `Recommended facility: ${result.recommended_facility_level}. ` +
        (isEmergencyOrHigh
          ? 'For emergency transport, please call 108 ambulance services immediately.'
          : 'Follow up with your local ASHA worker if symptoms persist.');
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const langMap: Record<string, string> = {
      en: 'en-IN',
      hi: 'hi-IN',
      ta: 'ta-IN',
      mr: 'mr-IN',
    };
    utterance.lang = langMap[language] || 'en-IN';
    utterance.rate = 0.95;

    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="result-card">
      {/* Header Banner */}
      <div className="result-slip-head">
        <div>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            {language === 'ta'
              ? 'அரசு அதிகாரப்பூர்வ மருத்துவ பரிந்துரை சீட்டு'
              : language === 'hi'
              ? 'आधिकारिक चिकित्सीय रेफरल पर्ची'
              : language === 'mr'
              ? 'अधिकृत वैद्यकीय रेफरल स्लिप'
              : 'Official Clinical Referral Slip'}
          </span>
          <div className="result-slip-title">
            Clinical Referral #{result.rule_name}
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {new Date(result.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
      </div>

      {/* Patient Demographics Info Strip */}
      <div
        style={{
          padding: '12px 16px',
          background: 'var(--bg-subtle)',
          borderBottom: '1px solid var(--border-light)',
          fontSize: '13px',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <strong>{language === 'ta' ? 'நோயாளி' : language === 'hi' ? 'मरीज' : language === 'mr' ? 'रुग्ण' : 'Patient'}:</strong>{' '}
          {result.patient_summary.name || 'Anonymous'}{' '}
          ({result.patient_summary.age}y, {result.patient_summary.sex || 'N/A'})
        </div>
        {result.patient_summary.phone && (
          <div>
            <strong>{language === 'ta' ? 'மொபைல்' : language === 'hi' ? 'फोन' : language === 'mr' ? 'मोबाईल' : 'Phone'}:</strong>{' '}
            {result.patient_summary.phone}
          </div>
        )}
        {result.patient_summary.village && (
          <div>
            <strong>{language === 'ta' ? 'கிராமம்' : language === 'hi' ? 'गाँव' : language === 'mr' ? 'गाव' : 'Village'}:</strong>{' '}
            {result.patient_summary.village}
          </div>
        )}
      </div>

      {/* Severity Color Strip */}
      <div className={`result-severity-banner ${urgencyClass}`} role="status">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '24px' }}>
            {result.urgency === 'EMERGENCY'
              ? '🚨'
              : result.urgency === 'HIGH'
              ? '⚠️'
              : result.urgency === 'MEDIUM'
              ? '📋'
              : '✅'}
          </span>
          <div>
            <div className="severity-heading">
              {urgencyLabel}
            </div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>
              {urgencyDesc}
            </div>
          </div>
        </div>
      </div>

      {/* Patient Problem Summary Box */}
      {result.problem_summary && (
        <div
          style={{
            padding: '14px 18px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-light)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>
            📝 {language === 'ta'
              ? 'நோயாளி பிரச்சனை சுருக்கம் (Patient Problem Summary)'
              : language === 'hi'
              ? 'मरीज की समस्या का सारांश (Patient Problem Summary)'
              : language === 'mr'
              ? 'रुग्णाच्या समस्येचा सारांश (Patient Problem Summary)'
              : 'Clinical Problem Summary & Patient Narrative'}
          </div>
          <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-dark)', fontWeight: 500 }}>
            {result.problem_summary}
          </div>
        </div>
      )}

      {/* Citizen Advice & Speech Synthesis */}
      <div className="citizen-advice-box">
        <div className="citizen-advice-label">
          {language === 'ta'
            ? 'பரிந்துரைக்கப்பட்ட மருத்துவ நடவடிக்கை (Duration & Clinical Protocol)'
            : language === 'hi'
            ? 'अनुशंसित चिकित्सीय कार्यवाही (Duration & Clinical Protocol)'
            : language === 'mr'
            ? 'शिफारस केलेली वैद्यकीय कृती (Duration & Clinical Protocol)'
            : 'Recommended Clinical Action & Protocol'}
        </div>
        <div className="citizen-advice-text">
          {result.recommended_action || result.action_needed}
        </div>

        {result.citizen_message && result.citizen_message !== (result.recommended_action || result.action_needed) && (
          <div
            style={{
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: '1px dashed var(--border-light, #e2e8f0)',
              fontSize: '13px',
              color: 'var(--text-muted, #64748b)',
            }}
          >
            <strong>{language === 'ta' ? 'நோயாளி ஆலோசனை:' : language === 'hi' ? 'रोगी परामर्श:' : language === 'mr' ? 'रुग्ण सल्ला:' : 'Patient Counseling:'}</strong>{' '}
            {result.citizen_message}
          </div>
        )}

        <div className="audio-bar">
          <button
            type="button"
            className="audio-btn"
            onClick={handleSpeakAdvice}
            aria-label={isPlayingAudio ? 'Stop voice reading' : 'Listen to clinical advice in your language'}
          >
            <span>{isPlayingAudio ? '⏹️' : '🔊'}</span>
            <span>
              {isPlayingAudio
                ? (language === 'ta' ? 'ஆடியோ வாசிப்பை நிறுத்துக' : language === 'hi' ? 'ऑडियो रोकें' : language === 'mr' ? 'ऑडिओ थांबवा' : 'Stop Audio Readout')
                : (language === 'ta' ? 'மருத்துவ ஆலோசனையைக் கேளுங்கள்' : language === 'hi' ? 'चिकित्सीय परामर्श सुनें' : language === 'mr' ? 'वैद्यकीय सल्ला ऐका' : 'Listen to Clinical Advice')}
            </span>
          </button>
        </div>
      </div>

      {/* Facility & Routing Information */}
      <div className="action-split">
        <div className="action-box">
          <div className="action-box-title">
            {language === 'ta'
              ? 'பரிந்துரைக்கப்பட்ட மருத்துவமனை'
              : language === 'hi'
              ? 'अनुशंसित स्वास्थ्य केंद्र'
              : language === 'mr'
              ? 'शिफारस केलेले रुग्णालय'
              : 'Recommended Facility Level'}
          </div>
          <div className="action-box-facility">
            {result.recommended_facility_level}
          </div>
          <div className="action-box-desc">
            {language === 'ta'
              ? 'தேவையான சிகிச்சை மற்றும் மருத்துவ உபகரணங்கள் கொண்ட சுகாதார மையம்.'
              : language === 'hi'
              ? 'आवश्यक ट्रायज और उपचार सुविधाओं से युक्त प्राथमिक स्वास्थ्य केंद्र।'
              : language === 'mr'
              ? 'आवश्यक सुविधा आणि आरोग्य कर्मचाऱ्यांनी सुसज्ज केंद्र.'
              : 'Primary care facility equipped with required triage protocols and personnel.'}
          </div>
        </div>

        <div className="action-box">
          <div className="action-box-title">
            {language === 'ta'
              ? 'பயன்படுத்தப்பட்ட மருத்துவ விதி'
              : language === 'hi'
              ? 'लागू किया गया प्रोटोकॉल'
              : language === 'mr'
              ? 'वापरलेला वैद्यकीय नियम'
              : 'Clinical Protocol Fired'}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '4px' }}>
            {result.primary_protocol}
          </div>
          <div className="action-box-desc">
            {result.danger_signs_present.length > 0 ? (
              <span style={{ color: 'var(--urgency-emergency)', fontWeight: 600 }}>
                🚨 {result.danger_signs_present.length}{' '}
                {language === 'ta' ? 'ஆபத்து அறிகுறிகள் கண்டறியப்பட்டன.' : language === 'hi' ? 'खतरे के लक्षण पाए गए।' : language === 'mr' ? 'धोक्याची लक्षणे आढळली.' : 'danger signs triggered this protocol.'}
              </span>
            ) : (
              <span>National Health Mission evidence-based clinical rule.</span>
            )}
          </div>
        </div>
      </div>

      {/* Emergency Contact Quick Links if HIGH/EMERGENCY */}
      {(result.urgency === 'EMERGENCY' || result.urgency === 'HIGH') && (
        <div
          style={{
            padding: '16px 20px',
            background: 'var(--urgency-emergency-bg)',
            borderTop: '1px solid var(--urgency-emergency-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--urgency-emergency)' }}>
            {language === 'ta'
              ? 'உடனடி வாகன உதவி தேவைப்பட்டால் ஆம்புலன்ஸை அழைக்கவும்:'
              : language === 'hi'
              ? 'तत्काल अस्पताल जाने के लिए एम्बुलेंस सेवा को कॉल करें:'
              : language === 'mr'
              ? 'तातडीने रुग्णवाहिका सेवेसाठी कॉल करा:'
              : 'Immediate transport required? Call ambulance services:'}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <a href="tel:108" className="emergency-phone-link">
              📞 Call 108
            </a>
            <a href="tel:104" className="helpline-phone-link">
              ℹ️ Call 104
            </a>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ padding: '20px', background: 'var(--bg-surface)', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={handlePrint}
        >
          🖨️ {language === 'ta' ? 'பரிந்துரை சீட்டை அச்சிடுக' : language === 'hi' ? 'रेफरल पर्ची प्रिंट करें' : language === 'mr' ? 'रेफरल स्लिप प्रिंट करा' : 'Print Referral Slip'}
        </button>

        <button
          type="button"
          className="btn-primary"
          onClick={onRestart}
        >
          🔄 {language === 'ta' ? 'புதிய பரிசோதனையைத் தொடங்கு' : language === 'hi' ? 'नया आकलन शुरू करें' : language === 'mr' ? 'नवीन तपासणी सुरू करा' : 'Start New Assessment'}
        </button>
      </div>
    </div>
  );
}
