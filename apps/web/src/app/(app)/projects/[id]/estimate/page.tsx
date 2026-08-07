'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGates } from '@/contexts/FeatureGateContext';
import { apiGet, apiPost } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { EstimationResponse } from '@/lib/estimation-types';
import { EstimationResults } from '@/components/estimation/EstimationResults';
import { EstimationSummary } from '@/components/estimation/EstimationSummary';
import { SkillLevelSelector } from '@/components/estimation/SkillLevelSelector';
import { FlowProgress } from '@/components/quote-flow/FlowProgress';
import { Alert, Skeleton, StickyActionBar } from '@/components/ui';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function EstimatePage() {
  const { appUser, isGuest, isLoading } = useAuth();
  const { isFeatureAllowed } = useFeatureGates();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  // Même clé que la gate serveur portée par `QuotesController` : le libellé de
  // l'étape suivante s'aligne sur ce que l'utilisateur pourra réellement faire.
  const canQuote = isFeatureAllowed('export_devis');

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
    // Même garde que `dimensions` et `work-selection` (E2-1). Tester `!appUser`
    // seul éjectait vers `/login`, sans un mot, l'invité qui venait de saisir
    // ses dimensions et de choisir ses travaux — une seconde avant son
    // résultat, c'est-à-dire au seul endroit du parcours où il a déjà tout
    // donné et n'a encore rien reçu. En cas d'échec API, l'écran affiche
    // désormais l'erreur au lieu de disparaître.
    if (!appUser && !isGuest) {
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
  }, [appUser, isGuest, isLoading, projectId, router]);

  const handleSkillChange = useCallback(
    (level: string) => {
      setSkillLevel(level);
      runEstimation(level);
    },
    [runEstimation],
  );

  if (isLoading || !loaded) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-96 rounded-[2rem]" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <FlowProgress
        step="estimate"
        projectId={projectId}
        projectName={projectName}
      />

      <h1 className="mb-6 text-2xl font-semibold text-stone-950 sm:text-3xl">
        Estimation des matériaux
      </h1>

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      <section className="mb-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <label className="mb-3 block text-sm font-medium text-stone-700">
          Niveau de compétence
        </label>
        <SkillLevelSelector
          value={skillLevel}
          onChange={handleSkillChange}
          disabled={isCalculating}
        />
        <p className="mt-2 text-xs text-stone-400">
          Changer le niveau recalcule automatiquement les quantités avec les
          facteurs de perte adaptés.
        </p>
      </section>

      {estimation && (
        <EstimationSummary items={estimation.items} />
      )}

      <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        {isCalculating && !estimation ? (
          <p className="py-8 text-center text-stone-400">Calcul en cours...</p>
        ) : estimation ? (
          <>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-900">
                Matériaux nécessaires
              </h2>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">
                {estimation.total_items} matériau{estimation.total_items > 1 ? 'x' : ''}
              </span>
            </div>
            <EstimationResults
              items={estimation.items}
              exclusions={estimation.exclusions_json}
            />
          </>
        ) : null}
      </section>

      {estimation && (
        /*
          Le CTA était centré sous la liste complète des matériaux — soit hors
          écran dès une dizaine de lignes, alors que c'est l'unique sortie de
          l'étape. Le libellé dit maintenant où mène la suite : pour un artisan
          l'étape « Prix » n'est pas une liste de courses, c'est le chiffrage qui
          conditionne son devis.
        */
        <StickyActionBar>
          <button
            type="button"
            onClick={() => router.push(`/projects/${projectId}/shopping-list`)}
            className="inline-flex min-h-12 items-center justify-center rounded-3xl bg-stone-950 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-stone-800"
          >
            {canQuote ? 'Chiffrer les matériaux' : 'Voir la liste de courses'}
          </button>
        </StickyActionBar>
      )}
    </main>
  );
}
