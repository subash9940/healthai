import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '404 - Page Not Found',
  description: 'The requested page could not be found on Jeevanya.',
};

export default function NotFound() {
  return (
    <main className="page-container" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        className="form-card"
        style={{
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
          padding: '48px 32px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            background: 'var(--primary-surface)',
            color: 'var(--primary)',
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            marginBottom: '20px',
            fontWeight: 800,
          }}
          aria-hidden="true"
        >
          404
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '8px' }}>
          Page Not Found
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6, marginBottom: '28px' }}>
          The page or triage record you are looking for does not exist or has been moved. Return to the home triage wizard to continue.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" className="btn-primary" style={{ padding: '10px 24px' }}>
            ← Return to Home Triage
          </Link>
          <Link href="/facility" className="btn-secondary" style={{ padding: '10px 20px' }}>
            Facility Queue
          </Link>
        </div>

        <div style={{ marginTop: '32px', borderTop: '1px solid var(--border-light)', paddingTop: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
          Need emergency assistance? Call <a href="tel:108" style={{ fontWeight: 700, color: 'var(--urgency-emergency)' }}>108</a> or <a href="tel:104" style={{ fontWeight: 700 }}>104</a>.
        </div>
      </div>
    </main>
  );
}
