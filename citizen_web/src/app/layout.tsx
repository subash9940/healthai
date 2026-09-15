import type { Metadata, Viewport } from 'next';
import './globals.css';
import { I18nProvider } from '../lib/useTranslation';
import Header from '../components/Header';
import EmergencyBar from '../components/EmergencyBar';
import CookieConsent from '../components/CookieConsent';

export const metadata: Metadata = {
  title: {
    default: 'Jeevanya (जीवन्या) | Rural Health Triage & Referral',
    template: '%s | Jeevanya',
  },
  description:
    'Free AI-assisted rural primary healthcare clinical decision support and triage referral system. Offline-first, evidence-backed clinical protocols based on National Health Mission (NHM) standards.',
  keywords: [
    'Jeevanya',
    'Rural Health',
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
  metadataBase: new URL('https://jeevanya.nhm.gov.in'),
  alternates: {
    canonical: 'https://jeevanya.nhm.gov.in',
  },
  icons: {
    icon: [
      {
        url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%230f766e"/><path d="M50 25v50M25 50h50" stroke="white" stroke-width="14" stroke-linecap="round"/></svg>',
        type: 'image/svg+xml',
      },
    ],
    apple: [
      {
        url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%230f766e"/><path d="M50 25v50M25 50h50" stroke="white" stroke-width="14" stroke-linecap="round"/></svg>',
        type: 'image/svg+xml',
      },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://jeevanya.nhm.gov.in',
    title: 'Jeevanya (जीवन्या) | Clinical Health Triage',
    description: 'Instant, evidence-backed clinical guidance and facility routing for rural citizens.',
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
    title: 'Jeevanya (जीवन्या) | Clinical Health Triage',
    description: 'Instant, evidence-backed clinical guidance and facility routing for rural citizens.',
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
    url: 'https://jeevanya.nhm.gov.in',
    logo: 'https://jeevanya.nhm.gov.in/logo.png',
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
    url: 'https://jeevanya.nhm.gov.in',
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
    image: 'https://jeevanya.nhm.gov.in/phc-kurkheda.jpg',
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
    url: 'https://jeevanya.nhm.gov.in',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://jeevanya.nhm.gov.in/search?q={search_term_string}',
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
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%230f766e'/><path d='M50 25v50M25 50h50' stroke='white' stroke-width='14' stroke-linecap='round'/></svg>"
          type="image/svg+xml"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
        />
      </head>
      <body>
        <I18nProvider>
          <Header />
          <EmergencyBar />
          {children}
          <CookieConsent />
        </I18nProvider>
      </body>
    </html>
  );
}
