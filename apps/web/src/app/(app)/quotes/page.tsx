'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGates } from '@/contexts/FeatureGateContext';
import { apiGet } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { QuoteStatusBadge } from '@/components/quotes/QuoteStatusBadge';
import type { Quote, QuoteStatus } from '@/lib/quote-types';
import { QUOTE_STATUS_LABELS } from '@/lib/quote-types';
import { Alert, Skeleton } from '@/components/ui';

const STATUS_FILTERS: (QuoteStatus | 'all')[] = [
  'all',
  'draft',
  'sent',
  'accepted',
  'refused',
  'negotiation',
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatPrice(v: number): string {
  return Number(v).toFixed(2).replace('.', ',');
}

export default function QuotesListPage() {
  const { appUser, isLoading } = useAuth();
  const { isFeatureAllowed, showPaywall } = useFeatureGates();
  const router = useRouter();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');

  useEffect(() => {
    if (isLoading) return;
    if (!appUser) {
      router.push('/login');
      return;
    }
  }, [appUser, isLoading, router]);

  // Le paywall ne s'ouvre plus au montage, mais seulement sur une liste vide
  // (E5-2). Un abonné déclassé — impayé, résiliation — garde l'accès en lecture
  // à ses devis déjà émis ; lui plaquer une modale commerciale par-dessus sa
  // propre liste, à chaque visite, transformerait une relance en obstruction.
  // Un utilisateur jamais abonné a toujours zéro devis : l'accroche vers
  // l'offre reste intacte pour lui, qui est le seul qu'elle vise.
  useEffect(() => {
    if (loading || !appUser || quotes.length > 0) return;
    if (!isFeatureAllowed('export_devis')) {
      showPaywall('export_devis');
    }
  }, [loading, appUser, quotes.length, isFeatureAllowed, showPaywall]);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const path =
        statusFilter === 'all'
          ? '/quotes'
          : `/quotes?status=${statusFilter}`;
      const data = await apiGet<Quote[]>(path);
      setQuotes(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de charger les devis'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (appUser) fetchQuotes();
  }, [appUser, fetchQuotes]);

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Skeleton className="h-32 rounded-[2rem]" />
        <div className="mt-6 space-y-4">
          <Skeleton className="h-28 rounded-[2rem]" />
          <Skeleton className="h-28 rounded-[2rem]" />
          <Skeleton className="h-28 rounded-[2rem]" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-[2rem] border border-stone-200 bg-[var(--surface)] p-6 shadow-[0_25px_80px_rgba(67,39,15,0.10)] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            Espace professionnel
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">
            Mes devis
          </h1>
        </div>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white"
        >
          Retour au dashboard
        </button>
      </div>

      {/* Status filters */}
      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              statusFilter === s
                ? 'bg-stone-950 text-white'
                : 'border border-stone-300 text-stone-600 hover:bg-white'
            }`}
          >
            {s === 'all' ? 'Tous' : QUOTE_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {error && (
        <Alert variant="error" className="mt-6">
          {error}
        </Alert>
      )}

      {loading && (
        <div className="mt-6 space-y-4">
          <Skeleton className="h-28 rounded-[2rem]" />
          <Skeleton className="h-28 rounded-[2rem]" />
          <Skeleton className="h-28 rounded-[2rem]" />
        </div>
      )}

      {!loading && quotes.length === 0 && (
        <div className="mt-6 rounded-[2rem] border-2 border-dashed border-stone-300 bg-white/60 p-12 text-center">
          <h2 className="text-2xl font-semibold text-stone-950">
            Aucun devis
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            Créez votre premier devis depuis un projet avec une estimation.
          </p>
        </div>
      )}

      {!loading && quotes.length > 0 && (
        <div className="mt-6 space-y-4">
          {quotes.map((quote) => (
            <Link
              key={quote.id}
              href={`/quotes/${quote.id}`}
              className="block rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)] transition-all hover:border-stone-300 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-stone-950">
                    {quote.quote_number}
                  </span>
                  <QuoteStatusBadge status={quote.status} />
                </div>
                <span className="text-sm text-stone-500">
                  {formatDate(quote.created_at)}
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-6 text-sm text-stone-600">
                {quote.client && (
                  <span>Client : {quote.client.name}</span>
                )}
                {quote.project && (
                  <span>Projet : {quote.project.name}</span>
                )}
                <span className="font-semibold text-stone-900">
                  {formatPrice(Number(quote.total_ttc))} EUR TTC
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
