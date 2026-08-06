'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet, ApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { ProjectSummary } from '@/lib/project-types';
import type { BudgetSummary } from '@/lib/shopping-list-types';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGates } from '@/contexts/FeatureGateContext';
import { CommunityShareForm } from '@/components/community/CommunityShareForm';
import { Alert, Skeleton } from '@/components/ui';

interface PhotoResponse {
  id: string;
  url: string;
  thumbnail_url: string | null;
}

type ReadinessState = 'checking' | 'not_allowed' | 'not_finalized' | 'ready';

export default function ShareProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { appUser, isLoading: authLoading } = useAuth();
  const {
    isFeatureAllowed,
    isLoading: gatesLoading,
    showPaywall,
  } = useFeatureGates();
  const projectId = params.id as string;

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [photos, setPhotos] = useState<PhotoResponse[]>([]);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(
    null,
  );
  const [readiness, setReadiness] = useState<ReadinessState>('checking');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!authLoading && !appUser) {
      router.push('/login');
    }
  }, [appUser, authLoading, router]);

  const fetchData = useCallback(async () => {
    try {
      const [projectData, photosData] = await Promise.all([
        apiGet<ProjectSummary>(`/projects/${projectId}`),
        apiGet<PhotoResponse[]>(`/projects/${projectId}/photos`),
      ]);

      if (projectData.status !== 'completed') {
        setError('Seul un projet terminé peut être partagé dans la communauté.');
        return;
      }

      setProject(projectData);
      setPhotos(photosData);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de charger le projet'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (appUser) {
      fetchData();
    }
  }, [appUser, fetchData]);

  // COM-1 : le partage communaute exige une liste d'achats reelle finalisee
  // (prix reel par materiau). GET .../budget-summary recalcule toujours en
  // direct — is_finalized distingue « resume calculable maintenant » de
  // « reellement fige par finalize() » : regenerate() peut effacer le second
  // sans que le premier ne le signale (cf. ShoppingListsService).
  useEffect(() => {
    if (!project || gatesLoading) return;

    if (!isFeatureAllowed('budget_tracking')) {
      setReadiness('not_allowed');
      return;
    }

    let cancelled = false;
    apiGet<BudgetSummary>(
      `/projects/${projectId}/shopping-list/budget-summary`,
    )
      .then((summary) => {
        if (cancelled) return;
        if (summary.is_finalized === false) {
          setReadiness('not_finalized');
        } else {
          setBudgetSummary(summary);
          setReadiness('ready');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.details.statusCode === 404) {
          setReadiness('not_finalized');
        } else {
          setError(
            getErrorMessage(err, 'Impossible de charger le budget réel du projet'),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [project, gatesLoading, isFeatureAllowed, projectId]);

  if (authLoading || loading) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-64 rounded-[2rem]" />
      </main>
    );
  }

  if (success) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-8 w-8 text-emerald-600"
            >
              <path
                fillRule="evenodd"
                d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-emerald-900">
            Publication envoyée !
          </h2>
          <p className="mt-3 text-sm text-emerald-700">
            Votre projet a été soumis à notre équipe de modération. Il sera
            visible dans la galerie après validation, généralement sous 24 à 48
            heures.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/community"
              className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-emerald-700"
            >
              Voir la galerie
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white"
            >
              Retour au dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Alert variant="error">{error || 'Projet non trouve'}</Alert>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm text-stone-500 hover:text-stone-700"
        >
          &larr; Retour au dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      {/* Header */}
      <Link
        href={`/projects/${projectId}/estimate`}
        className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700"
      >
        &larr; Retour au projet
      </Link>

      <div className="mt-4 rounded-[2rem] border border-stone-200 bg-[var(--surface)] p-6 shadow-[0_25px_80px_rgba(67,39,15,0.10)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
          Partager dans la communauté
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-stone-950">
          {project.name}
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Partagez votre projet terminé avec la communauté. Les informations
          seront visibles publiquement après modération.
        </p>
      </div>

      {/* Readiness gate */}
      {readiness === 'checking' && (
        <div className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 text-sm text-stone-500 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          Vérification du budget réel du projet...
        </div>
      )}

      {readiness === 'not_allowed' && (
        <div className="mt-6 rounded-[2rem] border border-stone-200 bg-gradient-to-br from-stone-50 to-white p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <h2 className="text-lg font-semibold text-stone-900">
            Suivi budgétaire requis
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            Le partage communauté attache le coût réel de votre projet, tiré du
            suivi budgétaire. Passez à Pro pour y accéder.
          </p>
          <button
            type="button"
            onClick={() => showPaywall('budget_tracking')}
            className="mt-4 rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-800"
          >
            Passer à Pro
          </button>
        </div>
      )}

      {readiness === 'not_finalized' && (
        <div className="mt-6 rounded-[2rem] border border-amber-200 bg-amber-50 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <h2 className="text-lg font-semibold text-amber-900">
            Finalisez d&apos;abord votre budget réel
          </h2>
          <p className="mt-2 text-sm text-amber-800">
            Le partage communauté attache automatiquement votre liste d&apos;achats
            réelle (quantités et prix payés). Renseignez le prix réel de chaque
            article puis finalisez le budget de ce projet pour pouvoir le
            partager.
          </p>
          <Link
            href={`/projects/${projectId}/shopping-list`}
            className="mt-4 inline-block rounded-full bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-amber-700"
          >
            Aller à la liste d&apos;achats
          </Link>
        </div>
      )}

      {readiness === 'ready' && budgetSummary && (
        <div className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <CommunityShareForm
            projectId={projectId}
            photos={photos}
            budgetSummary={budgetSummary}
            onSuccess={() => setSuccess(true)}
          />
        </div>
      )}
    </main>
  );
}
