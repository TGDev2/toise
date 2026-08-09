'use client';

import { useAdminAuth } from '@/hooks/useAdminAuth';
import { apiGet } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { useCallback, useEffect, useState } from 'react';
import { StatTile } from '@/components/admin/StatTile';
import { WeeklyShoppingListsChart } from '@/components/admin/WeeklyShoppingListsChart';
import { FunnelChart } from '@/components/admin/FunnelChart';
import { MrrChart } from '@/components/admin/MrrChart';
import { Alert, Skeleton } from '@/components/ui';

interface FunnelStep {
  event_name: string;
  count: number;
  conversion_from_previous: number | null;
  conversion_from_start: number;
}

interface MrrTier {
  tier: string;
  subscriber_count: number;
  mrr: number;
}

interface DashboardResponse {
  generated_at: string;
  weekly_shopping_lists: {
    weeks: number;
    series: { week_start: string; count: number }[];
  };
  funnel: {
    since: string;
    days: number;
    steps: FunnelStep[];
  };
  mrr: {
    currency: string;
    total_mrr: number;
    by_tier: MrrTier[];
    free_users_count: number;
    trialing_count: number;
  };
}

const FUNNEL_LABELS: Record<string, string> = {
  calculator_viewed: 'Visite calculateur',
  account_created: 'Compte créé',
  estimate_created: 'Première estimation',
  shopping_list_generated: 'Liste générée',
  checkout_started: 'Paiement démarré',
};

const TIER_LABELS: Record<string, string> = {
  pro: 'Pro (retiré)',
  contractor_essentiel: 'Chiffréo Pro',
  contractor_standard: 'Standard (jamais vendu)',
  contractor_premium: 'Premium (jamais vendu)',
};

const eurFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export default function AdminAnalyticsPage() {
  const { isAdmin } = useAdminAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiGet<DashboardResponse>(
        '/admin/analytics/dashboard?weeks=8&days=30',
      );
      setData(result);
    } catch (err: unknown) {
      setData(null);
      setError(getErrorMessage(err, 'Impossible de charger le tableau de bord'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchDashboard();
  }, [isAdmin, fetchDashboard]);

  if (!isAdmin) return null;

  if (loading) {
    return (
      <div>
        <Skeleton className="h-40 rounded-[2rem]" />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-48 rounded-[2rem]" />
          <Skeleton className="h-48 rounded-[2rem]" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl bg-[var(--surface)] p-8 text-center">
        <Alert variant="error">
          {error || 'Impossible de charger le tableau de bord.'}
        </Alert>
      </div>
    );
  }

  const paidSubscribers = data.mrr.by_tier.reduce(
    (sum, t) => sum + t.subscriber_count,
    0,
  );

  const funnelSteps = data.funnel.steps.map((step) => ({
    ...step,
    label: FUNNEL_LABELS[step.event_name] ?? step.event_name,
  }));

  const mrrTiers = data.mrr.by_tier.map((t) => ({
    ...t,
    label: TIER_LABELS[t.tier] ?? t.tier,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Tableau de bord North Star
        </h1>
        <p className="mt-1 text-sm text-[var(--foreground)]/60">
          Funnel sur {data.funnel.days} jours, listes sur{' '}
          {data.weekly_shopping_lists.weeks} semaines.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="MRR total"
          value={eurFormatter.format(data.mrr.total_mrr)}
        />
        <StatTile
          label="Abonnés payants"
          value={`${paidSubscribers}`}
          hint="Tous paliers payants"
        />
        <StatTile
          label="Utilisateurs gratuits"
          value={`${data.mrr.free_users_count}`}
        />
        <StatTile
          label="Essais en cours"
          value={`${data.mrr.trialing_count}`}
        />
      </div>

      <section className="mb-8 rounded-2xl border border-[var(--foreground)]/10 bg-[var(--surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
          Listes générées par semaine
        </h2>
        <WeeklyShoppingListsChart series={data.weekly_shopping_lists.series} />
      </section>

      <section className="mb-8 rounded-2xl border border-[var(--foreground)]/10 bg-[var(--surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
          Conversion par marche du funnel
        </h2>
        <FunnelChart steps={funnelSteps} />
      </section>

      <section className="rounded-2xl border border-[var(--foreground)]/10 bg-[var(--surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
          MRR par palier payant
        </h2>
        <MrrChart tiers={mrrTiers} />
      </section>
    </div>
  );
}
