'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';

const CONSENT_KEY = 'estimate_cookie_consent';
const CONSENT_EVENT = 'estimate-cookie-consent-change';

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
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white p-4 shadow-lg">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 sm:flex-row">
        <p className="flex-1 text-sm text-gray-600">
          Nous utilisons des cookies essentiels pour le fonctionnement de
          l&apos;application.{' '}
          <Link href="/privacy" className="text-blue-600 underline hover:text-blue-500">
            Politique de confidentialite
          </Link>
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setConsent('declined')}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Refuser
          </button>
          <button
            onClick={() => setConsent('accepted')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
