'use client';

import { useState } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { apiPost } from '@/lib/api';

interface ContractorPricingModalProps {
  onClose: () => void;
  triggerFeature?: string;
}

const CONTRACTOR_PLANS = [
  {
    key: 'essentiel',
    label: 'Essentiel',
    price: 50,
    features: [
      'Projets illimites',
      'Export de devis PDF',
      'Gestion de clients',
      'Toutes les fonctionnalites Pro',
    ],
  },
  {
    key: 'standard',
    label: 'Standard',
    price: 100,
    popular: true,
    features: [
      'Tout Essentiel +',
      'Modeles de devis personnalises',
      'Historique clients avance',
      'Support prioritaire',
    ],
  },
  {
    key: 'premium',
    label: 'Premium',
    price: 200,
    features: [
      'Tout Standard +',
      'Multi-utilisateurs',
      'API d\'integration',
      'Accompagnement dedie',
    ],
  },
];

const PRICE_ID_ENV: Record<string, string> = {
  essentiel: process.env.NEXT_PUBLIC_STRIPE_CONTRACTOR_ESSENTIEL_PRICE_ID ?? '',
  standard: process.env.NEXT_PUBLIC_STRIPE_CONTRACTOR_STANDARD_PRICE_ID ?? '',
  premium: process.env.NEXT_PUBLIC_STRIPE_CONTRACTOR_PREMIUM_PRICE_ID ?? '',
};

export function ContractorPricingModal({
  onClose,
  triggerFeature,
}: ContractorPricingModalProps) {
  const { track } = useAnalytics();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSelect = async (planKey: string) => {
    const priceId = PRICE_ID_ENV[planKey];
    if (!priceId) {
      setError('Plan non disponible pour le moment.');
      return;
    }

    track('contractor_plan_clicked', {
      plan: planKey,
      trigger_feature: triggerFeature,
    });

    setLoadingPlan(planKey);
    setError('');
    try {
      const { url } = await apiPost<{ url: string }>('/subscriptions/checkout', {
        price_id: priceId,
      });
      window.location.href = url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors de la souscription.',
      );
      setLoadingPlan(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-4 w-full max-w-3xl rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
        {/* Close button */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
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

        <h2 className="mb-2 text-center text-xl font-bold text-stone-900">
          EstiMate Contractor
        </h2>
        <p className="mb-6 text-center text-sm text-stone-500">
          Des outils professionnels pour les artisans
        </p>

        {error && (
          <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-center text-xs text-red-700">
            {error}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {CONTRACTOR_PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`relative rounded-2xl border p-6 ${
                plan.popular
                  ? 'border-blue-300 bg-blue-50/50 shadow-md'
                  : 'border-stone-200'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-medium text-white">
                  Populaire
                </span>
              )}
              <h3 className="text-lg font-semibold text-stone-900">
                {plan.label}
              </h3>
              <p className="mt-2">
                <span className="text-2xl font-bold text-stone-900">
                  {plan.price} &euro;
                </span>
                <span className="text-sm text-stone-500"> /mois</span>
              </p>
              <ul className="mt-4 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-stone-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="mt-0.5 h-4 w-4 shrink-0 text-green-500"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => handleSelect(plan.key)}
                disabled={loadingPlan !== null}
                className={`mt-6 w-full rounded-full px-4 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 ${
                  plan.popular
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-stone-900 text-white hover:bg-stone-800'
                }`}
              >
                {loadingPlan === plan.key ? 'Redirection...' : 'Choisir'}
              </button>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-stone-400">
          Sans engagement. Annulable a tout moment.
        </p>
      </div>
    </div>
  );
}
