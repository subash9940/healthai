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

      <div style={{ marginBottom: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
        ℹ️ Optional. If no thermometer is available, leave blank and proceed directly to triage evaluation.
      </div>

      <div style={{ maxWidth: '360px', margin: '0 auto 24px auto' }}>
        <div className="vital-box" style={{ padding: '16px' }}>
          <label htmlFor="temp-input" className="vital-title" style={{ display: 'block', marginBottom: '8px' }}>
            🌡️ {t('vitals.tempLabel') !== 'vitals.tempLabel' ? t('vitals.tempLabel') : 'Body Temperature (°F)'}
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
            <div className="warning-text" style={{ marginTop: '8px', fontSize: '12px', color: '#b91c1c' }}>
              ⚠️ {warning}
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
