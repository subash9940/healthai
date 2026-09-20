'use client';

import React, { useState } from 'react';
import { useI18n, Language } from '../lib/useTranslation';

export type PatientSex = 'male' | 'female' | 'other';

export interface DemographicsData {
  age_years: number;
  patient_sex: PatientSex;
  is_pregnant: boolean;
  is_postpartum: boolean;
  weeks_pregnant: number | null;
  patient_name: string;
  phone_number: string;
  village: string;
  address: string;
  abha_id: string;
  language_preference: Language;
}

interface Props {
  data: DemographicsData;
  onChange: (data: DemographicsData) => void;
  onNext: () => void;
}

export default function StepDemographics({ data, onChange, onNext }: Props) {
  const { language, setLanguage, t } = useI18n();
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Validation logic
  const isNameValid = data.patient_name.trim().length >= 2;
  const isAgeValid = data.age_years >= 0 && data.age_years <= 120;
  const isSexValid = ['male', 'female', 'other'].includes(data.patient_sex);
  const isPhoneValid = /^[6-9]\d{9}$/.test(data.phone_number);
  const isVillageValid = data.village.trim().length >= 2;
  const isAddressValid = data.address.trim().length >= 3;

  const nameError =
    touched.name && !isNameValid
      ? t('demographics.nameError') !== 'demographics.nameError'
        ? t('demographics.nameError')
        : 'Please enter patient full name (min 2 characters).'
      : null;

  const phoneError =
    touched.phone && !isPhoneValid
      ? data.phone_number.length === 0
        ? t('demographics.phoneError') !== 'demographics.phoneError'
          ? t('demographics.phoneError')
          : 'Mobile number is required.'
        : data.phone_number.length !== 10
        ? t('demographics.phoneIncomplete') !== 'demographics.phoneIncomplete'
          ? t('demographics.phoneIncomplete').replace('{count}', String(10 - data.phone_number.length))
          : '10 digits required'
        : t('demographics.phoneStartInvalid') !== 'demographics.phoneStartInvalid'
        ? t('demographics.phoneStartInvalid')
        : 'Must start with 6, 7, 8, or 9'
      : null;

  const villageError =
    touched.village && !isVillageValid
      ? t('demographics.villageError') !== 'demographics.villageError'
        ? t('demographics.villageError')
        : 'Village or town name is mandatory.'
      : null;

  const addressError =
    touched.address && !isAddressValid
      ? t('demographics.addressError') !== 'demographics.addressError'
        ? t('demographics.addressError')
        : 'Residential address / street is mandatory.'
      : null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    onChange({ ...data, phone_number: val });
  };

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
    onChange({ ...data, language_preference: newLang });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      name: true,
      age: true,
      sex: true,
      phone: true,
      village: true,
      address: true,
    });

    if (isNameValid && isAgeValid && isSexValid && isPhoneValid && isVillageValid && isAddressValid) {
      onNext();
    }
  };

  return (
    <div className="form-card">
      <div className="form-header">
        <h2>{t('demographics.title') !== 'demographics.title' ? t('demographics.title') : 'Patient Demographics'}</h2>
        <p>{t('demographics.subtitle') !== 'demographics.subtitle' ? t('demographics.subtitle') : 'Provide essential patient information to tailor clinical protocols.'}</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* Preferred Language Selection */}
        <div className="form-group">
          <label className="input-label" id="lang-label">
            {language === 'ta' ? 'விருப்பமான மொழி / Language' : language === 'hi' ? 'पसंदीदा भाषा / Preferred Language' : language === 'mr' ? 'पसंतीची भाषा / Language' : 'Preferred Language / भाषा'}
          </label>
          <div className="option-grid" role="radiogroup" aria-labelledby="lang-label">
            {[
              { code: 'en' as const, label: 'English' },
              { code: 'hi' as const, label: 'हिन्दी (Hindi)' },
              { code: 'ta' as const, label: 'தமிழ் (Tamil)' },
              { code: 'mr' as const, label: 'मराठी (Marathi)' },
            ].map((item) => (
              <button
                key={item.code}
                type="button"
                className={`option-btn ${language === item.code ? 'active' : ''}`}
                onClick={() => handleLanguageChange(item.code)}
                aria-pressed={language === item.code}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Patient Full Name (Mandatory) */}
        <div className="form-group">
          <label htmlFor="patient-name" className="input-label">
            {t('demographics.nameLabel') !== 'demographics.nameLabel' ? t('demographics.nameLabel') : 'Patient Full Name'}{' '}
            <span style={{ color: 'var(--urgency-emergency)' }}>*</span>
          </label>
          <input
            id="patient-name"
            type="text"
            required
            className={`form-input ${nameError ? 'error' : touched.name && isNameValid ? 'valid' : ''}`}
            value={data.patient_name}
            onChange={(e) => onChange({ ...data, patient_name: e.target.value })}
            onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
            placeholder={t('demographics.namePlaceholder') !== 'demographics.namePlaceholder' ? t('demographics.namePlaceholder') : 'e.g. Ramesh Patil'}
            autoComplete="name"
          />
          {nameError && <div className="error-text">{nameError}</div>}
        </div>

        {/* Sex Selection (Mandatory) */}
        <div className="form-group">
          <label className="input-label" id="sex-label">
            {t('demographics.sexLabel') !== 'demographics.sexLabel' ? t('demographics.sexLabel') : 'Sex'}{' '}
            <span style={{ color: 'var(--urgency-emergency)' }}>*</span>
          </label>
          <div className="option-grid" role="radiogroup" aria-labelledby="sex-label">
            {[
              { code: 'male' as const, label: t('demographics.male') !== 'demographics.male' ? t('demographics.male') : 'Male' },
              { code: 'female' as const, label: t('demographics.female') !== 'demographics.female' ? t('demographics.female') : 'Female' },
              { code: 'other' as const, label: t('demographics.other') !== 'demographics.other' ? t('demographics.other') : 'Other' },
            ].map((item) => (
              <button
                key={item.code}
                type="button"
                className={`option-btn ${data.patient_sex === item.code ? 'active' : ''}`}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => {
                  setTouched((prev) => ({ ...prev, sex: true }));
                  onChange({
                    ...data,
                    patient_sex: item.code,
                    is_pregnant: item.code === 'female' ? data.is_pregnant : false,
                    is_postpartum: item.code === 'female' ? data.is_postpartum : false,
                  });
                }}
                aria-pressed={data.patient_sex === item.code}
              >
                {item.code === 'male' ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <circle cx="10" cy="14" r="5"></circle>
                    <line x1="19" y1="5" x2="13.6" y2="10.4"></line>
                    <polyline points="15 5 19 5 19 9"></polyline>
                  </svg>
                ) : item.code === 'female' ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="9" r="5"></circle>
                    <line x1="12" y1="14" x2="12" y2="21"></line>
                    <line x1="9" y1="18" x2="15" y2="18"></line>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="6"></circle>
                    <line x1="12" y1="2" x2="12" y2="6"></line>
                    <line x1="12" y1="18" x2="12" y2="22"></line>
                  </svg>
                )}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Age Input & Quick Presets (Mandatory) */}
        <div className="form-group">
          <label htmlFor="patient-age" className="input-label">
            {t('demographics.ageLabel') !== 'demographics.ageLabel' ? t('demographics.ageLabel') : 'Patient Age'}{' '}
            <span style={{ color: 'var(--urgency-emergency)' }}>*</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              id="patient-age"
              type="number"
              min="0"
              max="120"
              step="any"
              className="form-input"
              style={{ maxWidth: '140px' }}
              value={data.age_years === 0 ? '0' : data.age_years || ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setTouched((prev) => ({ ...prev, age: true }));
                onChange({ ...data, age_years: isNaN(val) ? 0 : Math.max(0, Math.min(120, val)) });
              }}
              placeholder={t('demographics.agePlaceholder') !== 'demographics.agePlaceholder' ? t('demographics.agePlaceholder') : 'e.g. 28'}
              required
            />
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              {data.age_years < 1
                ? t('demographics.ageBands.infant') !== 'demographics.ageBands.infant'
                  ? t('demographics.ageBands.infant')
                  : 'Infant (<1 yr)'
                : t('demographics.yearsUnit') !== 'demographics.yearsUnit'
                ? t('demographics.yearsUnit')
                : 'years'}
            </span>
          </div>

          {/* Quick Age Target Presets */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            {[
              {
                label:
                  language === 'ta'
                    ? 'சிசு (0.1y / 1 மாதம்)'
                    : language === 'hi'
                    ? 'शिशु (0.1y / 1 माह)'
                    : language === 'mr'
                    ? 'बाळ (०.१ वर्षे / १ महिना)'
                    : 'Infant (0.1y / 1mo)',
                age: 0.1,
              },
              {
                label:
                  language === 'ta'
                    ? 'சிறு குழந்தை (3y)'
                    : language === 'hi'
                    ? 'छोटा बच्चा (3 वर्ष)'
                    : language === 'mr'
                    ? 'लहान मूल (३ वर्षे)'
                    : 'Child (3y)',
                age: 3,
              },
              {
                label:
                  language === 'ta'
                    ? 'வளரிளம் பருவம் (14y)'
                    : language === 'hi'
                    ? 'किशोर (14 वर्ष)'
                    : language === 'mr'
                    ? 'किशोरी/किशोर (१४ वर्षे)'
                    : 'Adolescent (14y)',
                age: 14,
              },
              {
                label:
                  language === 'ta'
                    ? 'பெரியவர் (30y)'
                    : language === 'hi'
                    ? 'वयस्क (30 वर्ष)'
                    : language === 'mr'
                    ? 'प्रौढ (३० वर्षे)'
                    : 'Adult (30y)',
                age: 30,
              },
              {
                label:
                  language === 'ta'
                    ? 'முதியவர் (65y)'
                    : language === 'hi'
                    ? 'वृद्ध (65 वर्ष)'
                    : language === 'mr'
                    ? 'ज्येष्ठ नागरिक (६५ वर्षे)'
                    : 'Elderly (65y)',
                age: 65,
              },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                className="cat-btn"
                style={{ fontSize: '11px', padding: '4px 10px' }}
                onClick={() => {
                  setTouched((prev) => ({ ...prev, age: true }));
                  onChange({ ...data, age_years: p.age });
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="input-helper" style={{ marginTop: '6px' }}>
            {t('demographics.ageHint') !== 'demographics.ageHint' ? t('demographics.ageHint') : 'For infants under 1 year, enter decimal like 0.1 (1 mo) or 0.5 (6 mo).'}
          </div>
        </div>

        {/* Maternal Health Conditions (Shown for females aged 12-55) */}
        {data.patient_sex === 'female' && data.age_years >= 12 && data.age_years <= 55 && (
          <div
            style={{
              padding: '16px',
              background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '20px',
              border: '1px solid var(--border-light)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px', color: 'var(--text-dark)' }}>
              {t('demographics.maternalTitle') !== 'demographics.maternalTitle' ? t('demographics.maternalTitle') : 'Maternal & Pregnancy Status'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              <button
                type="button"
                className={`option-btn ${data.is_pregnant ? 'active' : ''}`}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => onChange({ ...data, is_pregnant: !data.is_pregnant, is_postpartum: false })}
                aria-pressed={data.is_pregnant}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <path d="M12 2a4 4 0 0 0-4 4v2a6 6 0 0 0-6 6v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a6 6 0 0 0-6-6V6a4 4 0 0 0-4-4z"></path>
                  <circle cx="12" cy="14" r="3"></circle>
                </svg>
                <span>{t('demographics.isPregnant') !== 'demographics.isPregnant' ? t('demographics.isPregnant') : 'Currently Pregnant'}</span>
              </button>

              <button
                type="button"
                className={`option-btn ${data.is_postpartum ? 'active' : ''}`}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => onChange({ ...data, is_postpartum: !data.is_postpartum, is_pregnant: false })}
                aria-pressed={data.is_postpartum}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="8" r="5"></circle>
                  <path d="M3 20c0-3.3 2.7-6 6-6h6c3.3 0 6 2.7 6 6"></path>
                  <circle cx="12" cy="8" r="2"></circle>
                </svg>
                <span>{t('demographics.isPostpartum') !== 'demographics.isPostpartum' ? t('demographics.isPostpartum') : 'Postpartum (<6 weeks)'}</span>
              </button>
            </div>

            {data.is_pregnant && (
              <div style={{ marginTop: '12px' }}>
                <label htmlFor="gestation-weeks" className="input-label" style={{ fontSize: '12px' }}>
                  {language === 'ta' ? 'கர்ப்ப காலம் (வாரங்கள்)' : language === 'hi' ? 'गर्भधारण अवधि (सप्ताह)' : language === 'mr' ? 'गर्भधारणा कालावधी (आठवडे)' : 'Gestational Age (Weeks)'}
                </label>
                <input
                  id="gestation-weeks"
                  type="number"
                  min="1"
                  max="42"
                  className="form-input"
                  style={{ maxWidth: '140px' }}
                  value={data.weeks_pregnant || ''}
                  placeholder="e.g. 28"
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    onChange({ ...data, weeks_pregnant: isNaN(val) ? null : val });
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Mobile Number (Mandatory) */}
        <div className="form-group">
          <label htmlFor="patient-phone" className="input-label">
            {t('demographics.phoneLabel') !== 'demographics.phoneLabel' ? t('demographics.phoneLabel') : 'Mobile Number'}{' '}
            <span style={{ color: 'var(--urgency-emergency)' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0 12px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-muted)',
              }}
            >
              +91
            </span>
            <input
              id="patient-phone"
              type="tel"
              maxLength={10}
              required
              className={`form-input ${phoneError ? 'error' : touched.phone && isPhoneValid ? 'valid' : ''}`}
              value={data.phone_number}
              onChange={handlePhoneChange}
              onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
              placeholder={t('demographics.phonePlaceholder') !== 'demographics.phonePlaceholder' ? t('demographics.phonePlaceholder') : '9876543210'}
              autoComplete="tel"
            />
          </div>
          {phoneError && <div className="error-text">{phoneError}</div>}
          <div className="input-helper">
            {t('demographics.phoneHint') !== 'demographics.phoneHint' ? t('demographics.phoneHint') : 'Used to generate SMS referral slips and facilitate facility tracking.'}
          </div>
        </div>

        {/* Village / Town / City (Mandatory) */}
        <div className="form-group">
          <label htmlFor="patient-village" className="input-label">
            {t('demographics.villageLabel') !== 'demographics.villageLabel' ? t('demographics.villageLabel') : 'Village / Town / City'}{' '}
            <span style={{ color: 'var(--urgency-emergency)' }}>*</span>
          </label>
          <input
            id="patient-village"
            type="text"
            required
            className={`form-input ${villageError ? 'error' : touched.village && isVillageValid ? 'valid' : ''}`}
            value={data.village}
            onChange={(e) => onChange({ ...data, village: e.target.value })}
            onBlur={() => setTouched((prev) => ({ ...prev, village: true }))}
            placeholder={t('demographics.villagePlaceholder') !== 'demographics.villagePlaceholder' ? t('demographics.villagePlaceholder') : 'e.g. Kurkheda or Gadchiroli'}
          />
          {villageError && <div className="error-text">{villageError}</div>}
        </div>

        {/* Residential Address / Street (Mandatory) */}
        <div className="form-group">
          <label htmlFor="patient-address" className="input-label">
            {t('demographics.addressLabel') !== 'demographics.addressLabel' ? t('demographics.addressLabel') : 'Residential Address / Street'}{' '}
            <span style={{ color: 'var(--urgency-emergency)' }}>*</span>
          </label>
          <input
            id="patient-address"
            type="text"
            required
            className={`form-input ${addressError ? 'error' : touched.address && isAddressValid ? 'valid' : ''}`}
            value={data.address}
            onChange={(e) => onChange({ ...data, address: e.target.value })}
            onBlur={() => setTouched((prev) => ({ ...prev, address: true }))}
            placeholder={t('demographics.addressPlaceholder') !== 'demographics.addressPlaceholder' ? t('demographics.addressPlaceholder') : 'e.g. House No. 12, Main Road, Near Primary School'}
          />
          {addressError && <div className="error-text">{addressError}</div>}
        </div>

        {/* ABHA ID (Strictly Optional) */}
        <div className="form-group">
          <label htmlFor="patient-abha" className="input-label">
            {t('demographics.abhaLabel') !== 'demographics.abhaLabel' ? t('demographics.abhaLabel') : 'ABHA / Ayushman Bharat Health ID'}{' '}
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
          </label>
          <input
            id="patient-abha"
            type="text"
            className="form-input"
            value={data.abha_id || ''}
            onChange={(e) => onChange({ ...data, abha_id: e.target.value })}
            placeholder={t('demographics.abhaPlaceholder') !== 'demographics.abhaPlaceholder' ? t('demographics.abhaPlaceholder') : '14-digit ABHA ID or abha@abdm'}
          />
          <div className="input-helper">
            {t('demographics.abhaHint') !== 'demographics.abhaHint' ? t('demographics.abhaHint') : 'Connects your triage record directly with your Ayushman Bharat Digital Health account.'}
          </div>
        </div>

        {/* Next Button Row */}
        <div className="btn-row">
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {t('wizard.step1Full') !== 'wizard.step1Full' ? t('wizard.step1Full') : '1. Patient Details'}
          </span>
          <button
            type="submit"
            className="btn-primary"
          >
            {t('demographics.nextButton') !== 'demographics.nextButton' ? t('demographics.nextButton') : 'Continue to Symptoms →'}
          </button>
        </div>
      </form>
    </div>
  );
}
