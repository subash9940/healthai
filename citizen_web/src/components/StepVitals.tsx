'use client';

import React, { useState } from 'react';
import { useI18n } from '../lib/useTranslation';

export interface VitalsData {
  temperature_f: number | null;
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  heart_rate_bpm?: number | null;
  spo2_percent?: number | null;
  resp_rate?: number | null;
  blood_glucose_mg_dl?: number | null;
  hemoglobin_g_dl?: number | null;
}

interface Props {
  data: VitalsData;
  onChange: (data: VitalsData) => void;
  onBack: () => void;
  onSubmit: () => void;
  loading: boolean;
}

export default function StepVitals({ data, onChange, onBack, onSubmit, loading }: Props) {
  const { t } = useI18n();
  const [warning, setWarning] = useState<string | null>(null);

  const validateTemp = (val: number | null) => {
    if (val === null) {
      setWarning(null);
      return;
    }
    if (val >= 104) {
      setWarning('Hyperpyrexia Alert: High fever (≥104 °F / ≥40 °C)');
    } else if (val >= 100.4) {
      setWarning('Fever detected (≥100.4 °F / 38 °C)');
    } else if (val <= 95) {
      setWarning('Hypothermia Alert (≤95 °F / 35 °C)');
    } else {
      setWarning(null);
    }
  };

  const handleTempChange = (raw: string) => {
    const parsed = raw === '' ? null : parseFloat(raw);
    const validNum = isNaN(parsed as number) ? null : parsed;
    onChange({ ...data, temperature_f: validNum });
    validateTemp(validNum);
  };

  return (
    <div className="form-card">
      <div className="form-header">
        <h2>{t('vitals.title') !== 'vitals.title' ? t('vitals.title') : 'Body Temperature (Optional)'}</h2>
        <p>If you have checked the patient’s thermometer reading, enter it below.</p>
      </div>

      <div style={{ marginBottom: '20px', fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span>Optional. If no thermometer is available, leave blank and proceed directly to triage evaluation.</span>
      </div>

      <div style={{ maxWidth: '360px', margin: '0 auto 24px auto' }}>
        <div className="vital-box" style={{ padding: '16px' }}>
          <label htmlFor="temp-input" className="vital-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
              <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path>
            </svg>
            <span>{t('vitals.tempLabel') !== 'vitals.tempLabel' ? t('vitals.tempLabel') : 'Body Temperature (°F)'}</span>
          </label>
          <input
            id="temp-input"
            type="number"
            step="0.1"
            min="90"
            max="112"
            className={`form-input ${warning ? 'warning' : ''}`}
            placeholder="e.g. 98.6 or 101.2"
            value={data.temperature_f ?? ''}
            onChange={(e) => handleTempChange(e.target.value)}
            style={{ fontSize: '16px', padding: '12px' }}
          />
          {warning && (
            <div className="warning-text" style={{ marginTop: '8px', fontSize: '12px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <span>{warning}</span>
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Normal oral temperature is between 97.7°F – 99.5°F (36.5°C – 37.5°C).
          </div>
        </div>
      </div>

      {/* Button Row */}
      <div className="btn-row">
        <button type="button" className="btn-secondary" onClick={onBack} disabled={loading}>
          ← {t('vitals.prevButton') !== 'vitals.prevButton' ? t('vitals.prevButton') : 'Back'}
        </button>

        <button
          type="button"
          className={`btn-primary ${loading ? 'loading' : ''}`}
          onClick={onSubmit}
          disabled={loading}
        >
          {loading
            ? (t('vitals.evaluating') !== 'vitals.evaluating' ? t('vitals.evaluating') : 'Evaluating Protocols...')
            : (t('vitals.submitButton') !== 'vitals.submitButton' ? t('vitals.submitButton') : 'Generate Triage & Referral →')}
        </button>
      </div>
    </div>
  );
}
