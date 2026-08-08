'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useFeatureGates } from '@/contexts/FeatureGateContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { ContractorPricingModal } from './ContractorPricingModal';

export function PaywallModal() {
  const { paywallFeature, closePaywall, getGateConfig } = useFeatureGates();
  const { appUser } = useAuth();
  const { track } = useAnalytics();

  const gate = paywallFeature ? getGateConfig(paywallFeature) : null;
  const isContractorGate = gate?.min_tier?.startsWith('contractor') ?? false;

  useEffect(() => {
    if (paywallFeature && appUser) {
      track('paywall_shown', {
        trigger_feature: paywallFeature,
        user_tier: appUser.subscription_tier,
      });
    }
  }, [paywallFeature, appUser, track]);

  if (!paywallFeature) return null;

  // Show contractor pricing for contractor-tier features
  if (isContractorGate) {
    return (
      <ContractorPricingModal
        onClose={closePaywall}
        triggerFeature={paywallFeature}
        requiredTier={gate?.min_tier}
      />
    );
  }

  return <FreeTierPaywallContent gate={gate} onClose={closePaywall} />;
}

/**
 * Ce panneau vendait le palier Pro à 9,99 €/mois et déclenchait un checkout
 * Stripe. Ce palier n'existe plus (E3-1, ADR 0002 D4), et depuis que le
 * chiffrage est gratuit, aucune gate payante n'arrive plus ici : les gates
 * payantes sont toutes `contractor_*` et partent dans la branche précédente.
 *
 * Ne restent donc que deux situations, et aucune ne se résout par un paiement :
 * une gate `free` refusée — c'est un compte qui manque, pas un abonnement — et
 * une gate gelée (`is_enabled = false`), refusée à tous les paliers, y compris
 * au plus élevé. Proposer une souscription dans l'un ou l'autre cas serait
 * vendre ce qu'aucun paiement ne débloque.
 */
function FreeTierPaywallContent({
  gate,
  onClose,
}: {
  gate: { label_fr: string; is_enabled: boolean } | null | undefined;
  onClose: () => void;
}) {
  const frozen = gate ? !gate.is_enabled : false;

  return (
    <div
      // Marqueur unique des deux racines de paywall (celle-ci et
      // `ContractorPricingModal`). Le parcours gratuit d'E3-2 assure qu'aucune
      // ne paraît avant l'export du devis : une assertion d'absence doit porter
      // sur un marqueur qui existe, sinon elle survit muette à sa disparition.
      data-testid="paywall-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-4 w-full max-w-md rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
        {/* Close button */}
        <div className="flex justify-end">
          <button
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
          {frozen
            ? 'Fonctionnalité indisponible'
            : 'Créez votre compte gratuit'}
        </h2>

        {/* Subtitle */}
        <p className="mb-6 text-center text-sm text-stone-500">
          {gate && (
            <span className="font-medium text-stone-700">{gate.label_fr}</span>
          )}{' '}
          {frozen
            ? 'n’est pas disponible pour le moment. Aucun abonnement ne la débloque.'
            : 'fait partie du chiffrage, gratuit et sans limite de chantiers. Il suffit d’un compte pour y accéder.'}
        </p>

        {/* CTA */}
        {frozen ? (
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-800 transition-all hover:border-stone-500 hover:bg-stone-50"
          >
            Fermer
          </button>
        ) : (
          <Link
            href="/register"
            onClick={onClose}
            className="block w-full rounded-full bg-[var(--accent)] px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] hover:shadow-md"
          >
            Créer mon compte gratuit
          </Link>
        )}

        {!frozen && (
          <p className="mt-3 text-center text-xs text-stone-400">
            Sans carte bancaire. Votre brouillon est conservé.
          </p>
        )}
      </div>
    </div>
  );
}
