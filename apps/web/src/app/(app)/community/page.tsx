'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { PaginatedCommunityProjects } from '@/lib/community-types';
import { CommunityGalleryGrid } from '@/components/community/CommunityGalleryGrid';
import { CommunityWorkTypeFilter } from '@/components/community/CommunityWorkTypeFilter';

export default function CommunityGalleryPage() {
  const [projects, setProjects] = useState<PaginatedCommunityProjects | null>(
    null,
  );
  const [workType, setWorkType] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProjects = useCallback(
    async (targetPage: number, filterType: string | null) => {
      setLoading(true);
      setError('');
      try {
        let url = `/community?page=${targetPage}&limit=12`;
        if (filterType) {
          url += `&work_type=${filterType}`;
        }
        const result = await apiGet<PaginatedCommunityProjects>(url);
        setProjects(result);
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Impossible de charger la galerie'));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchProjects(page, workType);
  }, [page, workType, fetchProjects]);

  const handleWorkTypeChange = (type: string | null) => {
    setWorkType(type);
    setPage(1);
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-[2rem] border border-stone-200 bg-[var(--surface)] p-6 shadow-[0_25px_80px_rgba(67,39,15,0.10)] lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            Communauté
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">
            Galerie des projets terminés
          </h1>
          <p className="mt-3 text-sm text-stone-500">
            Decouvrez les realisations de la communauté et inspirez-vous pour
            vos prochains travaux.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="shrink-0 rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white"
        >
          Retour au dashboard
        </Link>
      </div>

      {/* Filters */}
      <div className="mt-6">
        <CommunityWorkTypeFilter
          selected={workType}
          onChange={handleWorkTypeChange}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-6 flex justify-center">
          <p className="text-sm text-stone-500">Chargement...</p>
        </div>
      )}

      {/* Grid */}
      {!loading && projects && (
        <>
          <div className="mt-6">
            <CommunityGalleryGrid projects={projects.data} />
          </div>

          {/* Pagination */}
          {projects.meta.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                &larr; Précédent
              </button>
              <span className="text-sm text-stone-600">
                Page {projects.meta.page} / {projects.meta.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= projects.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Suivant &rarr;
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
