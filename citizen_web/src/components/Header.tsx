'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useI18n, Language } from '../lib/useTranslation';

export default function Header() {
  const { language, setLanguage, t } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const languages = [
    { code: 'en' as const, label: 'English' },
    { code: 'hi' as const, label: 'हिन्दी' },
    { code: 'ta' as const, label: 'தமிழ்' },
    { code: 'mr' as const, label: 'मराठी' },
  ];

  return (
    <>
      {/* Institutional Top Strip */}
      <div className="top-gov-strip" role="banner" aria-label="Official Health Portal Information">
        <div className="top-gov-inner">
          <div className="top-gov-dept">
            <span className="gov-badge-emblem">Govt. Verified</span>
            <span>{t('header.dept') !== 'header.dept' ? t('header.dept') : 'Ministry of Health & Family Welfare / NHM'}</span>
          </div>
          <div>{t('header.portal_type') !== 'header.portal_type' ? t('header.portal_type') : 'Rural Primary Healthcare Decision Support System'}</div>
        </div>
      </div>

      {/* Main Header */}
      <header className="main-header" role="navigation" aria-label="Main Navigation">
        <div className="header-container">
          <Link
            href="/"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}
            aria-label="Jeevanya — Return to Homepage"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                background: 'var(--primary)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0,
                boxShadow: '0 1px 3px rgba(15, 118, 110, 0.25)',
              }}
              aria-hidden="true"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <div>
              <div className="brand-title">{t('header.brand') !== 'header.brand' ? t('header.brand') : 'Jeevanya'}</div>
              <div className="brand-subtitle">{t('header.tagline') !== 'header.tagline' ? t('header.tagline') : 'Clinical Health Triage & Referral'}</div>
            </div>
          </Link>

          {/* Mobile Hamburger Toggle Button */}
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
          >
            {mobileMenuOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            )}
          </button>

          {/* Navigation Links + Language Selector */}
          <nav className={`header-nav ${mobileMenuOpen ? 'open' : ''}`} aria-label="Site Links">
            <div className="lang-selector" role="group" aria-label="Select Language">
              {languages.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  className={`lang-btn ${language === l.code ? 'active' : ''}`}
                  onClick={() => {
                    setLanguage(l.code);
                    setMobileMenuOpen(false);
                  }}
                  aria-pressed={language === l.code}
                  aria-label={`Switch language to ${l.label}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </header>
    </>
  );
}
