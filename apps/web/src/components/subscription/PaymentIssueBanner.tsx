'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

/**
 * Bandeau de relance d'un impayé (E5-2).
 *
 * Deux états, et la différence entre les deux n'est pas cosmétique :
 *
 * - **pendant le délai de grâce** — l'accès est intact, le bandeau le dit et ne
 *   gêne rien. Il est dans le flux de la page, jamais en `fixed` par-dessus le
 *   contenu : la plupart de ces incidents sont une carte expirée, et un
 *   utilisateur de bonne foi ne doit pas être empêché de travailler par une
 *   modale pendant qu'il règle un problème avec sa banque ;
 * - **après expiration** — le palier est déjà retombé sur gratuit côté serveur.
 *   Le message nomme ce qui est perdu **et** ce qui est conservé. Le second
 *   point compte autant que le premier : les devis et factures déjà émis
 *   restent consultables et exportables (les routes de lecture ne sont plus
 *   gatées), et un artisan qui croit avoir perdu sa facturation appelle le
 *   support avant de lire quoi que ce soit.
 *
 * L'échéance vient du serveur (`past_due_grace_ends_at`) : le navigateur ne
 * connaît pas `STRIPE_PAST_DUE_GRACE_DAYS` et n'a pas à le recalculer.
 */
export function PaymentIssueBanner() {
  const { subscription, openPortal } = useSubscription();
  const { syncWithBackend } = useAuth();
  const resyncedRef = useRef(false);

  const graceEndsAt = subscription?.past_due_grace_ends_at ?? null;
  const isPastDue = subscription?.status === 'past_due';
  const isExpired =
    isPastDue && graceEndsAt !== null && new Date(graceEndsAt) <= new Date();

  // `AuthContext` ne resynchronise `appUser` qu'au changement d'état
  // d'authentification : une session déjà ouverte garde en mémoire le palier
  // payant après le déclassement, et l'interface continue de proposer des
  // actions que l'API refuse désormais. Une seule resynchronisation suffit —
  // le garde-fou évite la boucle si `syncWithBackend` change d'identité.
  useEffect(() => {
    if (!isExpired || resyncedRef.current) return;
    resyncedRef.current = true;
    void syncWithBackend();
  }, [isExpired, syncWithBackend]);

  if (!isPastDue) return null;

  if (!isExpired) {
    return (
      <div
        role="status"
        className="mx-auto mt-4 w-full max-w-6xl px-4 sm:px-6"
      >
        <div className="flex flex-col gap-3 rounded-[2rem] border border-amber-300 bg-amber-50 px-6 py-4 shadow-[0_20px_50px_rgba(67,39,15,0.08)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Votre dernier paiement n&apos;a pas abouti
            </p>
            <p className="mt-1 text-xs text-amber-800">
              Votre accès reste complet
              {graceEndsAt ? ` jusqu'au ${formatDate(graceEndsAt)}` : ''}. Il
              s&apos;agit le plus souvent d&apos;une carte expirée : mettre à
              jour votre moyen de paiement suffit à régulariser.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={openPortal}
            className="shrink-0"
          >
            Mettre à jour mon paiement
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div role="alert" className="mx-auto mt-4 w-full max-w-6xl px-4 sm:px-6">
      <div className="flex flex-col gap-3 rounded-[2rem] border border-red-300 bg-red-50 px-6 py-4 shadow-[0_20px_50px_rgba(67,39,15,0.08)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-red-800">
            Votre abonnement est suspendu faute de paiement
          </p>
          <p className="mt-1 text-xs text-red-700">
            Vous ne pouvez plus créer de devis ni de factures, ni dépasser deux
            projets.
          </p>
          <p className="mt-1 text-xs text-red-700">
            <span className="font-semibold">Rien n&apos;est perdu :</span> vos
            devis et factures déjà émis restent consultables et téléchargeables
            en PDF, et vos projets sont conservés. Tout redevient modifiable dès
            le paiement régularisé.
          </p>
        </div>
        <Button variant="danger" onClick={openPortal} className="shrink-0">
          Régulariser mon paiement
        </Button>
      </div>
    </div>
  );
}
