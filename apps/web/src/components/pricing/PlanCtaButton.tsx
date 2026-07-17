'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { apiGet, apiPost } from '@/lib/api';

interface ApiPlan {
  key: string;
  label: string;
  price: number;
  price_id: string | null;
}

// GET /subscriptions/plans est derrière FirebaseAuthGuard : on ne le fetch
// qu'au clic d'un utilisateur connecté, une seule fois pour tous les boutons.
let plansPromise: Promise<Record<string, ApiPlan>> | null = null;

function fetchPlans(): Promise<Record<string, ApiPlan>> {
  if (!plansPromise) {
    plansPromise = apiGet<{ plans: ApiPlan[] }>('/subscriptions/plans')
      .then(({ plans }) =>
        Object.fromEntries(plans.map((plan) => [plan.key, plan])),
      )
      .catch((err) => {
        plansPromise = null;
        throw err;
      });
  }
  return plansPromise;
}

const VARIANT_CLASSES = {
  accent: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]',
  dark: 'bg-stone-900 text-white hover:bg-stone-800',
  outline:
    'border border-stone-300 text-stone-800 hover:border-stone-500 hover:bg-white',
} as const;

interface PlanCtaButtonProps {
  planKey: string;
  /** Absent pour le plan gratuit (aucun checkout). */
  apiPlanKey?: string;
  label: string;
  variant: keyof typeof VARIANT_CLASSES;
  className?: string;
}

export function PlanCtaButton({
  planKey,
  apiPlanKey,
  label,
  variant,
  className = '',
}: PlanCtaButtonProps) {
  const { appUser, isGuest } = useAuth();
  const { track } = useAnalytics();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const buttonClasses = `block w-full rounded-full px-4 py-2.5 text-center text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${className}`;

  // Plan gratuit : accès direct aux projets ou création de compte.
  if (!apiPlanKey) {
    const hasSession = Boolean(appUser) || isGuest;
    return (
      <Link href={hasSession ? '/dashboard' : '/register'} className={buttonClasses}>
        {hasSession ? 'Accéder à mes projets' : label}
      </Link>
    );
  }

  // Payant, sans compte (ou invité anonyme) : inscription d'abord — le
  // checkout exige un compte authentifié avec email pour créer le client
  // Stripe ; un abonnement lié à un compte anonyme serait perdable.
  if (!appUser || isGuest) {
    return (
      <Link href="/register" className={buttonClasses}>
        {label}
      </Link>
    );
  }

  if (apiPlanKey === 'pro' && appUser.subscription_tier === 'pro') {
    return (
      <button type="button" disabled className={buttonClasses}>
        Votre offre actuelle
      </button>
    );
  }

  const handleClick = async () => {
    track('pricing_cta_clicked', { plan: planKey });
    setLoading(true);
    setError('');
    try {
      const plans = await fetchPlans();
      const priceId = plans[apiPlanKey]?.price_id;
      if (!priceId) {
        setError('Plan non disponible pour le moment.');
        setLoading(false);
        return;
      }
      const { url } = await apiPost<{ url: string }>('/subscriptions/checkout', {
        price_id: priceId,
      });
      window.location.assign(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors de la souscription.',
      );
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={buttonClasses}
      >
        {loading ? 'Redirection...' : label}
      </button>
      {error && (
        <p className="mt-2 text-center text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
