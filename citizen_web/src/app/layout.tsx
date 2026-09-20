import type { Metadata, Viewport } from 'next';
import './globals.css';
import { I18nProvider } from '../lib/useTranslation';
import Header from '../components/Header';
import EmergencyBar from '../components/EmergencyBar';
import CookieConsent from '../components/CookieConsent';
import ServiceWorkerRegister from '../components/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: {
    default: 'Jeevanya | Rural Health Triage & Emergency Referral',
    template: '%s | Jeevanya',
  },
  description:
    'Free AI-assisted rural primary healthcare clinical decision support, emergency SOS, and triage referral system. Offline-first, evidence-backed clinical protocols based on National Health Mission (NHM) standards.',
  keywords: [
    'Jeevanya',
    'Swasthya Setu',
    'Rural Health',
    'Emergency SOS',
    'Health Triage',
    'Clinical Decision Support',
    'NHM Guidelines',
    'India Healthcare',
    'Ayushman Bharat',
    'ASHA Referral',
    'Primary Health Centre',
  ],
  authors: [{ name: 'Ministry of Health & Family Welfare / National Health Mission' }],
  creator: 'Jeevanya Digital Health Initiative',
  metadataBase: new URL('https://swasthyasetu.nhm.gov.in'),
  alternates: {
    canonical: 'https://swasthyasetu.nhm.gov.in',
  },
  icons: {
    icon: [
      {
        url: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    apple: [
      {
        url: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://swasthyasetu.nhm.gov.in',
    title: 'Jeevanya | Clinical Health Triage & Emergency Referral',
    description: 'Instant, evidence-backed clinical guidance, emergency SOS dispatch, and facility routing for rural citizens.',
    siteName: 'Jeevanya',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Jeevanya - Rural Primary Healthcare Triage System',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Jeevanya | Clinical Health Triage & Emergency Referral',
    description: 'Instant, evidence-backed clinical guidance, emergency SOS dispatch, and facility routing for rural citizens.',
    images: ['/og-image.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0f766e',
};

const jsonLdData = [
  {
    '@context': 'https://schema.org',
    '@type': 'MedicalOrganization',
    name: 'Jeevanya Rural Healthcare Initiative',
    url: 'https://swasthyasetu.nhm.gov.in',
    logo: 'https://swasthyasetu.nhm.gov.in/logo.png',
    description: 'National Health Mission aligned rural clinical triage and emergency facility referral network.',
    medicalSpecialty: ['EmergencyCare', 'PrimaryCare', 'CommunityHealth'],
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'IN',
      addressRegion: 'Maharashtra',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '108',
      contactType: 'emergency',
      areaServed: 'IN',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'GovernmentOrganization',
    name: 'National Health Mission - Jeevanya',
    url: 'https://swasthyasetu.nhm.gov.in',
    parentOrganization: {
      '@type': 'GovernmentOrganization',
      name: 'Ministry of Health and Family Welfare, Government of India',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    additionalType: 'https://schema.org/MedicalClinic',
    name: 'Kurkheda Primary Health Centre (PHC)',
    image: 'https://swasthyasetu.nhm.gov.in/phc-kurkheda.jpg',
    telephone: '+91-7138-245100',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Main Road, Kurkheda PHC Complex',
      addressLocality: 'Kurkheda',
      addressRegion: 'Maharashtra',
      postalCode: '441209',
      addressCountry: 'IN',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 20.5833,
      longitude: 80.1833,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ],
        opens: '00:00',
        closes: '23:59',
      },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Jeevanya',
    url: 'https://swasthyasetu.nhm.gov.in',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://swasthyasetu.nhm.gov.in/search?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon-192.png" type="image/png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
        />
      </head>
      <body>
        <I18nProvider>
          <ServiceWorkerRegister />
          <Header />
          <EmergencyBar />
          {children}
          <CookieConsent />
        </I18nProvider>
      </body>
    </html>
  );
}
