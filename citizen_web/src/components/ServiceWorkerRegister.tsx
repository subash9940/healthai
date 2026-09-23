'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (process.env.NODE_ENV === 'production') {
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker
            .register('/sw.js')
            .then((reg) => {
              console.log('Jeevanya SW registered:', reg.scope);
            })
            .catch((err) => {
              console.error('Jeevanya SW registration failed:', err);
            });
        });
      }
    } else {
      // In development mode, unregister any existing service workers and purge caches
      // to prevent stale HTML/JS caching that breaks React hydration and button handlers.
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }
      if ('caches' in window) {
        caches.keys().then((keys) => {
          for (const key of keys) {
            caches.delete(key);
          }
        });
      }
    }
  }, []);

  return null;
}
