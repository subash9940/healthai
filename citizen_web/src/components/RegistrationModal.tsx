'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '../lib/useTranslation';
import {
  FacilityItem,
  JeevanyaProfile,
  saveProfile,
  getStoredProfile,
} from '../lib/profile';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (profile: JeevanyaProfile) => void;
  initialProfile?: JeevanyaProfile | null;
}

export default function RegistrationModal({
  isOpen,
  onClose,
  onSaved,
  initialProfile,
}: RegistrationModalProps) {
  const { t } = useI18n();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [age, setAge] = useState<string>('');
  const [sex, setSex] = useState<'male' | 'female' | 'other' | ''>('');
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('');
  const [facilities, setFacilities] = useState<FacilityItem[]>([]);
  const [loadingFacilities, setLoadingFacilities] = useState(false);
  const [facilityError, setFacilityError] = useState<string | null>(null);

  const [coords, setCoords] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
  } | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'fetching' | 'granted' | 'denied'
  >('idle');

  const [formError, setFormError] = useState<string | null>(null);

  // Load existing profile or current state
  useEffect(() => {
    if (isOpen) {
      const current = initialProfile || getStoredProfile();
      if (current) {
        setName(current.name || '');
        setPhone(current.phone || '');
        setVillage(current.village || '');
        setAge(current.age ? String(current.age) : '');
        setSex(current.sex || '');
        setSelectedFacilityId(current.subcentre?.id || '');
        setCoords(current.coords || null);
        if (current.coords) {
          setLocationStatus('granted');
        }
      }
      fetchFacilities();
    }
  }, [isOpen, initialProfile]);

  const fetchFacilities = async () => {
    setLoadingFacilities(true);
    setFacilityError(null);
    try {
      const res = await fetch('/api/facility/list?strict=1');
      if (res.ok) {
        const data: FacilityItem[] = await res.json();
        // Only list facilities that have a contact_phone
        const validFacilities = data.filter(
          (f) => f.contact_phone && f.contact_phone.trim() !== ''
        );
        setFacilities(validFacilities);
        if (validFacilities.length === 0) {
          setFacilityError(
            t('reg_offline_error') !== 'reg_offline_error'
              ? t('reg_offline_error')
              : 'Connect to the internet once to register'
          );
        }
      } else {
        setFacilityError(
          t('reg_offline_error') !== 'reg_offline_error'
            ? t('reg_offline_error')
            : 'Connect to the internet once to register'
        );
      }
    } catch {
      setFacilityError(
        t('reg_offline_error') !== 'reg_offline_error'
          ? t('reg_offline_error')
          : 'Connect to the internet once to register'
      );
    } finally {
      setLoadingFacilities(false);
    }
  };

  const requestLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }
    setLocationStatus('fetching');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLocationStatus('granted');
      },
      () => {
        setLocationStatus('denied');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setFormError(
        t('reg_name_error') !== 'reg_name_error'
          ? t('reg_name_error')
          : 'Please enter your full name (at least 2 characters).'
      );
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const phoneValid = /^[6-9]\d{9}$/.test(cleanPhone);
    if (!phoneValid) {
      setFormError(
        t('reg_phone_error') !== 'reg_phone_error'
          ? t('reg_phone_error')
          : 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.'
      );
      return;
    }

    const trimmedVillage = village.trim();
    if (trimmedVillage.length < 2) {
      setFormError(
        t('reg_village_error') !== 'reg_village_error'
          ? t('reg_village_error')
          : 'Please enter your village or town name.'
      );
      return;
    }

    const selectedFacility = facilities.find((f) => f.id === selectedFacilityId);
    if (!selectedFacility || !selectedFacility.contact_phone) {
      setFormError(
        t('reg_subcentre_error') !== 'reg_subcentre_error'
          ? t('reg_subcentre_error')
          : 'Please select a health facility with a contact phone number.'
      );
      return;
    }

    const parsedAge = age.trim() ? parseFloat(age) : null;
    const profile: JeevanyaProfile = {
      name: trimmedName,
      phone: cleanPhone,
      village: trimmedVillage,
      age: parsedAge && !isNaN(parsedAge) ? parsedAge : null,
      sex: sex === 'male' || sex === 'female' || sex === 'other' ? sex : null,
      subcentre: {
        id: selectedFacility.id,
        name: selectedFacility.name,
        contact_phone: selectedFacility.contact_phone,
        lat: selectedFacility.lat ?? null,
        lng: selectedFacility.lng ?? null,
      },
      coords: coords,
      registered_at: new Date().toISOString(),
    };

    saveProfile(profile);
    onSaved(profile);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        backdropFilter: 'blur(4px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reg-modal-title"
    >
      <div
        className="modal-card"
        style={{
          background: 'var(--bg-surface, #ffffff)',
          borderRadius: '16px',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '28px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border-light, #e2e8f0)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h2
              id="reg-modal-title"
              style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-dark, #0f172a)', margin: 0 }}
            >
              📍 {t('reg_title') !== 'reg_title' ? t('reg_title') : 'Emergency SOS & Profile Registration'}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)', marginTop: '4px' }}>
              {t('reg_subtitle') !== 'reg_subtitle'
                ? t('reg_subtitle')
                : 'Register once with your nearest Sub-centre to enable 1-tap emergency dispatch and offline SMS alerts.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--text-muted, #64748b)',
              padding: '4px 8px',
              lineHeight: 1,
            }}
            aria-label="Close registration"
          >
            ×
          </button>
        </div>

        {formError && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              color: '#991b1b',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px',
              fontWeight: 600,
            }}
          >
            ⚠️ {formError}
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* Full Name */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-dark)' }}>
              {t('reg_name_label') !== 'reg_name_label' ? t('reg_name_label') : 'Full Name'} *
            </label>
            <input
              type="text"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('reg_name_placeholder') !== 'reg_name_placeholder' ? t('reg_name_placeholder') : 'e.g. Ramesh Jadhav'}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-medium, #cbd5e1)',
                fontSize: '14px',
              }}
            />
          </div>

          {/* Phone */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-dark)' }}>
              {t('reg_phone_label') !== 'reg_phone_label' ? t('reg_phone_label') : 'Mobile Phone Number'} *
            </label>
            <input
              type="tel"
              className="input-field"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('reg_phone_placeholder') !== 'reg_phone_placeholder' ? t('reg_phone_placeholder') : '10-digit mobile number (e.g. 9876543210)'}
              maxLength={10}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-medium, #cbd5e1)',
                fontSize: '14px',
              }}
            />
          </div>

          {/* Village */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-dark)' }}>
              {t('reg_village_label') !== 'reg_village_label' ? t('reg_village_label') : 'Village / Town'} *
            </label>
            <input
              type="text"
              className="input-field"
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              placeholder={t('reg_village_placeholder') !== 'reg_village_placeholder' ? t('reg_village_placeholder') : 'e.g. Shirur, Taluka Haveli'}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-medium, #cbd5e1)',
                fontSize: '14px',
              }}
            />
          </div>

          {/* Optional Age & Sex */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-dark)' }}>
                {t('reg_age_label') !== 'reg_age_label' ? t('reg_age_label') : 'Age (optional)'}
              </label>
              <input
                type="number"
                className="input-field"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder={t('reg_age_placeholder') !== 'reg_age_placeholder' ? t('reg_age_placeholder') : 'e.g. 35'}
                min="0"
                max="120"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-medium, #cbd5e1)',
                  fontSize: '14px',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-dark)' }}>
                {t('reg_sex_label') !== 'reg_sex_label' ? t('reg_sex_label') : 'Sex (optional)'}
              </label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-medium, #cbd5e1)',
                  fontSize: '14px',
                  background: '#fff',
                }}
              >
                <option value="">-- {t('reg_sex_label') !== 'reg_sex_label' ? t('reg_sex_label') : 'Select'} --</option>
                <option value="male">{t('reg_sex_male') !== 'reg_sex_male' ? t('reg_sex_male') : 'Male'}</option>
                <option value="female">{t('reg_sex_female') !== 'reg_sex_female' ? t('reg_sex_female') : 'Female'}</option>
                <option value="other">{t('reg_sex_other') !== 'reg_sex_other' ? t('reg_sex_other') : 'Other'}</option>
              </select>
            </div>
          </div>

          {/* Subcentre Picker */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-dark)' }}>
              🏥 {t('reg_subcentre_label') !== 'reg_subcentre_label' ? t('reg_subcentre_label') : 'Assigned Sub-centre / Health Facility'} *
            </label>
            {loadingFacilities ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '8px 0' }}>
                ⏳ {t('reg_subcentre_loading') !== 'reg_subcentre_loading' ? t('reg_subcentre_loading') : 'Loading verified health facilities...'}
              </div>
            ) : facilityError ? (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fca5a5',
                  color: '#991b1b',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              >
                ⚠️ {facilityError}
                <div style={{ marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={fetchFacilities}
                    style={{
                      background: '#fff',
                      border: '1px solid #b91c1c',
                      color: '#b91c1c',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    🔄 Retry Connection
                  </button>
                </div>
              </div>
            ) : (
              <select
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-medium, #cbd5e1)',
                  fontSize: '14px',
                  background: '#fff',
                }}
              >
                <option value="">
                  -- {t('reg_subcentre_placeholder') !== 'reg_subcentre_placeholder' ? t('reg_subcentre_placeholder') : 'Select your nearest Sub-centre...'} --
                </option>
                {facilities.map((fac) => (
                  <option key={fac.id} value={fac.id}>
                    {fac.name} ({fac.district || 'Maharashtra'}) - 📞 {fac.contact_phone}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Location Permission (Optional, requested HERE at registration) */}
          <div
            style={{
              background: 'var(--bg-subtle, #f8fafc)',
              border: '1px solid var(--border-light, #e2e8f0)',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-dark)' }}>
                  🌐 {t('reg_location_btn') !== 'reg_location_btn' ? t('reg_location_btn') : 'GPS Emergency Coordinates'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {locationStatus === 'granted' && coords
                    ? `✓ ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} (±${Math.round(coords.accuracy || 0)}m)`
                    : locationStatus === 'fetching'
                    ? t('reg_location_fetching') !== 'reg_location_fetching'
                      ? t('reg_location_fetching')
                      : 'Acquiring GPS coordinates...'
                    : locationStatus === 'denied'
                    ? t('reg_location_denied') !== 'reg_location_denied'
                      ? t('reg_location_denied')
                      : 'Location access not granted (optional)'
                    : 'Attach home GPS location for faster ambulance dispatch'}
                </div>
              </div>
              <button
                type="button"
                onClick={requestLocation}
                disabled={locationStatus === 'fetching'}
                style={{
                  background: locationStatus === 'granted' ? '#f0fdf4' : '#fff',
                  border: locationStatus === 'granted' ? '1px solid #86efac' : '1px solid var(--border-medium)',
                  color: locationStatus === 'granted' ? '#16a34a' : 'var(--text-dark)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {locationStatus === 'granted'
                  ? '✓ ' + (t('reg_location_saved') !== 'reg_location_saved' ? t('reg_location_saved') : 'Location Attached')
                  : '📍 ' + (t('reg_location_btn') !== 'reg_location_btn' ? t('reg_location_btn') : 'Share Location')}
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#fff',
                border: '1px solid var(--border-medium, #cbd5e1)',
                padding: '10px 18px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                color: 'var(--text-muted)',
              }}
            >
              {t('sos_confirm_cancel') !== 'sos_confirm_cancel' ? t('sos_confirm_cancel') : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={loadingFacilities || !!facilityError}
              style={{
                background: loadingFacilities || !!facilityError ? '#94a3b8' : 'var(--primary, #0f766e)',
                color: '#fff',
                border: 'none',
                padding: '10px 22px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: loadingFacilities || !!facilityError ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(15, 118, 110, 0.2)',
              }}
            >
              {t('reg_submit_btn') !== 'reg_submit_btn' ? t('reg_submit_btn') : 'Save Profile & Enable SOS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
