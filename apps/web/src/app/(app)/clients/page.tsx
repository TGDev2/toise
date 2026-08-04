'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGates } from '@/contexts/FeatureGateContext';
import { apiGet } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { Client } from '@/lib/quote-types';
import { Alert, Input, LinkButton, Skeleton } from '@/components/ui';

export default function ClientsListPage() {
  const { appUser, isLoading } = useAuth();
  const { isFeatureAllowed, showPaywall } = useFeatureGates();
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!appUser) {
      router.push('/login');
      return;
    }
    if (!isFeatureAllowed('client_management')) {
      showPaywall('client_management');
    }
  }, [appUser, isLoading, isFeatureAllowed, showPaywall, router]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet<Client[]>('/clients');
      setClients(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de charger les clients'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (appUser) fetchClients();
  }, [appUser, fetchClients]);

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((c) =>
      [c.name, c.email, c.city]
        .filter((v): v is string => Boolean(v))
        .some((v) => v.toLowerCase().includes(term)),
    );
  }, [clients, search]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
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
            Mes clients
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

      {/* Search */}
      <div className="mt-6 max-w-sm">
        <Input
          type="search"
          placeholder="Rechercher un client (nom, email, ville)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Rechercher un client"
        />
      </div>

      {error && (
        <Alert variant="error" className="mt-6">
          {error}
        </Alert>
      )}

      {loading && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-24 rounded-[2rem]" />
          <Skeleton className="h-24 rounded-[2rem]" />
          <Skeleton className="h-24 rounded-[2rem]" />
        </div>
      )}

      {!loading && clients.length === 0 && (
        <div className="mt-6 rounded-[2rem] border-2 border-dashed border-stone-300 bg-white/60 p-12 text-center">
          <h2 className="text-2xl font-semibold text-stone-950">
            Aucun client
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            Vos clients apparaissent ici dès que vous en créez un depuis un
            devis.
          </p>
          <LinkButton href="/dashboard" className="mt-6">
            Aller au tableau de bord
          </LinkButton>
        </div>
      )}

      {!loading && clients.length > 0 && filteredClients.length === 0 && (
        <div className="mt-6 rounded-[2rem] border-2 border-dashed border-stone-300 bg-white/60 p-12 text-center">
          <h2 className="text-xl font-semibold text-stone-950">
            Aucun résultat
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            Aucun client ne correspond à « {search} ».
          </p>
        </div>
      )}

      {!loading && filteredClients.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="block rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)] transition-all hover:border-stone-300 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-stone-950">
                  {client.name}
                </span>
                {client.is_company && (
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                    Professionnel
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-col gap-1 text-sm text-stone-600">
                {client.city && <span>{client.city}</span>}
                {client.email && <span>{client.email}</span>}
                {client.phone && <span>{client.phone}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
