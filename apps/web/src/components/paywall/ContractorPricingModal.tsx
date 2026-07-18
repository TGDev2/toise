'use client';

import { useEffect, useState } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { apiGet, apiPost } from '@/lib/api';

interface ContractorPricingModalProps {
  onClose: () => void;
  triggerFeature?: string;
}

interface ApiPlan {
  key: string;
  label: string;
  price: number;
  price_id: string | null;
}

const CONTRACTOR_PLANS = [
  {
    key: 'contractor_essentiel',
    label: 'Essentiel',
    fallbackPrice: 50,
    features: [
      'Projets illimités',
      'Export de devis PDF',
      'Gestion de clients',
      'Toutes les fonctionnalités Pro',
    ],
  },
  {
    key: 'contractor_standard',
    label: 'Standard',
    fallbackPrice: 100,
    popular: true,
    features: [
      'Tout Essentiel +',
      'Modèles de devis personnalisés',
      'Historique clients avancé',
      'Support prioritaire',
    ],
  },
  {
    key: 'contractor_premium',
    label: 'Premium',
    fallbackPrice: 200,
    features: [
      'Tout Standard +',
      'Multi-utilisateurs',
      "API d'intégration",
      'Accompagnement dédié',
    ],
  },
];

export function ContractorPricingModal({
  onClose,
  triggerFeature,
}: ContractorPricingModalProps) {
  const { track } = useAnalytics();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [apiPlans, setApiPlans] = useState<Record<string, ApiPlan>>({});

  useEffect(() => {
    apiGet<{ plans: ApiPlan[] }>('/subscriptions/plans')
      .then(({ plans }) => {
        setApiPlans(
          Object.fromEntries(plans.map((plan) => [plan.key, plan])),
        );
      })
      .catch(() => {
        setError('Impossible de charger les offres. Réessayez plus tard.');
      });
  }, []);

  const handleSelect = async (planKey: string) => {
    const priceId = apiPlans[planKey]?.price_id;
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
      window.location.assign(url);
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
      <div className="mx-4 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
        {/* Close button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <h2 className="mb-2 text-center text-xl font-bold text-stone-900">
          Chiffréo Contractor
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
                  ? 'border-[var(--accent)]/40 bg-[var(--accent)]/5 shadow-md'
                  : 'border-stone-200'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--accent)] px-3 py-0.5 text-xs font-medium text-white">
                  Populaire
                </span>
              )}
              <h3 className="text-lg font-semibold text-stone-900">
                {plan.label}
              </h3>
              <p className="mt-2">
                <span className="text-2xl font-bold text-stone-900">
                  {apiPlans[plan.key]?.price ?? plan.fallbackPrice} &euro;
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
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]"
                      aria-hidden="true"
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
                    ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]'
                    : 'bg-stone-900 text-white hover:bg-stone-800'
                }`}
              >
                {loadingPlan === plan.key ? 'Redirection...' : 'Choisir'}
              </button>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-stone-400">
          Sans engagement. Annulable à tout moment.
        </p>
      </div>
    </div>
  );
}
