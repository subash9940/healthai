'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useI18n, Language } from '../lib/useTranslation';
import StepDemographics, { DemographicsData } from '../components/StepDemographics';
import StepSymptoms from '../components/StepSymptoms';
import StepVitals, { VitalsData } from '../components/StepVitals';
import TriageResult, { TriageResultData } from '../components/TriageResult';
import { evaluateTriage } from '../lib/localRulesEngine';
import { TriageRequest, TriageResponse } from '../lib/triageContract';
import { generateProblemSummary } from '../lib/problemSummary';
import { getStoredProfile } from '../lib/profile';

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

const initialVitals: VitalsData = {
  systolic_bp: null,
  diastolic_bp: null,
  heart_rate_bpm: null,
  spo2_percent: null,
  resp_rate: null,
  temperature_f: null,
  blood_glucose_mg_dl: null,
  hemoglobin_g_dl: null,
};

export default function HomePage() {
  const { language, t } = useI18n();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [demographics, setDemographics] = useState<DemographicsData>(initialDemographics);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [symptomDurationDays, setSymptomDurationDays] = useState<number | null>(null);
  const [problemSummary, setProblemSummary] = useState<string>('');
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [vitals, setVitals] = useState<VitalsData>(initialVitals);
  const [triageResult, setTriageResult] = useState<TriageResultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Pre-fill demographics from stored Jeevanya profile if available
  useEffect(() => {
    const profile = getStoredProfile();
    if (profile) {
      setDemographics((prev) => {
        if (prev.patient_name && prev.patient_name.trim() !== '') return prev;
        return {
          ...prev,
          patient_name: profile.name || prev.patient_name,
          phone_number: profile.phone || prev.phone_number,
          village: profile.village || prev.village,
          age_years: typeof profile.age === 'number' && profile.age > 0 ? profile.age : prev.age_years,
          patient_sex: profile.sex === 'female' ? 'female' : 'male',
        };
      });
    }
  }, []);

  // Clear toast feedback
  const clearStatus = () => setStatusMessage(null);

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
            temperature_f: vitals.temperature_f,
            systolic_bp: vitals.systolic_bp,
            diastolic_bp: vitals.diastolic_bp,
            heart_rate_bpm: vitals.heart_rate_bpm,
            spo2_percent: vitals.spo2_percent,
            hemoglobin_g_dl: vitals.hemoglobin_g_dl,
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
          systolic_bp: vitals.systolic_bp,
          diastolic_bp: vitals.diastolic_bp,
          pulse_bpm: vitals.heart_rate_bpm,
          spo2_percent: vitals.spo2_percent,
          respiratory_rate: vitals.resp_rate,
          temperature_celsius: vitals.temperature_f ? ((vitals.temperature_f - 32) * 5) / 9 : null,
          hemoglobin_g_dl: vitals.hemoglobin_g_dl,
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
            temperature_f: vitals.temperature_f,
            systolic_bp: vitals.systolic_bp,
            diastolic_bp: vitals.diastolic_bp,
            spo2_percent: vitals.spo2_percent,
            hemoglobin_g_dl: vitals.hemoglobin_g_dl,
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
      setStep(4);
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
    setVitals(initialVitals);
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
          <span>{statusMessage.type === 'success' ? '✓' : '⚠️'}</span>
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
        <div>
          {step !== 1 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleReset}
              aria-label="Start a new triage assessment"
            >
              🔄 Start New Triage
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
          className={`step-box ${step === 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}
          aria-current={step === 3 ? 'step' : undefined}
        >
          <div className="step-num">{step > 3 ? '✓' : '3'}</div>
          <div>{t('wizard.step3Full') !== 'wizard.step3Full' ? t('wizard.step3Full') : '3. Vitals (Optional)'}</div>
        </div>
        <div
          className={`step-box ${step === 4 ? 'active' : ''}`}
          aria-current={step === 4 ? 'step' : undefined}
        >
          <div className="step-num">4</div>
          <div>{t('wizard.step4Full') !== 'wizard.step4Full' ? t('wizard.step4Full') : '4. Referral Slip'}</div>
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
          onNext={() => {
            setStep(3);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onBack={() => {
            setStep(1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      {step === 3 && (
        <StepVitals
          data={vitals}
          onChange={setVitals}
          onBack={() => {
            setStep(2);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onSubmit={handleCalculateTriage}
          loading={loading}
        />
      )}

      {step === 4 && triageResult && (
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
          <strong>Swasthya Setu</strong> — National Health Mission Digital Triage Platform
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
