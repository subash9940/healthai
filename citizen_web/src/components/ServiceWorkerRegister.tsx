'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
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
  }, []);

  return null;
}
