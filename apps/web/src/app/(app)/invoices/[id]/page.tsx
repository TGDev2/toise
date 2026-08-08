'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPatch, apiDownload } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { InvoiceStatusBadge } from '@/components/invoices/InvoiceStatusBadge';
import { Alert, Button, Skeleton } from '@/components/ui';
import type { Invoice, InvoicePartySnapshot } from '@/lib/invoice-types';
import { INVOICE_LINE_KIND_LABELS } from '@/lib/invoice-types';

const OPERATION_LABELS: Record<string, string> = {
  biens: 'Livraisons de biens',
  services: 'Prestations de services',
  mixte: 'Livraisons de biens et prestations de services',
};

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

function PartyBlock({
  title,
  party,
}: {
  title: string;
  party: InvoicePartySnapshot;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
        {title}
      </h3>
      <div className="mt-2 space-y-1 text-sm text-stone-700">
        <p className="font-medium text-stone-900">{party.name}</p>
        {party.address_line1 && <p>{party.address_line1}</p>}
        {party.address_line2 && <p>{party.address_line2}</p>}
        {(party.postal_code || party.city) && (
          <p>
            {party.postal_code} {party.city}
          </p>
        )}
        {party.email && <p>{party.email}</p>}
        {party.siret && <p>SIRET : {party.siret}</p>}
        {party.vat_exempt ? (
          <p className="text-stone-500">
            TVA non applicable, art. 293 B du CGI
          </p>
        ) : (
          party.vat_number && <p>TVA : {party.vat_number}</p>
        )}
        {party.rcs_city && (
          <p>
            RCS {party.rcs_city} {party.siren}
          </p>
        )}
        {party.rm_department && (
          <p>
            Répertoire des métiers : {party.siren} RM {party.rm_department}
          </p>
        )}
        {party.insurance_name && (
          <p className="text-stone-500">
            Assurance décennale : {party.insurance_name}
            {party.insurance_coverage ? ` — ${party.insurance_coverage}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

export default function InvoiceDetailPage() {
  const { appUser, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const invoiceId = params.id;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!isLoading && !appUser) {
      router.push('/login');
    }
  }, [appUser, isLoading, router]);

  const fetchInvoice = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet<Invoice>(`/invoices/${invoiceId}`);
      setInvoice(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de charger la facture'));
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    if (appUser) fetchInvoice();
  }, [appUser, fetchInvoice]);

  const handleStatusChange = async (status: 'issued' | 'paid') => {
    setActionLoading(true);
    setError('');
    try {
      const updated = await apiPatch<Invoice>(
        `/invoices/${invoiceId}/status`,
        { status },
      );
      setInvoice(updated);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de mettre à jour la facture'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    setDownloading(true);
    try {
      await apiDownload(
        `/invoices/${invoiceId}/export/pdf`,
        `facture-${invoice.invoice_number}.pdf`,
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de télécharger le PDF'));
    } finally {
      setDownloading(false);
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

  if (!invoice) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Alert variant="error">{error || 'Facture non trouvée'}</Alert>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => router.push('/invoices')}
        >
          Retour aux factures
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-stone-200 bg-[var(--surface)] p-6 shadow-[0_25px_80px_rgba(67,39,15,0.10)] lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            Facture
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">
            {invoice.invoice_number}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <InvoiceStatusBadge status={invoice.status} />
            <span className="text-sm text-stone-500">
              Émise le {formatDate(invoice.issued_on)}
            </span>
          </div>
          {invoice.source_quote_number && (
            <p className="mt-2 text-sm text-stone-600">
              Devis d&apos;origine : {invoice.source_quote_number}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleDownloadPdf} loading={downloading}>
            Télécharger PDF
          </Button>
          <Button variant="secondary" onClick={() => router.push('/invoices')}>
            Retour aux factures
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error" className="mt-6">
          {error}
        </Alert>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {invoice.status === 'issued' ? (
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => handleStatusChange('paid')}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Marquer payée
          </button>
        ) : (
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => handleStatusChange('issued')}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-white disabled:opacity-60"
          >
            Annuler le règlement
          </button>
        )}
      </div>

      {/* Parties — figées à l'émission */}
      <section className="mt-6 grid gap-8 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)] sm:grid-cols-2">
        <PartyBlock title="Émetteur" party={invoice.seller_snapshot} />
        <PartyBlock title="Facturé à" party={invoice.buyer_snapshot} />
      </section>

      {/* Mentions de la facture */}
      <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <h2 className="text-lg font-semibold text-stone-950">Informations</h2>
        <div className="mt-3 space-y-1 text-sm text-stone-700">
          <p>Date d&apos;émission : {formatDate(invoice.issued_on)}</p>
          {invoice.supply_date && (
            <p>Date de la prestation : {formatDate(invoice.supply_date)}</p>
          )}
          <p>Échéance de paiement : {formatDate(invoice.due_on)}</p>
          <p>
            Nature de l&apos;opération :{' '}
            {OPERATION_LABELS[invoice.operation_category] ??
              invoice.operation_category}
          </p>
          {invoice.buyer_siren && <p>SIREN client : {invoice.buyer_siren}</p>}
          {invoice.delivery_address && (
            <p>Adresse de livraison : {invoice.delivery_address}</p>
          )}
          {invoice.vat_on_debits && (
            <p>Option pour le paiement de la taxe d&apos;après les débits</p>
          )}
          {invoice.paid_at && <p>Réglée le {formatDate(invoice.paid_at)}</p>}
        </div>
      </section>

      {/* Lignes */}
      <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <h2 className="text-lg font-semibold text-stone-950">
          Détail des prestations
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                <th className="pb-2 pr-4">Désignation</th>
                <th className="pb-2 pr-4 text-center">Qté</th>
                <th className="pb-2 pr-4 text-right">PU HT</th>
                <th className="pb-2 pr-4 text-right">TVA</th>
                <th className="pb-2 text-right">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items_json.map((item, i) => (
                <tr key={i} className="border-b border-stone-100">
                  <td className="py-2 pr-4 text-stone-800">
                    {item.label}
                    <span className="ml-2 text-xs text-stone-400">
                      {INVOICE_LINE_KIND_LABELS[item.kind]}
                    </span>
                    {/*
                      E2-2 — le detail figé à l'émission (« 5 h x 45 EUR/h »,
                      « Forfait »). Il était déjà écrit dans `items_json` et
                      imprimé sur le PDF, mais cet écran ne le montrait pas :
                      une facture à plusieurs ouvrages y perdait exactement ce
                      qui la rend lisible.
                    */}
                    {item.description && (
                      <p className="mt-0.5 text-xs text-stone-400">
                        {item.description}
                      </p>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-center font-medium">
                    {item.quantity}
                    {item.unit ? ` ${item.unit}` : ''}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {formatPrice(item.unit_price_ht)} EUR
                  </td>
                  <td className="py-2 pr-4 text-right text-stone-500">
                    {item.tva_rate} %
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

      {/* Totaux */}
      <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <h2 className="text-lg font-semibold text-stone-950">Totaux</h2>
        <div className="mt-4 space-y-2 text-sm">
          {invoice.vat_breakdown.map((entry, i) => (
            <div key={i} className="flex justify-between text-stone-500">
              {entry.exemption_reason ? (
                <span>{entry.exemption_reason}</span>
              ) : (
                <>
                  <span>
                    Base HT à {entry.rate} % : {formatPrice(entry.base_ht)} EUR
                  </span>
                  <span>{formatPrice(entry.tva_amount)} EUR</span>
                </>
              )}
            </div>
          ))}
          <div className="flex justify-between border-t border-stone-200 pt-2 font-semibold">
            <span>Total HT</span>
            <span>{formatPrice(Number(invoice.total_ht))} EUR</span>
          </div>
          <div className="flex justify-between text-stone-500">
            <span>Total TVA</span>
            <span>{formatPrice(Number(invoice.total_tva))} EUR</span>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-2 text-lg font-bold text-stone-950">
            <span>Net à payer TTC</span>
            <span>{formatPrice(Number(invoice.total_ttc))} EUR</span>
          </div>
        </div>
      </section>

      {/* Règlement */}
      <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <h2 className="text-lg font-semibold text-stone-950">Règlement</h2>
        <div className="mt-3 space-y-2 text-sm text-stone-700">
          {invoice.payment_terms && (
            <p className="whitespace-pre-line">{invoice.payment_terms}</p>
          )}
          {invoice.seller_snapshot.iban && (
            <p>
              IBAN : {invoice.seller_snapshot.iban}
              {invoice.seller_snapshot.bic
                ? ` — BIC : ${invoice.seller_snapshot.bic}`
                : ''}
            </p>
          )}
          {invoice.notes && (
            <p className="whitespace-pre-line">{invoice.notes}</p>
          )}
          <p className="pt-2 text-xs text-stone-400">
            {invoice.late_penalty_rate == null
              ? "Pénalités de retard au taux d'intérêt légal majoré de 10 points."
              : `Pénalités de retard au taux de ${Number(invoice.late_penalty_rate)} % l'an.`}{' '}
            Indemnité forfaitaire de recouvrement : 40 EUR. Escompte pour
            paiement anticipé : néant.
          </p>
        </div>
      </section>
    </main>
  );
}
