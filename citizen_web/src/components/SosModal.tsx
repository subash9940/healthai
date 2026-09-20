'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '../lib/useTranslation';
import {
  JeevanyaProfile,
  addToSosQueue,
  processSosQueue,
} from '../lib/profile';

interface SosModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: JeevanyaProfile | null;
  onRegisterClick: () => void;
}

type SosStatus = 'confirm' | 'sending' | 'sent' | 'offline';

export default function SosModal({
  isOpen,
  onClose,
  profile,
  onRegisterClick,
}: SosModalProps) {
  const { t } = useI18n();

  const [status, setStatus] = useState<SosStatus>('confirm');
  const [confirmedFacilityName, setConfirmedFacilityName] = useState<string>('');
  const [smsTapped, setSmsTapped] = useState<boolean>(false);
  const [alertPayload, setAlertPayload] = useState<{
    client_alert_id: string;
    smsHref: string;
    telHref: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStatus('confirm');
      setSmsTapped(false);
      setAlertPayload(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // If user is not registered, guide them to register first
  if (!profile) {
    return (
      <div
        className="modal-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px',
          backdropFilter: 'blur(6px)',
        }}
        role="dialog"
        aria-modal="true"
      >
        <div
          style={{
            background: 'var(--bg-surface, #ffffff)',
            borderRadius: '20px',
            maxWidth: '500px',
            width: '100%',
            padding: '32px',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🚨</div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-dark, #0f172a)', margin: '0 0 8px 0' }}>
            {t('sos_unregistered_title') !== 'sos_unregistered_title' ? t('sos_unregistered_title') : 'Registration Required for SOS'}
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted, #64748b)', margin: '0 0 24px 0', lineHeight: 1.5 }}>
            {t('sos_unregistered_desc') !== 'sos_unregistered_desc'
              ? t('sos_unregistered_desc')
              : 'Please register your emergency contact details and nearest Sub-centre so health workers can be dispatched to you immediately.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#fff',
                border: '1px solid var(--border-medium, #cbd5e1)',
                padding: '12px 20px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                color: 'var(--text-muted, #64748b)',
              }}
            >
              {t('sos_confirm_cancel') !== 'sos_confirm_cancel' ? t('sos_confirm_cancel') : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onRegisterClick();
              }}
              style={{
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
              }}
            >
              {t('reg_title') !== 'reg_title' ? t('reg_title') : 'Register Profile Now'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const triggerSosSend = async () => {
    setStatus('sending');

    const client_alert_id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const reported_at = new Date().toISOString();

    const payload = {
      client_alert_id,
      reported_at,
      patient_name: profile.name,
      patient_phone: profile.phone,
      patient_village: profile.village,
      patient_age: profile.age ?? null,
      patient_sex: profile.sex ?? null,
      lat: profile.coords?.lat ?? null,
      lng: profile.coords?.lng ?? null,
      accuracy: profile.coords?.accuracy ?? null,
      facility_id: profile.subcentre.id,
      channel: 'citizen_web',
    };

    // Prepare SMS fallback data
    let smsBody = `SOS ${profile.name} ${profile.phone} ${profile.village}`;
    if (profile.coords?.lat && profile.coords?.lng) {
      smsBody += ` location: https://maps.google.com/?q=${profile.coords.lat},${profile.coords.lng}`;
    }
    const smsHref = `sms:${profile.subcentre.contact_phone}?&body=${encodeURIComponent(smsBody)}`;
    const telHref = `tel:${profile.subcentre.contact_phone}`;

    setAlertPayload({ client_alert_id, smsHref, telHref });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        // ONLY claim sent when 200 with alert_id
        if (data.alert_id || data.id || data.client_alert_id) {
          setConfirmedFacilityName(data.facility_name || profile.subcentre.name);
          setStatus('sent');
          return;
        }
      }

      // If backend returned non-ok or no alert_id
      handleOffline(payload);
    } catch {
      handleOffline(payload);
    }
  };

  const handleOffline = (payload: any) => {
    // Queue the alert in localStorage
    addToSosQueue({
      ...payload,
      facility_name: profile.subcentre.name,
      facility_phone: profile.subcentre.contact_phone,
      queued_at: new Date().toISOString(),
    });

    // Attempt background processing in case connection flapped
    processSosQueue();

    setStatus('offline');
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        backdropFilter: 'blur(8px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sos-modal-title"
    >
      <div
        style={{
          background: 'var(--bg-surface, #ffffff)',
          borderRadius: '24px',
          maxWidth: '540px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '28px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          border: '2px solid #ef4444',
        }}
      >
        {/* CONFIRM PHASE */}
        {status === 'confirm' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  fontSize: '32px',
                }}
              >
                🚨
              </div>
              <h2
                id="sos-modal-title"
                style={{ fontSize: '24px', fontWeight: 900, color: '#b91c1c', margin: '0 0 6px 0' }}
              >
                {t('sos_confirm_title') !== 'sos_confirm_title' ? t('sos_confirm_title') : 'Send Emergency SOS Alert?'}
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-muted, #64748b)', margin: 0 }}>
                {t('sos_confirm_subtitle') !== 'sos_confirm_subtitle'
                  ? t('sos_confirm_subtitle')
                  : 'This will immediately notify your assigned Sub-centre healthcare workers with your location and contact details.'}
              </p>
            </div>

            {/* Emergency Details Box */}
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '20px',
                fontSize: '13px',
                color: '#991b1b',
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📋 {t('sos_alert_summary') !== 'sos_alert_summary' ? t('sos_alert_summary') : 'Alert Details to be Transmitted:'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px' }}>
                <div><strong>Patient:</strong> {profile.name} ({profile.phone})</div>
                <div><strong>Location:</strong> {profile.village}</div>
                <div><strong>Assigned Facility:</strong> {profile.subcentre.name} (📞 {profile.subcentre.contact_phone})</div>
                <div>
                  <strong>GPS Coordinates:</strong>{' '}
                  {profile.coords
                    ? `✓ ${profile.coords.lat.toFixed(4)}, ${profile.coords.lng.toFixed(4)}`
                    : 'Not attached'}
                </div>
              </div>
            </div>

            {/* Big Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={triggerSosSend}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  padding: '16px 24px',
                  borderRadius: '12px',
                  fontSize: '18px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  width: '100%',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                🚨 {t('sos_confirm_yes') !== 'sos_confirm_yes' ? t('sos_confirm_yes') : 'Yes, Send Emergency SOS Now'}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: '#fff',
                  border: '1px solid var(--border-medium, #cbd5e1)',
                  padding: '12px 20px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--text-muted, #64748b)',
                  width: '100%',
                }}
              >
                {t('sos_confirm_cancel') !== 'sos_confirm_cancel' ? t('sos_confirm_cancel') : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* SENDING PHASE */}
        {status === 'sending' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                border: '4px solid #fee2e2',
                borderTopColor: '#dc2626',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px',
              }}
            />
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-dark, #0f172a)', margin: '0 0 6px 0' }}>
              {t('sos_status_sending') !== 'sos_status_sending' ? t('sos_status_sending') : 'Sending Emergency Alert...'}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)', margin: 0 }}>
              Connecting to {profile.subcentre.name} via high-priority dispatch...
            </p>
          </div>
        )}

        {/* SENT SUCCESS PHASE */}
        {status === 'sent' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#dcfce7',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                margin: '0 auto 16px',
              }}
            >
              ✓
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#166534', margin: '0 0 8px 0' }}>
              {t('sos_status_sent') !== 'sos_status_sent'
                ? t('sos_status_sent').replace('{facility}', confirmedFacilityName || profile.subcentre.name)
                : `Sent - ${confirmedFacilityName || profile.subcentre.name} has your alert`}
            </h3>
            <p style={{ fontSize: '14px', color: '#15803d', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              {t('sos_sent_help_dispatched') !== 'sos_sent_help_dispatched'
                ? t('sos_sent_help_dispatched')
                : 'Your emergency distress signal was received. Health workers and local ASHA support are being coordinated.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <a
                href={`tel:${profile.subcentre.contact_phone}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: '#16a34a',
                  color: '#fff',
                  textDecoration: 'none',
                  padding: '14px 20px',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(22, 163, 74, 0.25)',
                }}
              >
                📞 Call {profile.subcentre.name} ({profile.subcentre.contact_phone})
              </a>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: '#fff',
                  border: '1px solid var(--border-medium, #cbd5e1)',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--text-muted, #64748b)',
                }}
              >
                {t('drawer.close') !== 'drawer.close' ? t('drawer.close') : 'Close'}
              </button>
            </div>
          </div>
        )}

        {/* NOT SENT - OFFLINE FALLBACK PHASE */}
        {status === 'offline' && alertPayload && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: '#fef3c7',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  margin: '0 auto 12px',
                }}
              >
                📡
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#92400e', margin: '0 0 4px 0' }}>
                {t('sos_status_failed_offline') !== 'sos_status_failed_offline'
                  ? t('sos_status_failed_offline')
                  : 'Not sent - no internet'}
              </h3>
              <div
                style={{
                  display: 'inline-block',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1e40af',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  marginTop: '4px',
                }}
              >
                🔄 {t('sos_status_queued') !== 'sos_status_queued'
                  ? t('sos_status_queued')
                  : 'Queued - will send automatically when online'}
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)', margin: '0 0 16px 0', textAlign: 'center' }}>
              {t('sos_offline_action_hint') !== 'sos_offline_action_hint'
                ? t('sos_offline_action_hint')
                : 'Send an offline SMS alert immediately or make a direct phone call to your assigned Sub-centre.'}
            </p>

            {smsTapped && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  color: '#166534',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  marginBottom: '14px',
                  textAlign: 'center',
                }}
              >
                💬 {t('sos_sms_opened_hint') !== 'sos_sms_opened_hint'
                  ? t('sos_sms_opened_hint')
                  : 'SMS app opened - press Send to dispatch your alert'}
              </div>
            )}

            {/* Offline Action Links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href={alertPayload.smsHref}
                onClick={() => setSmsTapped(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: '#ea580c',
                  color: '#fff',
                  textDecoration: 'none',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontWeight: 800,
                  textAlign: 'center',
                  boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)',
                }}
              >
                ✉️ {t('sos_send_sms_btn') !== 'sos_send_sms_btn'
                  ? t('sos_send_sms_btn').replace('{facility}', profile.subcentre.name)
                  : `Send SMS to ${profile.subcentre.name}`}
              </a>

              <a
                href={alertPayload.telHref}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: '#0284c7',
                  color: '#fff',
                  textDecoration: 'none',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: 700,
                  textAlign: 'center',
                }}
              >
                📞 {t('sos_call_btn') !== 'sos_call_btn'
                  ? t('sos_call_btn').replace('{facility}', profile.subcentre.name)
                  : `Call ${profile.subcentre.name}`} ({profile.subcentre.contact_phone})
              </a>

              <button
                type="button"
                onClick={onClose}
                style={{
                  background: '#fff',
                  border: '1px solid var(--border-medium, #cbd5e1)',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--text-muted, #64748b)',
                  marginTop: '4px',
                }}
              >
                {t('drawer.close') !== 'drawer.close' ? t('drawer.close') : 'Close'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
