'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPatch, apiDelete } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { QuoteStatusBadge } from '@/components/quotes/QuoteStatusBadge';
import { Alert, Button, ConfirmDialog, Input, Skeleton, useToast } from '@/components/ui';
import type { Client, Quote, UpdateClientPayload } from '@/lib/quote-types';
import type { Invoice } from '@/lib/invoice-types';
import { INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS } from '@/lib/invoice-types';

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

const EMPTY_FORM: UpdateClientPayload = {
  name: '',
  email: '',
  phone: '',
  address_line1: '',
  address_line2: '',
  postal_code: '',
  city: '',
  country: 'FR',
  is_company: false,
  siret: '',
  vat_number: '',
};

export default function ClientDetailPage() {
  const { appUser, isLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [form, setForm] = useState<UpdateClientPayload>(EMPTY_FORM);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    if (!isLoading && !appUser) {
      router.push('/login');
    }
  }, [appUser, isLoading, router]);

  const fetchClient = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet<Client>(`/clients/${clientId}`);
      setClient(data);
      setForm({
        name: data.name,
        email: data.email ?? '',
        phone: data.phone ?? '',
        address_line1: data.address_line1 ?? '',
        address_line2: data.address_line2 ?? '',
        postal_code: data.postal_code ?? '',
        city: data.city ?? '',
        country: data.country,
        is_company: data.is_company,
        siret: data.siret ?? '',
        vat_number: data.vat_number ?? '',
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de charger le client'));
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (appUser) fetchClient();
  }, [appUser, fetchClient]);

  // Historique : ni /quotes ni /invoices n'exposent de filtre client_id
  // côté API, on filtre donc la liste de l'organisation en mémoire.
  useEffect(() => {
    if (!appUser) return;
    apiGet<Quote[]>('/quotes')
      .then((all) => setQuotes(all.filter((q) => q.client_id === clientId)))
      .catch(() => setQuotes([]));
    apiGet<Invoice[]>('/invoices')
      .then((all) => setInvoices(all.filter((inv) => inv.client_id === clientId)))
      .catch(() => setInvoices([]));
  }, [appUser, clientId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: UpdateClientPayload = {
        name: form.name?.trim(),
        email: form.email?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        address_line1: form.address_line1?.trim() || undefined,
        address_line2: form.address_line2?.trim() || undefined,
        postal_code: form.postal_code?.trim() || undefined,
        city: form.city?.trim() || undefined,
        country: form.country?.trim() || 'FR',
        is_company: form.is_company ?? false,
        siret: form.is_company ? form.siret?.trim() || null : null,
        vat_number: form.is_company ? form.vat_number?.trim() || null : null,
      };
      const updated = await apiPatch<Client>(`/clients/${clientId}`, payload);
      setClient(updated);
      toast.success('Client mis à jour.');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de mettre à jour le client'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiDelete(`/clients/${clientId}`);
      router.push('/clients');
    } catch (err: unknown) {
      setShowDeleteConfirm(false);
      setError(getErrorMessage(err, 'Impossible de supprimer le client'));
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading || loading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <Skeleton className="h-40 rounded-[2rem]" />
        <Skeleton className="mt-6 h-96 rounded-[2rem]" />
      </main>
    );
  }

  if (!client) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Alert variant="error">{error || 'Client non trouvé'}</Alert>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => router.push('/clients')}
        >
          Retour aux clients
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
            Client
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">
            {client.name}
          </h1>
        </div>
        <Button variant="secondary" onClick={() => router.push('/clients')}>
          Retour aux clients
        </Button>
      </div>

      {error && (
        <Alert variant="error" className="mt-6">
          {error}
        </Alert>
      )}

      {/* Edit form */}
      <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <h2 className="text-lg font-semibold text-stone-950">
          Coordonnées
        </h2>
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
          <Input
            label="Nom *"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            label="Téléphone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Input
            label="Pays"
            maxLength={2}
            value={form.country}
            onChange={(e) =>
              setForm((f) => ({ ...f, country: e.target.value.toUpperCase() }))
            }
          />
          <Input
            label="Adresse"
            value={form.address_line1}
            onChange={(e) =>
              setForm((f) => ({ ...f, address_line1: e.target.value }))
            }
          />
          <Input
            label="Complément d'adresse"
            value={form.address_line2}
            onChange={(e) =>
              setForm((f) => ({ ...f, address_line2: e.target.value }))
            }
          />
          <Input
            label="Code postal"
            value={form.postal_code}
            onChange={(e) =>
              setForm((f) => ({ ...f, postal_code: e.target.value }))
            }
          />
          <Input
            label="Ville"
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          />

          <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-stone-700 md:col-span-2">
            <input
              type="checkbox"
              checked={form.is_company ?? false}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_company: e.target.checked }))
              }
            />
            Client professionnel (entreprise)
          </label>

          {form.is_company && (
            <>
              <Input
                label="SIRET"
                value={form.siret ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    siret: e.target.value.replace(/\D/g, '').slice(0, 14),
                  }))
                }
              />
              <Input
                label="N° de TVA"
                value={form.vat_number ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    vat_number: e.target.value.toUpperCase(),
                  }))
                }
              />
            </>
          )}

          <div className="md:col-span-2">
            <Button type="submit" loading={saving}>
              Enregistrer
            </Button>
          </div>
        </form>
      </section>

      {/* Delete */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
        >
          Supprimer le client
        </button>
      </div>

      {/* Devis */}
      <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <h2 className="text-lg font-semibold text-stone-950">Devis</h2>
        {quotes.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">
            Aucun devis pour ce client.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {quotes.map((quote) => (
              <Link
                key={quote.id}
                href={`/quotes/${quote.id}`}
                className="flex flex-col gap-2 rounded-2xl border border-stone-200 p-4 transition-colors hover:border-stone-300 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-stone-900">
                    {quote.quote_number}
                  </span>
                  <QuoteStatusBadge status={quote.status} />
                </div>
                <div className="flex items-center gap-4 text-sm text-stone-600">
                  <span>{formatDate(quote.created_at)}</span>
                  <span className="font-semibold text-stone-900">
                    {formatPrice(Number(quote.total_ttc))} EUR TTC
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Factures */}
      <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <h2 className="text-lg font-semibold text-stone-950">Factures</h2>
        {invoices.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">
            Aucune facture pour ce client.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {invoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/invoices/${invoice.id}`}
                className="flex flex-col gap-2 rounded-2xl border border-stone-200 p-4 transition-colors hover:border-stone-300 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-stone-900">
                    {invoice.invoice_number}
                  </span>
                  <span
                    className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${INVOICE_STATUS_COLORS[invoice.status]}`}
                  >
                    {INVOICE_STATUS_LABELS[invoice.status]}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-stone-600">
                  <span>{formatDate(invoice.issued_on)}</span>
                  <span className="font-semibold text-stone-900">
                    {formatPrice(Number(invoice.total_ttc))} EUR TTC
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Supprimer le client"
        message="Ce client sera supprimé définitivement. Les devis et factures déjà émis restent inchangés."
        confirmLabel="Supprimer"
        destructive
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </main>
  );
}
