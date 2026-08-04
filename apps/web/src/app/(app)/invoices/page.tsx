'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGates } from '@/contexts/FeatureGateContext';
import { apiGet } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { InvoiceStatusBadge } from '@/components/invoices/InvoiceStatusBadge';
import type { Invoice, InvoiceStatus } from '@/lib/invoice-types';
import { INVOICE_STATUS_LABELS } from '@/lib/invoice-types';
import { Alert, Skeleton } from '@/components/ui';

const STATUS_FILTERS: (InvoiceStatus | 'all')[] = ['all', 'issued', 'paid'];

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

export default function InvoicesListPage() {
  const { appUser, isLoading } = useAuth();
  const { isFeatureAllowed, showPaywall } = useFeatureGates();
  const router = useRouter();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>(
    'all',
  );

  useEffect(() => {
    if (isLoading) return;
    if (!appUser) {
      router.push('/login');
      return;
    }
    if (!isFeatureAllowed('invoicing')) {
      showPaywall('invoicing');
    }
  }, [appUser, isLoading, isFeatureAllowed, showPaywall, router]);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const path =
        statusFilter === 'all'
          ? '/invoices'
          : `/invoices?status=${statusFilter}`;
      const data = await apiGet<Invoice[]>(path);
      setInvoices(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de charger les factures'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (appUser) fetchInvoices();
  }, [appUser, fetchInvoices]);

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
      <div className="flex flex-col gap-4 rounded-[2rem] border border-stone-200 bg-[var(--surface)] p-6 shadow-[0_25px_80px_rgba(67,39,15,0.10)] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            Espace professionnel
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">
            Mes factures
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
            {s === 'all' ? 'Toutes' : INVOICE_STATUS_LABELS[s]}
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

      {!loading && invoices.length === 0 && (
        <div className="mt-6 rounded-[2rem] border-2 border-dashed border-stone-300 bg-white/60 p-12 text-center">
          <h2 className="text-2xl font-semibold text-stone-950">
            Aucune facture
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            Une facture se crée depuis un devis accepté.
          </p>
          <Link
            href="/quotes?status=accepted"
            className="mt-5 inline-block rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-800"
          >
            Voir mes devis acceptés
          </Link>
        </div>
      )}

      {!loading && invoices.length > 0 && (
        <div className="mt-6 space-y-4">
          {invoices.map((invoice) => (
            <Link
              key={invoice.id}
              href={`/invoices/${invoice.id}`}
              className="block rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)] transition-all hover:border-stone-300 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-stone-950">
                    {invoice.invoice_number}
                  </span>
                  <InvoiceStatusBadge status={invoice.status} />
                </div>
                <span className="text-sm text-stone-500">
                  {formatDate(invoice.issued_on)}
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-1 text-sm text-stone-600 sm:flex-row sm:items-center sm:gap-6">
                <span>Client : {invoice.buyer_snapshot.name}</span>
                {invoice.source_quote_number && (
                  <span>Devis : {invoice.source_quote_number}</span>
                )}
                <span className="font-semibold text-stone-900">
                  {formatPrice(Number(invoice.total_ttc))} EUR TTC
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
