'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGates } from '@/contexts/FeatureGateContext';
import { apiGet } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { groupEntriesByRoom } from '@/lib/logbook-types';
import type { RoomLogEntry } from '@/lib/logbook-types';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function LogbookPage() {
  const { appUser, isLoading } = useAuth();
  const { isFeatureAllowed, showPaywall } = useFeatureGates();
  const router = useRouter();

  const [entries, setEntries] = useState<RoomLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!appUser) {
      router.push('/login');
      return;
    }
    if (!isFeatureAllowed('logbook')) {
      showPaywall('logbook');
    }
  }, [appUser, isLoading, isFeatureAllowed, showPaywall, router]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet<RoomLogEntry[]>('/logbook');
      setEntries(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de charger le carnet du logement'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (appUser) fetchEntries();
  }, [appUser, fetchEntries]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </main>
    );
  }

  const groups = groupEntriesByRoom(entries);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-stone-200 bg-[var(--surface)] p-6 shadow-[0_25px_80px_rgba(67,39,15,0.10)] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            Carnet du logement
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">
            Historique de vos pièces
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Dimensions et matériaux enregistrés à chaque chantier terminé.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white"
        >
          Retour au dashboard
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="mt-6 flex justify-center">
          <p className="text-sm text-stone-500">Chargement du carnet...</p>
        </div>
      )}

      {!loading && groups.length === 0 && (
        <div className="mt-6 rounded-[2rem] border-2 border-dashed border-stone-300 bg-white/60 p-12 text-center">
          <h2 className="text-2xl font-semibold text-stone-950">
            Carnet vide
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            Terminez un chantier (dimensions validées, prix réels saisis) pour
            commencer votre carnet du logement.
          </p>
        </div>
      )}

      {!loading && groups.length > 0 && (
        <div className="mt-6 space-y-8">
          {groups.map((group) => (
            <section key={group.room_name}>
              <h2 className="text-xl font-semibold text-stone-950">
                {group.room_name}
              </h2>
              <div className="mt-3 space-y-4">
                {group.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm font-semibold text-stone-900">
                        {entry.project_name}
                      </span>
                      <span className="text-sm text-stone-500">
                        {formatDate(entry.recorded_at)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-stone-600">
                      {entry.dimensions_snapshot.length_cm / 100} m ×{' '}
                      {entry.dimensions_snapshot.width_cm / 100} m ×{' '}
                      {entry.dimensions_snapshot.height_cm / 100} m
                    </p>
                    {entry.materials_snapshot.length > 0 && (
                      <ul className="mt-3 space-y-1 text-sm text-stone-600">
                        {entry.materials_snapshot.map((material) => (
                          <li key={material.material_id}>
                            {material.work_type_label} — {material.material_name}
                            {material.store_name && (
                              <span className="text-stone-400">
                                {' '}
                                ({material.store_name})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
