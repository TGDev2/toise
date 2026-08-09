'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';

interface RefundEligibility {
  eligible: boolean;
  eligible_until: string | null;
  amount_cents: number | null;
  reason: string | null;
  window_days: number;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function formatEuros(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Le « 30 jours satisfait ou remboursé », rendu exerçable.
 *
 * Sans cette surface, la garantie resterait une phrase dans les CGV et un
 * endpoint que personne ne peut atteindre — c'est-à-dire exactement le geste
 * manuel dans le tableau de bord Stripe qu'elle remplace.
 *
 * L'éligibilité est chargée par un appel **distinct** de
 * `GET /subscriptions/current` : elle coûte un aller-retour Stripe, et la
 * greffer sur `current` en ajouterait un à chaque affichage du tableau de bord.
 * Elle échoue en silence — un incident de facturation ne doit pas empêcher un
 * artisan de voir ses chantiers.
 *
 * Rien n'est affiché tant que la fenêtre n'est pas ouverte : proposer un
 * remboursement à quelqu'un qui n'y a plus droit ne fait que promettre un
 * refus.
 */
export function RefundGuaranteeAction({
  onRefunded,
}: {
  onRefunded?: () => void;
}) {
  const [eligibility, setEligibility] = useState<RefundEligibility | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setEligibility(
        await apiGet<RefundEligibility>('/subscriptions/refund-eligibility'),
      );
    } catch {
      setEligibility(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await apiPost('/subscriptions/refund');
      setDone(true);
      setConfirming(false);
      onRefunded?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'La demande de remboursement a échoué.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <p className="mt-2 text-xs text-emerald-700">
        Remboursement demandé. Il est déjà parti chez votre banque, et votre
        abonnement est résilié. Le chiffrage reste gratuit et illimité.
      </p>
    );
  }

  if (!eligibility?.eligible || !eligibility.eligible_until) return null;

  if (!confirming) {
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-xs text-stone-500 underline hover:text-stone-800"
        >
          Demander le remboursement — possible jusqu&apos;au{' '}
          {formatDate(eligibility.eligible_until)}
        </button>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50 p-3">
      <p className="text-xs text-stone-700">
        {eligibility.amount_cents !== null
          ? `${formatEuros(eligibility.amount_cents)} vous seront rendus.`
          : 'Le montant de votre dernier prélèvement vous sera rendu.'}{' '}
        Votre abonnement sera résilié immédiatement : les devis et factures déjà
        émis restent consultables et exportables, et le chiffrage reste gratuit
        et sans limite de chantiers.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="rounded-full bg-stone-900 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {submitting ? 'Envoi…' : 'Confirmer le remboursement'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={submitting}
          className="rounded-full px-4 py-1.5 text-xs text-stone-600 hover:text-stone-900"
        >
          Annuler
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
