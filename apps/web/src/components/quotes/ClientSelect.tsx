'use client';

import { useState } from 'react';
import { apiPost } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { Client, CreateClientPayload } from '@/lib/quote-types';

interface ClientSelectProps {
  clients: Client[];
  selectedId: string;
  onChange: (id: string) => void;
  onClientCreated: (client: Client) => void;
}

export function ClientSelect({
  clients,
  selectedId,
  onChange,
  onClientCreated,
}: ClientSelectProps) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<CreateClientPayload>({
    name: '',
    email: '',
    phone: '',
    address_line1: '',
    postal_code: '',
    city: '',
    is_company: false,
    siret: '',
    vat_number: '',
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const client = await apiPost<Client>('/clients', {
        name: form.name.trim(),
        email: form.email?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        address_line1: form.address_line1?.trim() || undefined,
        postal_code: form.postal_code?.trim() || undefined,
        city: form.city?.trim() || undefined,
        is_company: form.is_company ?? false,
        // Réservés aux clients professionnels : le SIREN acheteur devient une
        // mention obligatoire sur les factures B2B au 1er septembre 2026.
        ...(form.is_company && form.siret?.trim()
          ? { siret: form.siret.trim() }
          : {}),
        ...(form.is_company && form.vat_number?.trim()
          ? { vat_number: form.vat_number.trim() }
          : {}),
      });
      onClientCreated(client);
      onChange(client.id);
      setShowNewForm(false);
      setForm({
        name: '',
        email: '',
        phone: '',
        address_line1: '',
        postal_code: '',
        city: '',
        is_company: false,
        siret: '',
        vat_number: '',
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de créer le client'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <label className="flex-1 space-y-2">
          <span className="text-sm font-medium text-stone-700">Client</span>
          <select
            value={selectedId}
            onChange={(e) => onChange(e.target.value)}
            className="w-full min-h-12 rounded-2xl border border-stone-300 px-4 py-3 text-base sm:text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            <option value="">-- Sans client --</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.city ? ` (${c.city})` : ''}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setShowNewForm((v) => !v)}
          className="shrink-0 rounded-full border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white"
        >
          {showNewForm ? 'Annuler' : '+ Nouveau client'}
        </button>
      </div>

      {showNewForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-3"
        >
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-stone-600">
                Nom *
              </span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-stone-600">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-stone-600">
                Telephone
              </span>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-stone-600">
                Adresse
              </span>
              <input
                value={form.address_line1}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address_line1: e.target.value }))
                }
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-stone-600">
                Code postal
              </span>
              <input
                value={form.postal_code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, postal_code: e.target.value }))
                }
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-stone-600">Ville</span>
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-stone-600">
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
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-stone-600">
                  SIRET
                </span>
                <input
                  value={form.siret ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      siret: e.target.value.replace(/\D/g, '').slice(0, 14),
                    }))
                  }
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-stone-600">
                  N° de TVA
                </span>
                <input
                  value={form.vat_number ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      vat_number: e.target.value.toUpperCase(),
                    }))
                  }
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                />
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={creating}
            className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-stone-800 disabled:opacity-60"
          >
            {creating ? 'Creation...' : 'Créer le client'}
          </button>
        </form>
      )}
    </div>
  );
}
