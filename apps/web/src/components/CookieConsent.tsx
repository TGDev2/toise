'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import {
  hasChosenConsent,
  setConsent,
  subscribeToConsent,
} from '@/lib/analytics-consent';

// Ce composant ne fait plus que rendre le bandeau : la valeur du consentement,
// sa lecture et sa portée appartiennent à `lib/analytics-consent`, qui est aussi
// ce que consultent les émetteurs de télémétrie. Tant que la règle vivait ici,
// personne d'autre ne la lisait et « Refuser » n'arrêtait rien.

function getSnapshot() {
  return !hasChosenConsent();
}

export function CookieConsent() {
  const visible = useSyncExternalStore(
    subscribeToConsent,
    getSnapshot,
    () => false,
  );

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
