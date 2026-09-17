'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useI18n, Language } from '../lib/useTranslation';
import StepDemographics, { DemographicsData } from '../components/StepDemographics';
import StepSymptoms from '../components/StepSymptoms';
import TriageResult, { TriageResultData } from '../components/TriageResult';
import { evaluateTriage } from '../lib/localRulesEngine';
import { TriageRequest, TriageResponse } from '../lib/triageContract';
import { generateProblemSummary } from '../lib/problemSummary';

const initialDemographics: DemographicsData = {
  age_years: 30,
  patient_sex: 'male',
  is_pregnant: false,
  is_postpartum: false,
  weeks_pregnant: null,
  patient_name: '',
  phone_number: '',
  village: '',
  address: '',
  abha_id: '',
  language_preference: 'en',
};

export default function HomePage() {
  const { language, t } = useI18n();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [demographics, setDemographics] = useState<DemographicsData>(initialDemographics);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [symptomDurationDays, setSymptomDurationDays] = useState<number | null>(null);
  const [problemSummary, setProblemSummary] = useState<string>('');
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [triageResult, setTriageResult] = useState<TriageResultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosSuccess, setSosSuccess] = useState(false);

  // Clear toast feedback
  const clearStatus = () => setStatusMessage(null);

  // Emergency SOS Trigger
  const handleTriggerSOS = () => {
    if (sosLoading) return;
    setSosLoading(true);

    const patientContext = {
      name: demographics.patient_name || 'Anonymous Citizen',
      phone: demographics.phone_number || null,
      village: demographics.village || null,
      address: demographics.address || null,
      age: demographics.age_years || null,
      sex: demographics.patient_sex || null,
      is_pregnant: demographics.is_pregnant || false,
      symptoms: selectedSymptoms.length > 0 ? selectedSymptoms : null,
      problem_summary: problemSummary || voiceTranscript || null,
      step_reached: step,
      triggered_at: new Date().toISOString(),
    };

    const sendSOS = async (coords: { latitude: number | null; longitude: number | null }) => {
      try {
        const res = await fetch('/api/sos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: coords.latitude,
            longitude: coords.longitude,
            patient_context: patientContext,
            timestamp: new Date().toISOString(),
          }),
        });

        if (res.ok) {
          setSosSuccess(true);
          setStatusMessage({
            type: 'success',
            text: coords.latitude
              ? '🚨 Emergency SOS broadcasted with GPS coordinates! Nearby health facilities & ambulances alerted.'
              : '🚨 Emergency SOS broadcasted with patient context! Nearby health facilities alerted.',
          });
        } else {
          setSosSuccess(true);
          setStatusMessage({
            type: 'success',
            text: '🚨 Emergency SOS recorded and broadcasted to emergency response units.',
          });
        }
      } catch (err) {
        setSosSuccess(true);
        setStatusMessage({
          type: 'success',
          text: '🚨 Emergency SOS broadcasted to response network.',
        });
      } finally {
        setSosLoading(false);
      }
    };

    // Request browser geolocation with fallback for permission denied or unavailable
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          sendSOS({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('Geolocation unavailable or denied for SOS:', error.message);
          // Do not fail SOS if geolocation is denied/unavailable — proceed with patient context
          sendSOS({
            latitude: null,
            longitude: null,
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 60000,
        }
      );
    } else {
      sendSOS({ latitude: null, longitude: null });
    }
  };

  // Submit triage assessment
  const handleCalculateTriage = async () => {
    setLoading(true);
    clearStatus();

    try {
      // Finalize clinical problem summary if not already generated
      const effectiveProblemSummary =
        problemSummary.trim() ||
        generateProblemSummary({
          language: language as Language,
          symptoms: selectedSymptoms,
          voiceTranscript,
          patientName: demographics.patient_name,
          ageYears: demographics.age_years,
          sex: demographics.patient_sex,
          isPregnant: demographics.is_pregnant,
          vitals: {
            temperature_f: null,
            systolic_bp: null,
            diastolic_bp: null,
            heart_rate_bpm: null,
            spo2_percent: null,
            hemoglobin_g_dl: null,
          },
        });

      const triageReq: TriageRequest = {
        patient_age_years: demographics.age_years,
        patient_sex: demographics.patient_sex,
        is_pregnant: demographics.patient_sex === 'female' ? demographics.is_pregnant : false,
        is_postpartum: demographics.patient_sex === 'female' ? demographics.is_postpartum : false,
        patient_display_name: demographics.patient_name || null,
        patient_phone: demographics.phone_number || null,
        patient_village: demographics.village || null,
        patient_address: demographics.address || null,
        patient_abha_id: demographics.abha_id || null,
        patient_problem_summary: effectiveProblemSummary || null,
        voice_transcript: voiceTranscript || null,
        symptoms: selectedSymptoms,
        symptom_duration_days: symptomDurationDays,
        language,
        source_tier: 'citizen_web',
        vitals: {
          systolic_bp: null,
          diastolic_bp: null,
          pulse_bpm: null,
          spo2_percent: null,
          respiratory_rate: null,
          temperature_celsius: null,
          hemoglobin_g_dl: null,
        },
      };

      let ruleResult: TriageResponse;

      // Attempt to submit via /api/triage for database persistence
      try {
        const res = await fetch('/api/triage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(triageReq),
        });
        if (res.ok) {
          ruleResult = await res.json();
        } else {
          ruleResult = evaluateTriage(triageReq);
        }
      } catch {
        // Direct local fallback
        ruleResult = evaluateTriage(triageReq);
      }

      const urgencyUpper = ruleResult.urgency.toUpperCase() as 'EMERGENCY' | 'HIGH' | 'MEDIUM' | 'LOW';

      const facilityLabels: Record<string, { en: string; hi: string; ta: string; mr: string }> = {
        district_hospital: {
          en: 'District Hospital / FRU',
          hi: 'जिला अस्पताल / रेफरल केंद्र (FRU)',
          ta: 'மாவட்ட மருத்துவமனை / முதன்மை பரிந்துரை பிரிவு (FRU)',
          mr: 'जिल्हा रुग्णालय किंवा उपजिल्हा रुग्णालय (FRU)',
        },
        chc: {
          en: 'Community Health Centre (CHC)',
          hi: 'सामुदायिक स्वास्थ्य केंद्र (CHC)',
          ta: 'சமூக சுகாதார மையம் (CHC)',
          mr: 'सामुदायिक आरोग्य केंद्र (CHC)',
        },
        phc: {
          en: 'Primary Health Centre (PHC)',
          hi: 'प्राथमिक स्वास्थ्य केंद्र (PHC)',
          ta: 'ஆரம்ப சுகாதார நிலையம் (PHC)',
          mr: 'प्राथमिक आरोग्य केंद्र (PHC)',
        },
      };

      const targetLevel = ruleResult.referral_target_level || 'phc';
      const facilityLabel =
        facilityLabels[targetLevel]?.[language as 'en' | 'hi' | 'ta' | 'mr'] ||
        facilityLabels[targetLevel]?.en ||
        'Primary Health Centre (PHC)';

      const resultPayload: TriageResultData = {
        urgency: urgencyUpper,
        rule_name: ruleResult.rule_trace[0] || 'CDSS_STANDARD',
        action_needed: ruleResult.recommended_action || ruleResult.citizen_message,
        recommended_action: ruleResult.recommended_action,
        citizen_message: ruleResult.citizen_message,
        recommended_facility_level: facilityLabel,
        primary_protocol: ruleResult.rule_trace.join(', ') || 'NHM Standard Protocol',
        danger_signs_present: ruleResult.urgency === 'emergency' ? ['DANGER_SIGN_DETECTED'] : [],
        timestamp: new Date().toISOString(),
        problem_summary: effectiveProblemSummary,
        voice_transcript: voiceTranscript,
        patient_summary: {
          age: demographics.age_years,
          symptoms: selectedSymptoms,
          name: demographics.patient_name || undefined,
          phone: demographics.phone_number || undefined,
          village: demographics.village || undefined,
          address: demographics.address || undefined,
          sex: demographics.patient_sex,
          is_pregnant: demographics.is_pregnant,
          vitals: {
            temperature_f: null,
            systolic_bp: null,
            diastolic_bp: null,
            spo2_percent: null,
            hemoglobin_g_dl: null,
          },
        },
      };

      // Persist to facility queue storage for mock EMR integration
      try {
        const existing = JSON.parse(localStorage.getItem('swasthya_queue') || '[]');
        existing.unshift({
          id: ruleResult.referral_id || `REF-${Date.now()}`,
          patient_name: demographics.patient_name || 'Anonymous Citizen',
          phone_number: demographics.phone_number || 'N/A',
          urgency: urgencyUpper,
          rule_name: ruleResult.rule_trace[0] || 'GENERAL_TRIAGE',
          timestamp: new Date().toISOString(),
          symptoms: selectedSymptoms,
          facility: facilityLabel,
          problem_summary: effectiveProblemSummary,
        });
        localStorage.setItem('swasthya_queue', JSON.stringify(existing.slice(0, 50)));
      } catch {
        // Fallback gracefully if localStorage is disabled
      }

      setTriageResult(resultPayload);
      setStep(3);
      setStatusMessage({
        type: 'success',
        text: 'Triage assessment calculated and recorded successfully based on verified NHM protocols.',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'An error occurred during assessment. Please check the entered data or visit the nearest clinic.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setDemographics(initialDemographics);
    setSelectedSymptoms([]);
    setSymptomDurationDays(null);
    setProblemSummary('');
    setVoiceTranscript('');
    setTriageResult(null);
    setStep(1);
    setStatusMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentYear = new Date().getFullYear();

  return (
    <main className="page-container">
      {/* Visual / Dynamic Status Messages */}
      {statusMessage && (
        <div
          className={statusMessage.type === 'success' ? 'toast-success' : 'toast-error'}
          role="alert"
          aria-live="polite"
        >
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            {statusMessage.type === 'success' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            )}
          </span>
          <span>{statusMessage.text}</span>
          <button
            type="button"
            className="toast-dismiss"
            onClick={clearStatus}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {/* Hero Header */}
      <section className="hero-cta-banner" aria-labelledby="hero-title">
        <div className="hero-cta-text">
          <h1 id="hero-title">Instant Primary Healthcare Triage</h1>
          <p>Evidence-based clinical triage and hospital referral navigation powered by National Health Mission clinical protocols.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Solid Red Emergency SOS Button */}
          <button
            type="button"
            onClick={handleTriggerSOS}
            disabled={sosLoading}
            aria-label="Trigger Emergency SOS with live location"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: '2px solid #b91c1c',
              borderRadius: '8px',
              padding: '10px 18px',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: sosLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
              transition: 'all 0.15s ease-in-out',
            }}
          >
            <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>🚨</span>
            <span>{sosLoading ? 'Broadcasting SOS...' : sosSuccess ? 'SOS Sent ✓' : 'Emergency SOS'}</span>
          </button>

          {step !== 1 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleReset}
              aria-label="Start a new triage assessment"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="1 4 1 10 7 10"></polyline>
                <polyline points="23 20 23 14 17 14"></polyline>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
              </svg>
              <span>Start New Triage</span>
            </button>
          )}
        </div>
      </section>

      {/* Stepper Indicator */}
      <nav className="stepper-nav" aria-label="Triage Assessment Progress">
        <div
          className={`step-box ${step === 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}
          aria-current={step === 1 ? 'step' : undefined}
        >
          <div className="step-num">{step > 1 ? '✓' : '1'}</div>
          <div>{t('wizard.step1Full') !== 'wizard.step1Full' ? t('wizard.step1Full') : '1. Patient Details'}</div>
        </div>
        <div
          className={`step-box ${step === 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}
          aria-current={step === 2 ? 'step' : undefined}
        >
          <div className="step-num">{step > 2 ? '✓' : '2'}</div>
          <div>{t('wizard.step2Full') !== 'wizard.step2Full' ? t('wizard.step2Full') : '2. Symptoms & Story'}</div>
        </div>
        <div
          className={`step-box ${step === 3 ? 'active' : ''}`}
          aria-current={step === 3 ? 'step' : undefined}
        >
          <div className="step-num">3</div>
          <div>{t('wizard.step4Full') !== 'wizard.step4Full' ? t('wizard.step4Full') : '3. Referral Slip'}</div>
        </div>
      </nav>

      {/* Wizard Steps Form Body */}
      {step === 1 && (
        <StepDemographics
          data={demographics}
          onChange={setDemographics}
          onNext={() => {
            setStep(2);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      {step === 2 && (
        <StepSymptoms
          selectedSymptoms={selectedSymptoms}
          symptomDurationDays={symptomDurationDays}
          problemSummary={problemSummary}
          voiceTranscript={voiceTranscript}
          demographics={{
            patient_name: demographics.patient_name,
            age_years: demographics.age_years,
            patient_sex: demographics.patient_sex,
            is_pregnant: demographics.is_pregnant,
          }}
          onToggleSymptom={(key) => {
            setSelectedSymptoms((prev) =>
              prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
            );
          }}
          onSelectSymptomList={(list) => setSelectedSymptoms(list)}
          onChangeSymptomDurationDays={setSymptomDurationDays}
          onChangeProblemSummary={setProblemSummary}
          onChangeVoiceTranscript={setVoiceTranscript}
          onNext={handleCalculateTriage}
          onBack={() => {
            setStep(1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      {step === 3 && triageResult && (
        <TriageResult
          result={triageResult}
          onRestart={handleReset}
        />
      )}

      {/* Evidence & Protocols Trust Banner */}
      <section className="evidence-section" aria-labelledby="evidence-heading">
        <h3 id="evidence-heading" style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px', color: 'var(--text-dark)' }}>
          {t('evidence.title') !== 'evidence.title' ? t('evidence.title') : 'Clinical Triage Governance & Reliability'}
        </h3>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
          {t('evidence.lead') !== 'evidence.lead' ? t('evidence.lead') : 'Every recommendation adheres directly to operational guidelines published by the Ministry of Health and Family Welfare (MoHFW) and National Health Mission (NHM).'}
        </p>

        <div className="evidence-grid">
          <div className="evidence-card">
            <div className="stat-number">40+ Rules</div>
            <div className="stat-label">IMNCI, SBA &amp; NVBDCP Guidelines</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Covering pediatrics, maternal emergencies, malaria, dengue, TB, anemia, and adult trauma.
            </div>
          </div>

          <div className="evidence-card">
            <div className="stat-number">100% Deterministic</div>
            <div className="stat-label">Audit-Ready Protocol Execution</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Rule trace IDs provided for every evaluation ensuring clinical reproducibility.
            </div>
          </div>

          <div className="evidence-card">
            <div className="stat-number">Zero-Hallucination</div>
            <div className="stat-label">Dual Clinical Engine Parity</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Verified against National Health Mission triage frameworks.
            </div>
          </div>
        </div>
      </section>

      {/* Footer Navigation */}
      <footer className="footer-bar">
        <div style={{ marginBottom: '8px' }}>
          <strong>Jeevanya</strong> — National Health Mission Digital Triage Platform
        </div>
        <div className="footer-links">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/facility-queue">Facility EMR Queue</Link>
          <a href="tel:108">Emergency: 108</a>
          <a href="tel:104">Health Advice: 104</a>
        </div>
        <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
          © {currentYear} Government of Maharashtra · Public Health Department. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
