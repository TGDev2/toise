'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPost } from '@/lib/api';

interface SubscriptionData {
  status: string;
  stripe_price_id: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  /**
   * Fin du délai de grâce sur impayé, calculée par l'API ; `null` hors
   * `past_due`. Le délai lui-même (`STRIPE_PAST_DUE_GRACE_DAYS`) reste une
   * affaire de serveur : en dupliquer la valeur ici donnerait deux réponses à
   * la même question, dont une seule décide réellement de l'accès.
   */
  past_due_grace_ends_at: string | null;
}

interface SubscriptionResponse {
  subscription: SubscriptionData | null;
}

export function useSubscription() {
  const { appUser } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!appUser) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await apiGet<SubscriptionResponse>('/subscriptions/current');
      setSubscription(res.subscription);
    } catch {
      setError('Impossible de charger les informations d\u2019abonnement.');
    } finally {
      setIsLoading(false);
    }
  }, [appUser]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openCheckout = async (priceId?: string) => {
    try {
      const { url } = await apiPost<{ url: string }>(
        '/subscriptions/checkout',
        priceId ? { price_id: priceId } : undefined,
      );
      window.location.href = url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors de la souscription.',
      );
    }
  };

  const openPortal = async () => {
    try {
      const { url } = await apiPost<{ url: string }>('/subscriptions/portal');
      window.location.href = url;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible d\u2019ouvrir le portail.',
      );
    }
  };

  return { subscription, isLoading, error, openCheckout, openPortal, refresh };
}
