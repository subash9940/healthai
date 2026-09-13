'use client';

import React from 'react';
import { useI18n } from '../lib/useTranslation';

export default function EmergencyBar() {
  const { t } = useI18n();

  return (
    <aside className="emergency-strip" role="complementary" aria-label="Emergency Services Helpline">
      <div className="emergency-strip-inner">
        <div className="emergency-strip-text">
          <span aria-hidden="true">🚨</span>
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
            <span aria-hidden="true">📞</span>
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
            <span aria-hidden="true">ℹ️</span>
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
