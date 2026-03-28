'use client';

import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPost } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { EstimationResponse } from '@/lib/estimation-types';
import { EstimationResults } from '@/components/estimation/EstimationResults';
import { SkillLevelSelector } from '@/components/estimation/SkillLevelSelector';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function EstimatePage() {
  const { appUser, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [estimation, setEstimation] = useState<EstimationResponse | null>(null);
  const [skillLevel, setSkillLevel] = useState('beginner');
  const [projectName, setProjectName] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const runEstimation = useCallback(
    async (level?: string) => {
      setError('');
      setIsCalculating(true);
      try {
        const body = level ? { skill_level: level } : {};
        const result = await apiPost<EstimationResponse>(
          `/projects/${projectId}/estimate`,
          body,
        );
        setEstimation(result);
        setSkillLevel(result.skill_level);
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Impossible de calculer l'estimation"));
      } finally {
        setIsCalculating(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (isLoading) return;
    if (!appUser) {
      router.push('/login');
      return;
    }

    async function load() {
      try {
        const project = await apiGet<{ name: string }>(
          `/projects/${projectId}`,
        );
        setProjectName(project.name);

        await runEstimation();
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Impossible de charger le projet'));
      } finally {
        setLoaded(true);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser, isLoading, projectId, router]);

  const handleSkillChange = useCallback(
    (level: string) => {
      setSkillLevel(level);
      runEstimation(level);
    },
    [runEstimation],
  );

  if (isLoading || !loaded) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.push(`/projects/${projectId}/work-selection`)}
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          &larr; Retour aux travaux
        </button>
        <h1 className="mt-2 text-3xl font-semibold text-stone-950">
          Estimation des materiaux
        </h1>
        {projectName && (
          <p className="mt-1 text-sm text-stone-500">{projectName}</p>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="mb-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <label className="mb-3 block text-sm font-medium text-stone-700">
          Niveau de competence
        </label>
        <SkillLevelSelector
          value={skillLevel}
          onChange={handleSkillChange}
          disabled={isCalculating}
        />
        <p className="mt-2 text-xs text-stone-400">
          Changer le niveau recalcule automatiquement les quantites avec les
          facteurs de perte adaptes.
        </p>
      </section>

      <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        {isCalculating && !estimation ? (
          <p className="py-8 text-center text-stone-400">Calcul en cours...</p>
        ) : estimation ? (
          <>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-900">
                Materiaux necessaires
              </h2>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">
                {estimation.total_items} materiau{estimation.total_items > 1 ? 'x' : ''}
              </span>
            </div>
            <EstimationResults items={estimation.items} />
          </>
        ) : null}
      </section>
    </main>
  );
}
