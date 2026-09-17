'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useI18n, Language } from '../lib/useTranslation';
import { SYMPTOM_DEFINITIONS, getSymptomName, extractSymptomsFromSpeech } from '../lib/symptomTranslations';
import { extractSymptomsLocal } from '../lib/localExtractor';
import { generateProblemSummary } from '../lib/problemSummary';

interface Props {
  selectedSymptoms: string[];
  symptomDurationDays?: number | null;
  problemSummary: string;
  voiceTranscript: string;
  demographics?: {
    patient_name?: string;
    age_years?: number;
    patient_sex?: 'male' | 'female' | 'other';
    is_pregnant?: boolean;
  };
  onToggleSymptom: (key: string) => void;
  onSelectSymptomList: (keys: string[]) => void;
  onChangeSymptomDurationDays: (days: number | null) => void;
  onChangeProblemSummary: (summary: string) => void;
  onChangeVoiceTranscript: (transcript: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const DURATION_OPTIONS = [
  { days: 0, label: 'Today / just started' },
  { days: 2, label: '1-2 days' },
  { days: 4, label: '3-4 days' },
  { days: 6, label: '5-7 days' },
  { days: 10, label: 'More than a week' },
];

export default function StepSymptoms({
  selectedSymptoms,
  symptomDurationDays,
  problemSummary,
  voiceTranscript,
  demographics,
  onToggleSymptom,
  onSelectSymptomList,
  onChangeSymptomDurationDays,
  onChangeProblemSummary,
  onChangeVoiceTranscript,
  onNext,
  onBack,
}: Props) {
  const { language, t } = useI18n();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [isPlayingSummary, setIsPlayingSummary] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);
  const isManuallyStoppedRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as any;
      if (win.SpeechRecognition || win.webkitSpeechRecognition) {
        setSpeechSupported(true);
      }
    }
  }, []);

  // Update summary automatically when symptoms change if user hasn't heavily customized it
  const updateSummaryFromState = (newSymptoms: string[], transcriptText?: string) => {
    const freshSummary = generateProblemSummary({
      language: language as Language,
      symptoms: newSymptoms,
      voiceTranscript: transcriptText !== undefined ? transcriptText : voiceTranscript,
      patientName: demographics?.patient_name,
      ageYears: demographics?.age_years,
      sex: demographics?.patient_sex,
      isPregnant: demographics?.is_pregnant,
    });
    onChangeProblemSummary(freshSummary);
  };

  // Provide voice synthesis playback in chosen language
  const speakInSubLanguage = (text: string, onEndCallback?: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const langMap: Record<string, string> = {
        en: 'en-IN',
        hi: 'hi-IN',
        ta: 'ta-IN',
        mr: 'mr-IN',
      };
      utterance.lang = langMap[language] || 'en-IN';
      utterance.rate = 0.95;
      utterance.onend = () => {
        if (onEndCallback) onEndCallback();
      };
      utterance.onerror = () => {
        if (onEndCallback) onEndCallback();
      };
      window.speechSynthesis.speak(utterance);
    } catch {
      if (onEndCallback) onEndCallback();
    }
  };

  const handleToggleSummaryAudio = () => {
    if (isPlayingSummary) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingSummary(false);
    } else {
      const summaryToRead = problemSummary.trim() || generateProblemSummary({
        language: language as Language,
        symptoms: selectedSymptoms,
        voiceTranscript,
        patientName: demographics?.patient_name,
        ageYears: demographics?.age_years,
        sex: demographics?.patient_sex,
        isPregnant: demographics?.is_pregnant,
      });

      setIsPlayingSummary(true);
      speakInSubLanguage(summaryToRead, () => setIsPlayingSummary(false));
    }
  };

  // Web Speech API with Continuous Mode & Auto-Recovery in selected language
  const handleVoiceInput = () => {
    if (typeof window === 'undefined') return;
    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      isManuallyStoppedRef.current = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    try {
      isManuallyStoppedRef.current = false;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      const langMap: Record<string, string> = {
        en: 'en-IN',
        hi: 'hi-IN',
        ta: 'ta-IN',
        mr: 'mr-IN',
      };
      recognition.lang = langMap[language] || 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceNotice(null);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + ' ';
        }
        transcript = transcript.trim();
        onChangeVoiceTranscript(transcript);

        // Smart Multilingual Symptom & Duration Extraction
        const extracted = extractSymptomsFromSpeech(transcript, language);
        const localParsed = extractSymptomsLocal(transcript, language);
        const allExtractedSymptoms = Array.from(new Set([...extracted, ...(localParsed.symptoms || [])]));
        const combined = Array.from(new Set([...selectedSymptoms, ...allExtractedSymptoms]));
        if (combined.length > selectedSymptoms.length) {
          onSelectSymptomList(combined);
        }

        // Auto-fill duration if extracted from speech and not manually overridden
        if (localParsed.duration_days !== null && localParsed.duration_days !== undefined) {
          const days = localParsed.duration_days;
          // Map to nearest ICMR bucket (0, 2, 4, 6, 10)
          let bucket = 0;
          if (days <= 0) bucket = 0;
          else if (days <= 2) bucket = 2;
          else if (days <= 4) bucket = 4;
          else if (days <= 7) bucket = 6;
          else bucket = 10;
          onChangeSymptomDurationDays(bucket);
        }

        // Generate comprehensive problem summary in the user's selected language
        const generated = generateProblemSummary({
          language: language as Language,
          symptoms: combined,
          voiceTranscript: transcript,
          patientName: demographics?.patient_name,
          ageYears: demographics?.age_years,
          sex: demographics?.patient_sex,
          isPregnant: demographics?.is_pregnant,
        });
        onChangeProblemSummary(generated);

        const feedbackMsg =
          language === 'ta'
            ? `உங்கள் பிரச்சனையின் விவரங்கள் பெறப்பட்டு சுருக்கம் உருவாக்கப்பட்டது`
            : language === 'hi'
            ? `आपकी समस्या का विवरण दर्ज कर सारांश तैयार कर दिया गया है`
            : language === 'mr'
            ? `आपल्या समस्येचे वर्णन नोंदवून सारांश तयार करण्यात आला आहे`
            : `Problem transcribed and clinical summary synthesized.`;
        setVoiceNotice(feedbackMsg);
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.warn('Speech recognition notice:', event.error);
        }
      };

      recognition.onend = () => {
        if (!isManuallyStoppedRef.current && isListening) {
          try {
            recognition.start();
          } catch {
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const filtered = SYMPTOM_DEFINITIONS.filter((s) => {
    const localizedName = getSymptomName(s.key, language).toLowerCase();
    const keyMatch =
      s.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      localizedName.includes(searchQuery.toLowerCase());
    const catMatch =
      activeCategory === 'all' ||
      s.category === activeCategory ||
      (activeCategory === 'danger' && s.is_danger);
    return catMatch && keyMatch;
  });

  const dangerSelected = selectedSymptoms.some(
    (k) => SYMPTOM_DEFINITIONS.find((s) => s.key === k)?.is_danger
  );

  return (
    <div className="form-card">
      <div className="form-header">
        <h2>{t('symptoms.title') !== 'symptoms.title' ? t('symptoms.title') : 'What symptoms are they having?'}</h2>
        <p>{t('symptoms.subtitle') !== 'symptoms.subtitle' ? t('symptoms.subtitle') : 'Select everything that applies. Red items are urgent danger signs.'}</p>
      </div>

      {/* Subtle Danger Notice (Clean institutional styling) */}
      {dangerSelected && (
        <div
          role="note"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            marginBottom: '16px',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-light)',
            borderLeft: '4px solid var(--urgency-emergency)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            color: 'var(--text-dark)',
          }}
        >
          <span style={{ fontSize: '15px' }}>ℹ️</span>
          <span>{t('symptoms.dangerSignAlert') !== 'symptoms.dangerSignAlert' ? t('symptoms.dangerSignAlert') : 'You selected one or more urgent danger signs. This person will likely need medical attention right away.'}</span>
        </div>
      )}

      {/* Voice Assistant / Search Bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="form-input"
          style={{ flex: 1, minWidth: '200px' }}
          placeholder={t('symptoms.searchPlaceholder') !== 'symptoms.searchPlaceholder' ? t('symptoms.searchPlaceholder') : 'Search symptoms (e.g. cough, fever, pain)...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Filter symptoms"
        />

        {speechSupported && (
          <button
            type="button"
            className={`btn-secondary ${isListening ? 'active' : ''}`}
            onClick={handleVoiceInput}
            style={{
              borderColor: isListening ? 'var(--urgency-emergency)' : undefined,
              color: isListening ? 'var(--urgency-emergency)' : undefined,
              gap: '6px',
            }}
            aria-label={isListening ? 'Stop recording' : 'Start voice input in selected language'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, animation: isListening ? 'pulse 1s infinite' : 'none' }}>
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
            <span>
              {isListening
                ? t('symptoms.nlp.listening') !== 'symptoms.nlp.listening'
                  ? t('symptoms.nlp.listening')
                  : 'Listening…'
                : t('symptoms.nlp.startMic') !== 'symptoms.nlp.startMic'
                ? t('symptoms.nlp.startMic')
                : 'Voice Input'}
            </span>
          </button>
        )}
      </div>

      {voiceTranscript && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <div>
            <strong>{language === 'ta' ? 'பேசிய உரை' : language === 'hi' ? 'बोला गया विवरण' : language === 'mr' ? 'बोललेला मजकूर' : 'Spoken Voice'}:</strong> &ldquo;{voiceTranscript}&rdquo;
          </div>
        </div>
      )}

      {voiceNotice && (
        <div style={{ fontSize: '13px', color: 'var(--urgency-low-border)', fontWeight: 600, marginBottom: '12px', padding: '6px 12px', background: 'var(--urgency-low-bg)', borderRadius: '4px' }}>
          ✓ {voiceNotice}
        </div>
      )}

      {/* Structured Clinical Problem Summary Card */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
              <span>{language === 'ta'
                ? 'நோயாளி பிரச்சனையின் மருத்துவ சுருக்கம் (Patient Problem Summary)'
                : language === 'hi'
                ? 'मरीज की समस्या का चिकित्सीय सारांश (Patient Problem Summary)'
                : language === 'mr'
                ? 'रुग्णाच्या समस्येचा वैद्यकीय सारांश (Patient Problem Summary)'
                : 'Patient Problem Summary & Clinical Narrative'}</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {language === 'ta'
                ? 'பேசிய விவரங்கள் மற்றும் அறிகுறிகளின் அடிப்படையில் உருவாக்கப்பட்ட சுருக்கம்.'
                : language === 'hi'
                ? 'बोली गई समस्या और लक्षणों के आधार पर तैयार किया गया विवरण।'
                : language === 'mr'
                ? 'आपण सांगितलेल्या तक्रारींवर आणि लक्षणांवर आधारित सारांश.'
                : 'Synthesized clinical narrative from patient report and active symptoms.'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="audio-btn"
              style={{ fontSize: '12px', padding: '4px 10px', height: '32px' }}
              onClick={handleToggleSummaryAudio}
              aria-label="Listen to summary"
            >
              {isPlayingSummary ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
              )}
              <span>{isPlayingSummary
                ? (language === 'ta' ? 'நிறுத்துக' : language === 'hi' ? 'रोकें' : language === 'mr' ? 'थांबवा' : 'Stop')
                : (language === 'ta' ? 'கேளுங்கள்' : language === 'hi' ? 'सुनें' : language === 'mr' ? 'ऐका' : 'Listen')}</span>
            </button>

            <button
              type="button"
              style={{
                fontSize: '11px',
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-subtle)',
                color: 'var(--text-dark)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
              onClick={() => updateSummaryFromState(selectedSymptoms)}
              title="Regenerate summary from selected symptoms"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
              </svg>
              <span>{language === 'ta' ? 'மீண்டும் உருவாக்கு' : language === 'hi' ? 'पुनः सारांश बनाएं' : language === 'mr' ? 'पुन्हा तयार करा' : 'Auto-Summarize'}</span>
            </button>
          </div>
        </div>

        <textarea
          className="form-input"
          style={{ width: '100%', minHeight: '65px', fontSize: '13px', lineHeight: 1.5, resize: 'vertical' }}
          placeholder={
            language === 'ta'
              ? 'நோயாளி பிரச்சனையின் சுருக்கம் இங்கே தானாகத் தோன்றும் அல்லது நீங்களே தட்டச்சு செய்யலாம்...'
              : language === 'hi'
              ? 'मरीज की समस्या का सारांश यहां दिखाई देगा या आप लिख सकते हैं...'
              : language === 'mr'
              ? 'रुग्णाच्या समस्येचा सारांश येथे दिसेल किंवा आपण टाइप करू शकता...'
              : 'Patient problem summary will appear here automatically or can be typed...'
          }
          value={problemSummary}
          onChange={(e) => onChangeProblemSummary(e.target.value)}
          aria-label="Clinical problem summary"
        />
      </div>

      {/* Symptom Duration Segmented Control (ICMR Duration Staging) */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          marginBottom: '16px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>{t('symptoms.durationTitle') !== 'symptoms.durationTitle' ? t('symptoms.durationTitle') : 'How long have symptoms been present?'}</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '8px',
          }}
          role="radiogroup"
          aria-label="Symptom Duration"
        >
          {DURATION_OPTIONS.map((opt) => {
            const isSelected = symptomDurationDays === opt.days;
            const bucketKey = `symptoms.durationBuckets.d${opt.days}`;
            const bucketLabel = t(bucketKey) !== bucketKey ? t(bucketKey) : opt.label;
            return (
              <button
                key={opt.days}
                type="button"
                className={`cat-btn ${isSelected ? 'active' : ''}`}
                style={{
                  padding: '10px 8px',
                  fontSize: '13px',
                  fontWeight: isSelected ? 700 : 500,
                  textAlign: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius-sm)',
                  border: isSelected ? '2px solid var(--primary, #1e40af)' : '1px solid var(--border-light, #e2e8f0)',
                  backgroundColor: isSelected ? 'var(--primary-light, #eff6ff)' : 'var(--bg-subtle, #f8fafc)',
                  color: isSelected ? 'var(--primary, #1e40af)' : 'var(--text-dark, #1e293b)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => onChangeSymptomDurationDays(isSelected ? null : opt.days)}
                role="radio"
                aria-checked={isSelected}
              >
                {bucketLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Pills */}
      <div className="symptoms-category-bar" role="tablist" aria-label="Symptom Categories">
        <button
          type="button"
          className={`cat-btn ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => setActiveCategory('all')}
          role="tab"
          aria-selected={activeCategory === 'all'}
        >
          {t('symptoms.categories.all') !== 'symptoms.categories.all' ? t('symptoms.categories.all') : 'All Symptoms'}
        </button>
        <button
          type="button"
          className={`cat-btn danger-cat ${activeCategory === 'danger' ? 'active' : ''}`}
          onClick={() => setActiveCategory('danger')}
          role="tab"
          aria-selected={activeCategory === 'danger'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{t('symptoms.categories.danger') !== 'symptoms.categories.danger' ? t('symptoms.categories.danger') : 'Urgent Danger Signs'}</span>
        </button>
        <button
          type="button"
          className={`cat-btn ${activeCategory === 'cardiac' ? 'active' : ''}`}
          onClick={() => setActiveCategory('cardiac')}
          role="tab"
          aria-selected={activeCategory === 'cardiac'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          <span>{language === 'ta' ? 'நெஞ்சு / இதயம்' : language === 'hi' ? 'सीना / हृदय' : language === 'mr' ? 'छाती / हृदय' : 'Chest / Heart'}</span>
        </button>
        <button
          type="button"
          className={`cat-btn ${activeCategory === 'maternal' ? 'active' : ''}`}
          onClick={() => setActiveCategory('maternal')}
          role="tab"
          aria-selected={activeCategory === 'maternal'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M12 2a4 4 0 0 0-4 4v2a6 6 0 0 0-6 6v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a6 6 0 0 0-6-6V6a4 4 0 0 0-4-4z"></path>
            <circle cx="12" cy="14" r="3"></circle>
          </svg>
          <span>{t('symptoms.categories.maternal') !== 'symptoms.categories.maternal' ? t('symptoms.categories.maternal') : 'Pregnancy & Childbirth'}</span>
        </button>
        <button
          type="button"
          className={`cat-btn ${activeCategory === 'respiratory' ? 'active' : ''}`}
          onClick={() => setActiveCategory('respiratory')}
          role="tab"
          aria-selected={activeCategory === 'respiratory'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M6 3v8a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          <span>{t('symptoms.categories.respiratory') !== 'symptoms.categories.respiratory' ? t('symptoms.categories.respiratory') : 'Cough & Breathing'}</span>
        </button>
        <button
          type="button"
          className={`cat-btn ${activeCategory === 'fever' ? 'active' : ''}`}
          onClick={() => setActiveCategory('fever')}
          role="tab"
          aria-selected={activeCategory === 'fever'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path>
          </svg>
          <span>{t('symptoms.categories.fever') !== 'symptoms.categories.fever' ? t('symptoms.categories.fever') : 'Fever & Infections'}</span>
        </button>
        <button
          type="button"
          className={`cat-btn ${activeCategory === 'pediatric' ? 'active' : ''}`}
          onClick={() => setActiveCategory('pediatric')}
          role="tab"
          aria-selected={activeCategory === 'pediatric'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="8" r="5"></circle>
            <path d="M3 20c0-3.3 2.7-6 6-6h6c3.3 0 6 2.7 6 6"></path>
            <circle cx="12" cy="8" r="2"></circle>
          </svg>
          <span>{language === 'ta' ? 'குழந்தை / சிசு' : language === 'hi' ? 'शिशु / बाल' : language === 'mr' ? 'लहान मुले' : 'Child / Infant'}</span>
        </button>
      </div>

      {/* Selected Count Indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
          {t('symptoms.selectedCount') !== 'symptoms.selectedCount' ? t('symptoms.selectedCount') : 'Selected symptoms:'} {selectedSymptoms.length}
        </span>
        {selectedSymptoms.length > 0 && (
          <button
            type="button"
            style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => {
              onSelectSymptomList([]);
              updateSummaryFromState([]);
            }}
          >
            {t('symptoms.clearAll') !== 'symptoms.clearAll' ? t('symptoms.clearAll') : 'Clear all'}
          </button>
        )}
      </div>

      {/* Symptoms List Grid with Dynamic Native Translations */}
      <div className="symptoms-list" role="group" aria-label="Available Symptoms">
        {filtered.map((s) => {
          const isSelected = selectedSymptoms.includes(s.key);
          const label = getSymptomName(s.key, language);

          return (
            <button
              key={s.key}
              type="button"
              className={`symptom-card ${isSelected ? 'selected' : ''} ${s.is_danger ? 'danger' : ''}`}
              onClick={() => {
                const nextList = isSelected
                  ? selectedSymptoms.filter((k) => k !== s.key)
                  : [...selectedSymptoms, s.key];
                onToggleSymptom(s.key);
                updateSummaryFromState(nextList);
              }}
              aria-pressed={isSelected}
            >
              <div className="checkbox-box" aria-hidden="true">
                {isSelected ? '✓' : ''}
              </div>
              <div style={{ flex: 1 }}>
                {s.is_danger && (
                  <div className="danger-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>{t('symptoms.dangerBadge') !== 'symptoms.dangerBadge' ? t('symptoms.dangerBadge') : 'Danger Sign'}</span>
                  </div>
                )}
                <div className="symptom-name">{label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Navigation Buttons */}
      <div className="btn-row">
        <button type="button" className="btn-secondary" onClick={onBack}>
          ← {t('symptoms.prevButton') !== 'symptoms.prevButton' ? t('symptoms.prevButton') : 'Back'}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={onNext}
          disabled={selectedSymptoms.length === 0}
        >
          {t('symptoms.nextVitalsButton') !== 'symptoms.nextVitalsButton' ? t('symptoms.nextVitalsButton') : 'Continue to Vitals →'}
        </button>
      </div>
    </div>
  );
}
