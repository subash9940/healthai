'use client';

import React from 'react';
import { useI18n } from '../lib/useTranslation';

export default function EmergencyBar() {
  const { t } = useI18n();

  return (
    <aside className="emergency-strip" role="complementary" aria-label="Emergency Services Helpline">
      <div className="emergency-strip-inner">
        <div className="emergency-strip-text">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>
            {t('emergency.strip_msg') !== 'emergency.strip_msg'
              ? t('emergency.strip_msg')
              : 'Medical Emergency? Dial national helplines immediately.'}
          </span>
        </div>
        <div className="emergency-links">
          <a
            href="tel:108"
            className="emergency-phone-link"
            aria-label="Call National Emergency Ambulance at 108"
            title="Call 108 for Emergency Ambulance Service"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>
              {t('emergency.helpline_btn') !== 'emergency.helpline_btn'
                ? t('emergency.helpline_btn')
                : 'Health Helpline'}
              : 104
            </span>
          </a>
        </div>
      </div>
    </aside>
  );
}
