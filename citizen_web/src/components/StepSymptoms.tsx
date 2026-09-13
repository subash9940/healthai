'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useI18n, Language } from '../lib/useTranslation';
import { SYMPTOM_DEFINITIONS, getSymptomName, extractSymptomsFromSpeech } from '../lib/symptomTranslations';
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

        // Smart Multilingual Symptom Extraction
        const extracted = extractSymptomsFromSpeech(transcript, language);
        const combined = Array.from(new Set([...selectedSymptoms, ...extracted]));
        if (combined.length > selectedSymptoms.length) {
          onSelectSymptomList(combined);
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
            <span style={{ animation: isListening ? 'pulse 1s infinite' : 'none' }}>🎤</span>
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
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: '4px' }}>
          🗣️ <strong>{language === 'ta' ? 'பேசிய உரை' : language === 'hi' ? 'बोला गया विवरण' : language === 'mr' ? 'बोललेला मजकूर' : 'Spoken Voice'}:</strong> &ldquo;{voiceTranscript}&rdquo;
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
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-dark)' }}>
              📝 {language === 'ta'
                ? 'நோயாளி பிரச்சனையின் மருத்துவ சுருக்கம் (Patient Problem Summary)'
                : language === 'hi'
                ? 'मरीज की समस्या का चिकित्सीय सारांश (Patient Problem Summary)'
                : language === 'mr'
                ? 'रुग्णाच्या समस्येचा वैद्यकीय सारांश (Patient Problem Summary)'
                : 'Patient Problem Summary & Clinical Narrative'}
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
              <span>{isPlayingSummary ? '⏹️' : '🔊'}</span>
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
              }}
              onClick={() => updateSummaryFromState(selectedSymptoms)}
              title="Regenerate summary from selected symptoms"
            >
              🔄 {language === 'ta' ? 'மீண்டும் உருவாக்கு' : language === 'hi' ? 'पुनः सारांश बनाएं' : language === 'mr' ? 'पुन्हा तयार करा' : 'Auto-Summarize'}
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
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '8px' }}>
          ⏱️ {t('symptoms.durationTitle') !== 'symptoms.durationTitle' ? t('symptoms.durationTitle') : 'How long have symptoms been present?'}
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
          🚨 {t('symptoms.categories.danger') !== 'symptoms.categories.danger' ? t('symptoms.categories.danger') : 'Urgent Danger Signs'}
        </button>
        <button
          type="button"
          className={`cat-btn ${activeCategory === 'cardiac' ? 'active' : ''}`}
          onClick={() => setActiveCategory('cardiac')}
          role="tab"
          aria-selected={activeCategory === 'cardiac'}
        >
          🫀 {language === 'ta' ? 'நெஞ்சு / இதயம்' : language === 'hi' ? 'सीना / हृदय' : language === 'mr' ? 'छाती / हृदय' : 'Chest / Heart'}
        </button>
        <button
          type="button"
          className={`cat-btn ${activeCategory === 'maternal' ? 'active' : ''}`}
          onClick={() => setActiveCategory('maternal')}
          role="tab"
          aria-selected={activeCategory === 'maternal'}
        >
          🤰 {t('symptoms.categories.maternal') !== 'symptoms.categories.maternal' ? t('symptoms.categories.maternal') : 'Pregnancy & Childbirth'}
        </button>
        <button
          type="button"
          className={`cat-btn ${activeCategory === 'respiratory' ? 'active' : ''}`}
          onClick={() => setActiveCategory('respiratory')}
          role="tab"
          aria-selected={activeCategory === 'respiratory'}
        >
          🫁 {t('symptoms.categories.respiratory') !== 'symptoms.categories.respiratory' ? t('symptoms.categories.respiratory') : 'Cough & Breathing'}
        </button>
        <button
          type="button"
          className={`cat-btn ${activeCategory === 'fever' ? 'active' : ''}`}
          onClick={() => setActiveCategory('fever')}
          role="tab"
          aria-selected={activeCategory === 'fever'}
        >
          🌡️ {t('symptoms.categories.fever') !== 'symptoms.categories.fever' ? t('symptoms.categories.fever') : 'Fever & Infections'}
        </button>
        <button
          type="button"
          className={`cat-btn ${activeCategory === 'pediatric' ? 'active' : ''}`}
          onClick={() => setActiveCategory('pediatric')}
          role="tab"
          aria-selected={activeCategory === 'pediatric'}
        >
          👶 {language === 'ta' ? 'குழந்தை / சிசு' : language === 'hi' ? 'शिशु / बाल' : language === 'mr' ? 'लहान मुले' : 'Child / Infant'}
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
                  <div className="danger-tag">
                    🚨 {t('symptoms.dangerBadge') !== 'symptoms.dangerBadge' ? t('symptoms.dangerBadge') : 'Danger Sign'}
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
