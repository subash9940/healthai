'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../lib/useTranslation';
import {
  JeevanyaProfile,
  getStoredProfile,
  clearProfile,
  processSosQueue,
} from '../lib/profile';
import RegistrationModal from './RegistrationModal';
import SosModal from './SosModal';

export default function EmergencyBar() {
  const { t } = useI18n();

  const [profile, setProfile] = useState<JeevanyaProfile | null>(null);
  const [isRegOpen, setIsRegOpen] = useState(false);
  const [isSosOpen, setIsSosOpen] = useState(false);

  const refreshProfile = useCallback(() => {
    setProfile(getStoredProfile());
  }, []);

  useEffect(() => {
    refreshProfile();
    // Process any queued offline SOS alerts when online or on mount
    processSosQueue();

    const handleOnline = () => {
      processSosQueue();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleOnline);
    };
  }, [refreshProfile]);

  const handleSavedProfile = (saved: JeevanyaProfile) => {
    setProfile(saved);
  };

  const handleResetProfile = () => {
    if (
      window.confirm(
        t('reg_reset_confirm') !== 'reg_reset_confirm'
          ? t('reg_reset_confirm')
          : 'Reset stored profile? You will need to register again for 1-tap SOS.'
      )
    ) {
      clearProfile();
      setProfile(null);
    }
  };

  return (
    <>
      <aside className="emergency-strip" role="complementary" aria-label="Emergency Services and SOS">
        <div className="emergency-strip-inner">
          {/* Left side: SOS Button & Helplines */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            {/* 1-Tap SOS Button */}
            <button
              type="button"
              onClick={() => setIsSosOpen(true)}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 16px',
                fontSize: '13px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)',
                letterSpacing: '0.3px',
              }}
              aria-label="Trigger 1-Tap Emergency SOS Alert"
            >
              <span aria-hidden="true" style={{ fontSize: '15px' }}>🚨</span>
              <span>
                {t('sos_btn_label') !== 'sos_btn_label' ? t('sos_btn_label') : 'EMERGENCY SOS'}
              </span>
            </button>

            <div className="emergency-strip-text">
              <span aria-hidden="true">📞</span>
              <span>
                {t('emergency.strip_msg') !== 'emergency.strip_msg'
                  ? t('emergency.strip_msg')
                  : 'Emergency? Dial national helplines:'}
              </span>
            </div>

            <div className="emergency-links">
              <a
                href="tel:108"
                className="emergency-phone-link"
                aria-label="Call National Emergency Ambulance at 108"
                title="Call 108 for Emergency Ambulance Service"
              >
                <span>
                  {t('emergency.ambulance_btn') !== 'emergency.ambulance_btn'
                    ? t('emergency.ambulance_btn')
                    : 'Ambulance'}
                  : 108
                </span>
              </a>
              <a
                href="tel:104"
                className="helpline-phone-link"
                aria-label="Call National Health Helpline at 104"
                title="Call 104 for General Health Advice & Helpline"
              >
                <span>
                  {t('emergency.helpline_btn') !== 'emergency.helpline_btn'
                    ? t('emergency.helpline_btn')
                    : '104 Helpline'}
                </span>
              </a>
            </div>
          </div>

          {/* Right side: Profile info / Registration trigger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            {profile ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-dark, #0f172a)', fontWeight: 600 }}>
                  🏥 {profile.subcentre.name} ({profile.village})
                </span>
                <button
                  type="button"
                  onClick={() => setIsRegOpen(true)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-medium, #cbd5e1)',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: 'var(--text-muted, #64748b)',
                  }}
                  title="Edit registration details"
                >
                  ✏️ {t('reg_edit_link') !== 'reg_edit_link' ? t('reg_edit_link') : 'Edit Profile'}
                </button>
                <button
                  type="button"
                  onClick={handleResetProfile}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '3px 6px',
                    fontSize: '11px',
                    color: '#dc2626',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                  title="Reset profile on this device"
                >
                  {t('reg_reset_link') !== 'reg_reset_link' ? t('reg_reset_link') : 'Reset'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsRegOpen(true)}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#0f766e',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>📍</span>
                <span>
                  {t('reg_btn_bar') !== 'reg_btn_bar' ? t('reg_btn_bar') : 'Register Profile for SOS'}
                </span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Modals */}
      <RegistrationModal
        isOpen={isRegOpen}
        onClose={() => setIsRegOpen(false)}
        onSaved={handleSavedProfile}
        initialProfile={profile}
      />

      <SosModal
        isOpen={isSosOpen}
        onClose={() => setIsSosOpen(false)}
        profile={profile}
        onRegisterClick={() => setIsRegOpen(true)}
      />
    </>
  );
}
