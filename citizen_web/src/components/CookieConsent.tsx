'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('swasthya_cookie_consent');
      if (!consent) {
        setVisible(true);
      }
    } catch {
      // Fallback
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem('swasthya_cookie_consent', 'accepted');
    } catch {
      // Fallback
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-labelledby="cookie-notice-text">
      <div className="cookie-inner">
        <div id="cookie-notice-text" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <div>
            <strong>Privacy &amp; Local Storage:</strong> We use local browser storage strictly for offline clinical triage and temporary referral queue caching. No personal health data is tracked or sold. Learn more in our{' '}
            <Link href="/privacy" style={{ color: '#fff', textDecoration: 'underline', fontWeight: 600 }}>
              Privacy Policy
            </Link>.
          </div>
        </div>
        <button
          type="button"
          className="cookie-btn"
          onClick={handleAccept}
          aria-label="Acknowledge and dismiss privacy notice"
        >
          I Understand
        </button>
      </div>
    </div>
  );
}
