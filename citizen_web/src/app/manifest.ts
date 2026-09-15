import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Jeevanya (जीवन्या) Rural Health Triage',
    short_name: 'Jeevanya',
    description: 'Offline-first rural primary healthcare clinical decision support and triage referral system.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#0F766E',
    icons: [
      {
        src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%230f766e"/><path d="M50 25v50M25 50h50" stroke="white" stroke-width="14" stroke-linecap="round"/></svg>',
        sizes: '192x192 512x512',
        type: 'image/svg+xml',
      },
    ],
  };
}
