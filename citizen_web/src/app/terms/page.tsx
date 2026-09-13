import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Use & Clinical Protocols',
  description: 'Evidence-backed clinical triage protocols, usage terms, and liability disclosures for Swasthya Setu.',
};

export default function TermsPage() {
  const currentYear = new Date().getFullYear();

  return (
    <main className="page-container">
      <div className="form-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="form-header">
          <h1>Terms of Use & Clinical Scope</h1>
          <p>Guidelines for citizen triage, frontline ASHA workers, and primary health workers.</p>
        </div>

        <section style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-dark)' }}>
            1. Clinical Decision Support System (CDSS)
          </h3>
          <p style={{ color: 'var(--text-body)', lineHeight: 1.7, fontSize: '14px' }}>
            Swasthya Setu operates as a Clinical Decision Support System based on verified Ministry of Health &amp; Family Welfare (MoHFW), National Health Mission (NHM), IMNCI, and SBA clinical protocols. It assists in prioritizing care urgency and facility routing.
          </p>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-dark)' }}>
            2. Medical Emergency Disclaimer
          </h3>
          <p style={{ color: 'var(--text-body)', lineHeight: 1.7, fontSize: '14px' }}>
            This system does not replace direct examination by a licensed medical practitioner or emergency intervention. If experiencing acute chest pain, altered consciousness, uncontrolled postpartum hemorrhage, or breathing difficulty, call{' '}
            <a href="tel:108" style={{ fontWeight: 700, color: 'var(--urgency-emergency)' }}>
              108 immediately
            </a>.
          </p>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-dark)' }}>
            3. Support & Clinical Protocol Audits
          </h3>
          <p style={{ color: 'var(--text-body)', lineHeight: 1.7, fontSize: '14px' }}>
            To report clinical anomalies or suggest guideline updates, email our clinical review board at{' '}
            <a href="mailto:clinical-board@nhm.gov.in" style={{ fontWeight: 600 }}>
              clinical-board@nhm.gov.in
            </a>.
          </p>
        </section>

        <div className="btn-row" style={{ marginTop: '32px' }}>
          <Link href="/" className="btn-primary">
            ← Return to Triage Wizard
          </Link>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Effective: {currentYear}
          </span>
        </div>
      </div>
    </main>
  );
}
