'use client';

import { useEffect, useState } from 'react';
import { useFeatureGates } from '@/contexts/FeatureGateContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { apiPost } from '@/lib/api';

const PRO_BENEFITS = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-[var(--accent)]">
        <path d="M1 8.25a1.25 1.25 0 1 1 2.5 0v7.5a1.25 1.25 0 1 1-2.5 0v-7.5ZM7.5 6v10.5a1.5 1.5 0 0 0 .8 1.327l3.652 1.95a1 1 0 0 0 1.295-.394l.862-1.518a1.5 1.5 0 0 0-.07-1.592l-1.597-2.394a.5.5 0 0 1 .046-.592l3.467-4.16a1.5 1.5 0 0 0-.009-1.958l-.196-.221a1.5 1.5 0 0 0-2.108-.1L10.58 8.328a.5.5 0 0 1-.658.022L7.928 6.78A1.5 1.5 0 0 0 7.5 6Z" />
      </svg>
    ),
    text: 'Analyse photo automatique des dimensions',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-[var(--accent)]">
        <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H4.28a.75.75 0 0 0-.75.75v3.955a.75.75 0 0 0 1.5 0v-2.134l.313.312a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.4Zm1.002-5.478a.75.75 0 0 0-.468.91 5.5 5.5 0 0 1-9.2 2.467l-.313-.312h2.434a.75.75 0 0 0 0-1.5H4.813a.75.75 0 0 0-.75.75v3.955a.75.75 0 0 0 1.5 0V10.08l.312.313a7 7 0 0 0 11.713-3.138.75.75 0 0 0-.91-.468Z" clipRule="evenodd" />
      </svg>
    ),
    text: 'Facteurs de perte avancés pour plus de précision',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-[var(--accent)]">
        <path d="M2 4.25A2.25 2.25 0 0 1 4.25 2h2.5A2.25 2.25 0 0 1 9 4.25v2.5A2.25 2.25 0 0 1 6.75 9h-2.5A2.25 2.25 0 0 1 2 6.75v-2.5ZM2 13.25A2.25 2.25 0 0 1 4.25 11h2.5A2.25 2.25 0 0 1 9 13.25v2.5A2.25 2.25 0 0 1 6.75 18h-2.5A2.25 2.25 0 0 1 2 15.75v-2.5ZM11 4.25A2.25 2.25 0 0 1 13.25 2h2.5A2.25 2.25 0 0 1 18 4.25v2.5A2.25 2.25 0 0 1 15.75 9h-2.5A2.25 2.25 0 0 1 11 6.75v-2.5ZM15.25 11h-2.5A2.25 2.25 0 0 0 10.5 13.25v2.5A2.25 2.25 0 0 0 12.75 18h2.5A2.25 2.25 0 0 0 17.5 15.75v-2.5A2.25 2.25 0 0 0 15.25 11Z" />
      </svg>
    ),
    text: 'Projets illimités',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-[var(--accent)]">
        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.732 6.232a2.5 2.5 0 0 1 3.536 0 .75.75 0 1 0 1.06-1.06 4 4 0 0 0-5.656 0 .75.75 0 0 0 1.06 1.06ZM6.5 9v.5a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-5a1 1 0 0 0-1 1Zm.25 5.75a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z" clipRule="evenodd" />
      </svg>
    ),
    text: 'Suivi budgétaire (bientôt)',
  },
];

export function PaywallModal() {
  const { paywallFeature, closePaywall, getGateConfig } = useFeatureGates();
  const { appUser } = useAuth();
  const { track } = useAnalytics();

  const gate = paywallFeature ? getGateConfig(paywallFeature) : null;

  useEffect(() => {
    if (paywallFeature && appUser) {
      track('paywall_shown', {
        trigger_feature: paywallFeature,
        user_tier: appUser.subscription_tier,
      });
    }
  }, [paywallFeature, appUser, track]);

  if (!paywallFeature) return null;

  const [ctaLoading, setCtaLoading] = useState(false);
  const [ctaError, setCtaError] = useState('');

  const handleCtaClick = async () => {
    track('paywall_clicked', {
      trigger_feature: paywallFeature,
    });
    setCtaLoading(true);
    setCtaError('');
    try {
      const { url } = await apiPost<{ url: string }>('/subscriptions/checkout');
      window.location.href = url;
    } catch (err) {
      setCtaError(
        err instanceof Error ? err.message : 'Erreur lors de la souscription.',
      );
      setCtaLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) closePaywall();
      }}
    >
      <div className="mx-4 w-full max-w-md rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
        {/* Close button */}
        <div className="flex justify-end">
          <button
            onClick={closePaywall}
            className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Icon */}
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)]/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-7 w-7 text-[var(--accent)]"
            >
              <path
                fillRule="evenodd"
                d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0 1 16.5 15Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="mb-2 text-center text-xl font-bold text-stone-900">
          Passez à EstiMate Pro
        </h2>

        {/* Subtitle */}
        {gate && (
          <p className="mb-6 text-center text-sm text-stone-500">
            <span className="font-medium text-stone-700">{gate.label_fr}</span>{' '}
            est une fonctionnalité Pro
          </p>
        )}

        {/* Benefits */}
        <div className="mb-6 space-y-3">
          {PRO_BENEFITS.map((benefit) => (
            <div key={benefit.text} className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">{benefit.icon}</div>
              <span className="text-sm text-stone-700">{benefit.text}</span>
            </div>
          ))}
        </div>

        {/* Price */}
        <p className="mb-4 text-center text-sm text-stone-600">
          <span className="text-lg font-bold text-stone-900">9,99 &euro;</span>
          <span className="text-stone-500"> /mois</span>
        </p>

        {/* Error */}
        {ctaError && (
          <p className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-center text-xs text-red-700">
            {ctaError}
          </p>
        )}

        {/* CTA */}
        <button
          type="button"
          onClick={handleCtaClick}
          disabled={ctaLoading}
          className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        >
          {ctaLoading ? 'Redirection...' : 'Essai gratuit de 7 jours'}
        </button>

        {/* Secondary */}
        <p className="mt-3 text-center text-xs text-stone-400">
          Annulable a tout moment. Sans engagement.
        </p>
      </div>
    </div>
  );
}
