'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPost, apiPatch, apiDelete, apiShareOrDownload } from '@/lib/api';
import { getErrorMessage, errorHasCode } from '@/lib/errors';
import { QuoteStatusBadge } from '@/components/quotes/QuoteStatusBadge';
import { MissingLegalMentionsAlert } from '@/components/invoices/MissingLegalMentionsAlert';
import {
  Alert,
  Button,
  ConfirmDialog,
  Skeleton,
  StickyActionBar,
  useToast,
} from '@/components/ui';
import type { Quote, QuoteStatus } from '@/lib/quote-types';
import type { Invoice } from '@/lib/invoice-types';

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
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const quoteId = params.id;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoicing, setInvoicing] = useState(false);
  const [missingMentions, setMissingMentions] = useState<string[] | null>(null);

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

  // Un devis accepté est facturable : on regarde s'il l'est déjà pour choisir
  // entre « Créer la facture » et un lien vers la facture existante.
  useEffect(() => {
    if (!appUser || quote?.status !== 'accepted') return;
    apiGet<Invoice[]>(`/invoices?quote_id=${quoteId}`)
      .then((list) => setInvoice(list[0] ?? null))
      .catch(() => setInvoice(null));
  }, [appUser, quote?.status, quoteId]);

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

  const handleCreateInvoice = async () => {
    setInvoicing(true);
    setError('');
    setMissingMentions(null);
    try {
      const created = await apiPost<Invoice>('/invoices', {
        quote_id: quoteId,
      });
      router.push(`/invoices/${created.id}`);
    } catch (err: unknown) {
      // Une facture existe déjà (409) : on y emmène plutôt que d'afficher une erreur.
      if (errorHasCode(err, 'INVOICE_ALREADY_EXISTS')) {
        const existingId = (err as { details: { invoice_id?: string } }).details
          .invoice_id;
        if (existingId) {
          router.push(`/invoices/${existingId}`);
          return;
        }
      }
      if (errorHasCode(err, 'MISSING_LEGAL_MENTIONS')) {
        const fields = (err as { details: { missing_fields?: string[] } })
          .details.missing_fields;
        setMissingMentions(fields ?? []);
        return;
      }
      setError(getErrorMessage(err, 'Impossible de créer la facture'));
    } finally {
      setInvoicing(false);
    }
  };

  /**
   * L'action de fin de parcours (PRO-5) : sur mobile, la feuille de partage
   * native envoie le PDF au client sans quitter l'app ; ailleurs, on retombe
   * sur le téléchargement historique.
   */
  const handleSendPdf = async () => {
    if (!quote) return;
    setDownloading(true);
    try {
      const outcome = await apiShareOrDownload(
        `/quotes/${quoteId}/export/pdf`,
        `devis-${quote.quote_number}.pdf`,
        {
          title: `Devis ${quote.quote_number}`,
          text: `Votre devis ${quote.quote_number}${
            quote.project ? ` — ${quote.project.name}` : ''
          }.`,
        },
      );
      if (outcome === 'shared') {
        toast.success('Devis envoyé.');
        /*
          E4-4 — le parcours « jusqu'au devis envoyé » n'atteignait jamais
          l'état « envoyé » : le PDF partait, le devis restait en brouillon, et
          `sent_at` — qui arme les relances J+7 et J+14 vers le client — restait
          nul. Bascule sur `'shared'` seulement : l'artisan a choisi une
          application destinataire (une feuille de partage fermée renvoie
          `'cancelled'`), alors qu'un téléchargement n'est pas un envoi. Le
          statut reste réversible d'un tap juste au-dessus.
        */
        if (quote.status === 'draft') {
          try {
            const updated = await apiPatch<Quote>(`/quotes/${quoteId}/status`, {
              status: 'sent',
            });
            setQuote(updated);
          } catch {
            // Le PDF est parti : un échec de mise à jour du statut ne doit pas
            // se lire comme un échec d'envoi.
          }
        }
      } else if (outcome === 'downloaded') {
        toast.info('PDF téléchargé.');
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de générer le PDF'));
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
        <div className="hidden flex-wrap gap-3 lg:flex">
          <Button onClick={handleSendPdf} loading={downloading}>
            Envoyer le devis
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

      {/*
        Statuts : quatre boutons de 36 px se répartissaient sur trois lignes à
        390 px, « Accepté » (vert) et « Refusé » (rouge) côte à côte. Un devis
        marqué refusé par erreur, c'est une relance PRO-3 perdue et un historique
        faux. Grille 2 colonnes, cibles à 44 px, « Supprimer » sur sa propre
        ligne, à distance des changements de statut.
      */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        {STATUS_ACTIONS.filter((a) => a.status !== quote.status).map((a) => (
          <button
            key={a.status}
            type="button"
            disabled={actionLoading}
            onClick={() => handleStatusChange(a.status)}
            className={`inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold ${a.color} disabled:opacity-60`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {quote.status === 'draft' && (
        <div className="mt-3">
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            Supprimer
          </button>
        </div>
      )}

      {/* Facturation — PRO-4 */}
      {quote.status === 'accepted' && (
        <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <h2 className="text-lg font-semibold text-stone-950">Facturation</h2>
          {invoice ? (
            <>
              <p className="mt-3 text-sm text-stone-600">
                Ce devis a été facturé sous le numéro{' '}
                <span className="font-semibold text-stone-900">
                  {invoice.invoice_number}
                </span>
                .
              </p>
              <Button
                className="mt-4"
                variant="secondary"
                onClick={() => router.push(`/invoices/${invoice.id}`)}
              >
                Voir la facture
              </Button>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-stone-600">
                Transformez ce devis accepté en facture conforme, numérotée
                automatiquement. Une facture émise ne peut plus être modifiée.
              </p>
              {missingMentions && (
                <div className="mt-4">
                  <MissingLegalMentionsAlert missingFields={missingMentions} />
                </div>
              )}
              <Button
                className="mt-4"
                onClick={handleCreateInvoice}
                loading={invoicing}
              >
                Créer la facture
              </Button>
            </>
          )}
        </section>
      )}

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

      {/* Materials — E1-11 : optionnel, désactivé par défaut. Détailler les
          fournitures ligne à ligne expose la marge de l'artisan. */}
      {quote.show_material_details && (
        <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <h2 className="text-lg font-semibold text-stone-950">
            Détail des matériaux
          </h2>
          {/* `w-full` seul annulait l'`overflow-x-auto` : la table se comprimait
              dans 358 px au lieu de déborder, chaque ligne partant sur trois ou
              quatre retours. `min-w-` rend le scroll horizontal effectif. */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
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
                      {quote.show_material_justifications &&
                        item.justification_fr && (
                          <p className="mt-1 text-xs text-stone-400">
                            {item.justification_fr}
                            {item.justification_url && (
                              <>
                                {' '}
                                <a
                                  href={item.justification_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-sky-700 hover:underline"
                                >
                                  Voir la fiche
                                </a>
                              </>
                            )}
                          </p>
                        )}
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
      )}

      {/* Labor */}
      <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <h2 className="text-lg font-semibold text-stone-950">
          Main-d&apos;œuvre
        </h2>
        {quote.labor_items_json?.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                  <th className="pb-2 pr-4">Ouvrage</th>
                  <th className="pb-2 pr-4 text-center">Qté</th>
                  <th className="pb-2 pr-4 text-right">PU HT</th>
                  <th className="pb-2 text-right">Total HT</th>
                </tr>
              </thead>
              <tbody>
                {quote.labor_items_json.map((line, i) => (
                  <tr key={i} className="border-b border-stone-100">
                    <td className="py-2 pr-4 text-stone-800">
                      {line.label}
                      {line.room_name && (
                        <span className="ml-2 text-xs text-stone-400">
                          {line.room_name}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-center font-medium">
                      {line.kind === 'hourly' ? `${line.quantity} h` : 'Forfait'}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {formatPrice(line.unit_price_ht)} EUR
                      {line.kind === 'hourly' ? '/h' : ''}
                    </td>
                    <td className="py-2 text-right font-semibold">
                      {formatPrice(line.line_total_ht)} EUR
                    </td>
                  </tr>
                ))}
                {quote.show_material_details && (
                  <tr>
                    <td colSpan={3} className="pt-3 text-right text-stone-600">
                      Sous-total main d&apos;œuvre HT
                    </td>
                    <td className="pt-3 text-right font-semibold">
                      {formatPrice(Number(quote.subtotal_labor_ht))} EUR
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-stone-500">
            Aucune main-d&apos;œuvre chiffrée.
          </p>
        )}
      </section>

      {/* Totals */}
      <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <h2 className="text-lg font-semibold text-stone-950">Totaux</h2>
        <div className="mt-4 space-y-2 text-sm">
          {quote.show_material_details && (
            <>
              <div className="flex justify-between">
                <span className="text-stone-600">Sous-total matériaux HT</span>
                <span className="font-medium">
                  {formatPrice(Number(quote.subtotal_materials_ht))} EUR
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">
                  Sous-total main-d&apos;œuvre HT
                </span>
                <span className="font-medium">
                  {formatPrice(Number(quote.subtotal_labor_ht))} EUR
                </span>
              </div>
            </>
          )}
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
          {quote.reminder_7d_sent_at && (
            <p>Relance J+7 envoyée le {formatDate(quote.reminder_7d_sent_at)}</p>
          )}
          {quote.reminder_14d_sent_at && (
            <p>Relance J+14 envoyée le {formatDate(quote.reminder_14d_sent_at)}</p>
          )}
          <p className="text-xs text-stone-400">
            Marge matériaux : {Number(quote.material_margin_percent)} % |
            Validité : {quote.validity_days} jours
          </p>
        </div>
      </section>

      {/*
        Fin du tunnel. La page fait ~3000 px sur mobile (neuf sections) et
        l'envoi n'était accessible que par le bouton du header, donc seulement
        tout en haut. C'est pourtant l'action qui clôt le « devis-minute » :
        elle reste sous le pouce du début à la fin.
      */}
      <StickyActionBar
        summary={
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-stone-600">Total TTC</span>
            <span className="text-lg font-bold text-stone-950">
              {formatPrice(quote.total_ttc)} EUR
            </span>
          </div>
        }
        className="lg:hidden"
      >
        <Button onClick={handleSendPdf} loading={downloading}>
          Envoyer le devis
        </Button>
      </StickyActionBar>

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
