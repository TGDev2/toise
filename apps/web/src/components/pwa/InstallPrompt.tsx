'use client';

import { useCallback, useEffect, useState } from 'react';
import { CONSENT_EVENT, CONSENT_KEY } from '@/components/CookieConsent';
import { trackPwaEvent } from '@/lib/pwa-analytics';

const DISMISS_KEY = 'chiffreo_install_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  // Ce bandeau et celui des cookies sont tous deux `fixed bottom-0` : on attend que le
  // consentement cookies soit résolu avant de s'afficher pour ne jamais les superposer.
  const [consentResolved, setConsentResolved] = useState(false);

  useEffect(() => {
    const checkConsent = () => setConsentResolved(localStorage.getItem(CONSENT_KEY) !== null);
    checkConsent();
    window.addEventListener(CONSENT_EVENT, checkConsent);
    window.addEventListener('storage', checkConsent);
    return () => {
      window.removeEventListener(CONSENT_EVENT, checkConsent);
      window.removeEventListener('storage', checkConsent);
    };
  }, []);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
      trackPwaEvent('pwa_install_prompted');
    };

    const handleAppInstalled = () => {
      setDeferredEvent(null);
      trackPwaEvent('pwa_installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    // `outcome` est le seul signal d'acceptation réelle : `appinstalled` peut ne
    // jamais suivre (installation annulée par l'OS, app déjà présente).
    const { outcome } = await deferredEvent.userChoice;
    trackPwaEvent(
      outcome === 'accepted' ? 'pwa_install_accepted' : 'pwa_install_dismissed',
      outcome === 'accepted' ? {} : { surface: 'native' },
    );
    setDeferredEvent(null);
  }, [deferredEvent]);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, '1');
    trackPwaEvent('pwa_install_dismissed', { surface: 'banner' });
    setDeferredEvent(null);
  }, []);

  if (!deferredEvent || !consentResolved) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(67,39,15,0.08)]">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 sm:flex-row">
        <p className="flex-1 text-sm text-stone-600">
          Installez Chiffréo sur votre appareil pour un accès rapide, même hors connexion.
        </p>
        <div className="flex gap-3">
          <button
            onClick={dismiss}
            className="inline-flex min-h-11 items-center rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
          >
            Plus tard
          </button>
          <button
            onClick={install}
            className="inline-flex min-h-11 items-center rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-strong)]"
          >
            Installer
          </button>
        </div>
      </div>
    </div>
  );
}
