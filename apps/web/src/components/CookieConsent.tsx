'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';

// Exportées pour InstallPrompt.tsx, qui attend la résolution du consentement cookies avant de
// s'afficher (deux bandeaux `fixed bottom-0` ne peuvent pas se superposer).
export const CONSENT_KEY = 'chiffreo_cookie_consent';
export const CONSENT_EVENT = 'chiffreo-cookie-consent-change';

function subscribe(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleChange = () => {
    onStoreChange();
  };

  window.addEventListener('storage', handleChange);
  window.addEventListener(CONSENT_EVENT, handleChange);

  return () => {
    window.removeEventListener('storage', handleChange);
    window.removeEventListener(CONSENT_EVENT, handleChange);
  };
}

function getSnapshot() {
  if (typeof window === 'undefined') {
    return false;
  }

  return localStorage.getItem(CONSENT_KEY) === null;
}

function setConsent(value: 'accepted' | 'declined') {
  localStorage.setItem(CONSENT_KEY, value);
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function CookieConsent() {
  const visible = useSyncExternalStore(subscribe, getSnapshot, () => false);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(67,39,15,0.08)]">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 sm:flex-row">
        <p className="flex-1 text-sm text-stone-600">
          Nous utilisons des cookies essentiels pour le fonctionnement de
          l&apos;application.{' '}
          <Link
            href="/privacy"
            className="text-[var(--accent)] underline hover:text-[var(--accent-strong)]"
          >
            Politique de confidentialité
          </Link>
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setConsent('declined')}
            className="inline-flex min-h-11 items-center rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
          >
            Refuser
          </button>
          <button
            onClick={() => setConsent('accepted')}
            className="inline-flex min-h-11 items-center rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-strong)]"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
