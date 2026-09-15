import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy & Clinical Data Governance',
  description: 'Jeevanya data protection, offline-first client-side evaluation, and patient confidentiality standards.',
};

export default function PrivacyPage() {
  const currentYear = new Date().getFullYear();

  return (
    <main className="page-container">
      <div className="form-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="form-header">
          <h1>Clinical Data Governance & Privacy</h1>
          <p>National Health Mission (NHM) and ABDM-aligned patient confidentiality standards.</p>
        </div>

        <section style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-dark)' }}>
            1. Zero-Storage Client-Side Processing
          </h3>
          <p style={{ color: 'var(--text-body)', lineHeight: 1.7, fontSize: '14px' }}>
            Jeevanya is built with an offline-first architecture. All initial rule evaluations and danger sign detections occur directly in your browser using deterministic algorithms. No personally identifiable medical records or phone numbers are sold or tracked.
          </p>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-dark)' }}>
            2. Local EMR & Facility Referrals
          </h3>
          <p style={{ color: 'var(--text-body)', lineHeight: 1.7, fontSize: '14px' }}>
            When referral records are created for facility handover (e.g. PHC / CHC queues), data is stored in your browser&apos;s local storage or transmitted across secure, parameterized FHIR R4 interoperability endpoints with strict role-based access control.
          </p>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-dark)' }}>
            3. Contact & Inquiries
          </h3>
          <p style={{ color: 'var(--text-body)', lineHeight: 1.7, fontSize: '14px' }}>
            For questions regarding privacy, security audits, or data governance, reach out to our grievance team at{' '}
            <a href="mailto:privacy-swasthya@nhm.gov.in" style={{ fontWeight: 600 }}>
              privacy-swasthya@nhm.gov.in
            </a>{' '}
            or call the National Health Helpline at{' '}
            <a href="tel:104" style={{ fontWeight: 600 }}>
              104
            </a>.
          </p>
        </section>

        <div className="btn-row" style={{ marginTop: '32px' }}>
          <Link href="/" className="btn-primary">
            ← Return to Triage Wizard
          </Link>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Last revised: {currentYear}
          </span>
        </div>
      </div>
    </main>
  );
}
