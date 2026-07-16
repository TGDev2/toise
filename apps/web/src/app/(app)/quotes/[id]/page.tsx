'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPatch, apiDelete, apiDownload } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { QuoteStatusBadge } from '@/components/quotes/QuoteStatusBadge';
import { Alert, Button, ConfirmDialog, Skeleton } from '@/components/ui';
import type { Quote, QuoteStatus } from '@/lib/quote-types';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function formatPrice(v: number): string {
  return Number(v).toFixed(2).replace('.', ',');
}

const STATUS_ACTIONS: { status: QuoteStatus; label: string; color: string }[] = [
  { status: 'sent', label: 'Marquer envoyé', color: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]' },
  { status: 'accepted', label: 'Accepté', color: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  { status: 'refused', label: 'Refusé', color: 'bg-red-600 text-white hover:bg-red-700' },
  { status: 'negotiation', label: 'En négociation', color: 'bg-amber-600 text-white hover:bg-amber-700' },
];

export default function QuoteDetailPage() {
  const { appUser, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const quoteId = params.id;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!isLoading && !appUser) {
      router.push('/login');
    }
  }, [appUser, isLoading, router]);

  const fetchQuote = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet<Quote>(`/quotes/${quoteId}`);
      setQuote(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de charger le devis'));
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    if (appUser) fetchQuote();
  }, [appUser, fetchQuote]);

  const handleStatusChange = async (status: QuoteStatus) => {
    setActionLoading(true);
    setError('');
    try {
      const updated = await apiPatch<Quote>(`/quotes/${quoteId}/status`, {
        status,
      });
      setQuote(updated);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de mettre à jour le statut'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!quote) return;
    setDownloading(true);
    try {
      await apiDownload(
        `/quotes/${quoteId}/export/pdf`,
        `devis-${quote.quote_number}.pdf`,
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de télécharger le PDF'));
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!quote) return;
    setActionLoading(true);
    try {
      await apiDelete(`/quotes/${quoteId}`);
      router.push('/quotes');
    } catch (err: unknown) {
      setShowDeleteConfirm(false);
      setError(getErrorMessage(err, 'Impossible de supprimer le devis'));
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading || loading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <Skeleton className="h-40 rounded-[2rem]" />
        <Skeleton className="mt-6 h-64 rounded-[2rem]" />
      </main>
    );
  }

  if (!quote) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Alert variant="error">{error || 'Devis non trouvé'}</Alert>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => router.push('/quotes')}
        >
          Retour aux devis
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-[2rem] border border-stone-200 bg-[var(--surface)] p-6 shadow-[0_25px_80px_rgba(67,39,15,0.10)] lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            Devis
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">
            {quote.quote_number}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <QuoteStatusBadge status={quote.status} />
            <span className="text-sm text-stone-500">
              {formatDate(quote.created_at)}
            </span>
          </div>
          {quote.project && (
            <p className="mt-2 text-sm text-stone-600">
              Projet : {quote.project.name}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleDownloadPdf} loading={downloading}>
            Télécharger PDF
          </Button>
          <Button variant="secondary" onClick={() => router.push('/quotes')}>
            Retour aux devis
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error" className="mt-6">
          {error}
        </Alert>
      )}

      {/* Status actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        {STATUS_ACTIONS.filter((a) => a.status !== quote.status).map((a) => (
          <button
            key={a.status}
            type="button"
            disabled={actionLoading}
            onClick={() => handleStatusChange(a.status)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${a.color} disabled:opacity-60`}
          >
            {a.label}
          </button>
        ))}
        {quote.status === 'draft' && (
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            Supprimer
          </button>
        )}
      </div>

      {/* Client info */}
      {quote.client && (
        <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <h2 className="text-lg font-semibold text-stone-950">Client</h2>
          <div className="mt-3 text-sm text-stone-700 space-y-1">
            <p className="font-medium">{quote.client.name}</p>
            {quote.client.address_line1 && <p>{quote.client.address_line1}</p>}
            {(quote.client.postal_code || quote.client.city) && (
              <p>
                {quote.client.postal_code} {quote.client.city}
              </p>
            )}
            {quote.client.email && <p>{quote.client.email}</p>}
            {quote.client.phone && <p>Tel : {quote.client.phone}</p>}
          </div>
        </section>
      )}

      {/* Materials */}
      <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <h2 className="text-lg font-semibold text-stone-950">
          Détail des matériaux
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                <th className="pb-2 pr-4">Désignation</th>
                <th className="pb-2 pr-4 text-center">Qté</th>
                <th className="pb-2 pr-4 text-right">PU HT</th>
                <th className="pb-2 text-right">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {quote.items_json.map((item, i) => (
                <tr
                  key={i}
                  className="border-b border-stone-100"
                >
                  <td className="py-2 pr-4 text-stone-800">
                    {item.material_name}
                    <span className="ml-2 text-xs text-stone-400">
                      {item.work_type_label}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-center font-medium">
                    {item.units_needed}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {formatPrice(item.unit_price_with_margin)} EUR
                  </td>
                  <td className="py-2 text-right font-semibold">
                    {formatPrice(item.line_total_ht)} EUR
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Labor */}
      <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <h2 className="text-lg font-semibold text-stone-950">
          Main d&apos;oeuvre
        </h2>
        <div className="mt-3 text-sm text-stone-700">
          {quote.labor_type === 'hourly' ? (
            <p>
              {Number(quote.labor_estimated_hours)} h x{' '}
              {formatPrice(Number(quote.labor_hourly_rate))} EUR/h ={' '}
              <span className="font-semibold">
                {formatPrice(Number(quote.subtotal_labor_ht))} EUR HT
              </span>
            </p>
          ) : (
            <p>
              Forfait :{' '}
              <span className="font-semibold">
                {formatPrice(Number(quote.subtotal_labor_ht))} EUR HT
              </span>
            </p>
          )}
        </div>
      </section>

      {/* Totals */}
      <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <h2 className="text-lg font-semibold text-stone-950">Totaux</h2>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-600">Sous-total matériaux HT</span>
            <span className="font-medium">
              {formatPrice(Number(quote.subtotal_materials_ht))} EUR
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-600">
              Sous-total main d&apos;oeuvre HT
            </span>
            <span className="font-medium">
              {formatPrice(Number(quote.subtotal_labor_ht))} EUR
            </span>
          </div>
          {Number(quote.discount_percent) > 0 && (
            <div className="flex justify-between text-amber-700">
              <span>Remise ({Number(quote.discount_percent)} %)</span>
              <span>
                -
                {formatPrice(
                  (Number(quote.subtotal_materials_ht) +
                    Number(quote.subtotal_labor_ht)) *
                    (Number(quote.discount_percent) / 100),
                )}{' '}
                EUR
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-stone-200 pt-2 font-semibold">
            <span>Total HT</span>
            <span>{formatPrice(Number(quote.total_ht))} EUR</span>
          </div>
          <div className="flex justify-between text-stone-500">
            <span>TVA ({Number(quote.tva_rate)} %)</span>
            <span>
              {formatPrice(Number(quote.total_ttc) - Number(quote.total_ht))}{' '}
              EUR
            </span>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-2 text-lg font-bold text-stone-950">
            <span>Total TTC</span>
            <span>{formatPrice(Number(quote.total_ttc))} EUR</span>
          </div>
        </div>
      </section>

      {/* Payment terms */}
      {quote.payment_terms && (
        <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <h2 className="text-lg font-semibold text-stone-950">
            Conditions de règlement
          </h2>
          <p className="mt-3 text-sm text-stone-700 whitespace-pre-line">
            {quote.payment_terms}
          </p>
        </section>
      )}

      {/* Notes */}
      {quote.notes && (
        <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <h2 className="text-lg font-semibold text-stone-950">Notes</h2>
          <p className="mt-3 text-sm text-stone-700 whitespace-pre-line">
            {quote.notes}
          </p>
        </section>
      )}

      {/* Timestamps */}
      <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <h2 className="text-lg font-semibold text-stone-950">Historique</h2>
        <div className="mt-3 space-y-1 text-sm text-stone-600">
          <p>Créé le {formatDate(quote.created_at)}</p>
          {quote.sent_at && <p>Envoyé le {formatDate(quote.sent_at)}</p>}
          {quote.accepted_at && (
            <p>Accepté le {formatDate(quote.accepted_at)}</p>
          )}
          {quote.refused_at && (
            <p>Refusé le {formatDate(quote.refused_at)}</p>
          )}
          <p className="text-xs text-stone-400">
            Marge matériaux : {Number(quote.material_margin_percent)} % |
            Validité : {quote.validity_days} jours
          </p>
        </div>
      </section>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Supprimer le devis"
        message="Ce devis brouillon sera supprimé définitivement."
        confirmLabel="Supprimer"
        destructive
        busy={actionLoading}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </main>
  );
}
