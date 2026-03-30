'use client';

import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { Opening } from '@/lib/surface';
import { DimensionsForm } from '@/components/dimensions/DimensionsForm';
import { AnalyzeButton } from '@/components/analysis/AnalyzeButton';
import { AnalysisResultPanel } from '@/components/analysis/AnalysisResultPanel';
import { ReferenceObjectPrompt } from '@/components/analysis/ReferenceObjectPrompt';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'estimate_local_projects';

interface DimensionsData {
  length_cm: number;
  width_cm: number;
  height_cm: number;
}

interface OpeningData {
  id: string;
  type: 'door' | 'window';
  width_cm: number;
  height_cm: number;
  count: number;
}

interface LocalProject {
  id: string;
  name: string;
  room_name: string;
  work_type: string;
  length_m?: number;
  width_m?: number;
  height_m?: number;
  openings?: Opening[];
  updated_at: string;
}

export default function DimensionsPage() {
  const { appUser, isGuest, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [initialDims, setInitialDims] = useState<DimensionsData | null>(null);
  const [initialOpenings, setInitialOpenings] = useState<Opening[]>([]);
  const [existingOpeningIds, setExistingOpeningIds] = useState<string[]>([]);
  const [projectName, setProjectName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [hasPhotos, setHasPhotos] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  const analysis = useAnalysis(projectId);

  useEffect(() => {
    if (isLoading) return;
    if (!appUser && !isGuest) {
      router.push('/login');
      return;
    }

    async function load() {
      try {
        if (appUser) {
          const project = await apiGet<{
            name: string;
            dimensions: DimensionsData | null;
            openings: OpeningData[];
          }>(`/projects/${projectId}`);
          setProjectName(project.name);
          if (project.dimensions) {
            setInitialDims(project.dimensions);
          }
          if (project.openings?.length) {
            setInitialOpenings(
              project.openings.map((o) => ({
                type: o.type,
                width_cm: o.width_cm,
                height_cm: o.height_cm,
                count: o.count,
              })),
            );
            setExistingOpeningIds(project.openings.map((o) => o.id));
          }

          // Check if project has photos
          try {
            const photos = await apiGet<{ id: string }[]>(
              `/projects/${projectId}/photos`,
            );
            setHasPhotos(photos.length > 0);
          } catch {
            // Photos check is non-critical
          }
        } else {
          const raw = localStorage.getItem(STORAGE_KEY);
          const projects: LocalProject[] = raw ? JSON.parse(raw) : [];
          const project = projects.find((p) => p.id === projectId);
          if (project) {
            setProjectName(project.name);
            if (project.length_m && project.width_m && project.height_m) {
              setInitialDims({
                length_cm: Math.round(project.length_m * 100),
                width_cm: Math.round(project.width_m * 100),
                height_cm: Math.round(project.height_m * 100),
              });
            }
            if (project.openings?.length) {
              setInitialOpenings(project.openings);
            }
          }
        }
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Impossible de charger le projet'));
      } finally {
        setLoaded(true);
      }
    }

    load();
  }, [appUser, isGuest, isLoading, projectId, router]);

  // Auto-trigger analysis from ?analyze=true query param
  useEffect(() => {
    if (
      loaded &&
      hasPhotos &&
      searchParams.get('analyze') === 'true' &&
      analysis.status === 'idle' &&
      !initialDims
    ) {
      analysis.startAnalysis();
    }
  }, [loaded, hasPhotos, searchParams, analysis, initialDims]);

  const handleAcceptCvDimensions = useCallback(() => {
    if (analysis.dimensions) {
      setInitialDims(analysis.dimensions);
      setShowManualForm(true);
    }
  }, [analysis.dimensions]);

  const handleManualFallback = useCallback(() => {
    setShowManualForm(true);
    analysis.reset();
  }, [analysis]);

  const handleRetryWithReference = useCallback(
    async (_type: string, _heightCm: number) => {
      // For iteration 1, we just re-trigger the analysis
      // Reference object support in the API will be added in iteration 2
      analysis.reset();
      await analysis.startAnalysis();
    },
    [analysis],
  );

  const handleSave = useCallback(
    async (lengthCm: number, widthCm: number, heightCm: number, openings: Opening[]) => {
      setError('');
      setIsSaving(true);
      try {
        if (appUser) {
          // Save dimensions
          await apiPut(`/projects/${projectId}/dimensions`, {
            length_cm: lengthCm,
            width_cm: widthCm,
            height_cm: heightCm,
          });

          // Replace-all strategy: delete existing, then create new
          await Promise.all(
            existingOpeningIds.map((id) =>
              apiDelete(`/projects/${projectId}/openings/${id}`),
            ),
          );

          await Promise.all(
            openings.map((o) =>
              apiPost(`/projects/${projectId}/openings`, {
                type: o.type,
                width_cm: o.width_cm,
                height_cm: o.height_cm,
                count: o.count,
              }),
            ),
          );
        } else {
          const raw = localStorage.getItem(STORAGE_KEY);
          const projects: LocalProject[] = raw ? JSON.parse(raw) : [];
          const idx = projects.findIndex((p) => p.id === projectId);
          if (idx !== -1) {
            projects[idx].length_m = lengthCm / 100;
            projects[idx].width_m = widthCm / 100;
            projects[idx].height_m = heightCm / 100;
            projects[idx].openings = openings;
            projects[idx].updated_at = new Date().toISOString();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
          }
        }
        router.push(`/projects/${projectId}/work-selection`);
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Impossible de sauvegarder les dimensions'));
      } finally {
        setIsSaving(false);
      }
    },
    [appUser, projectId, router, existingOpeningIds],
  );

  if (isLoading || !loaded) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </main>
    );
  }

  // Determine if we should show the analysis section
  const showAnalysis =
    appUser && hasPhotos && !showManualForm && !initialDims;
  const showResult =
    analysis.status === 'completed' && analysis.dimensions && !showManualForm;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          &larr; Retour au dashboard
        </button>
        <h1 className="mt-2 text-3xl font-semibold text-stone-950">
          Dimensions de la piece
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

      {/* CV Analysis Section */}
      {showAnalysis && (
        <div className="mb-6">
          {analysis.status === 'no_reference' ? (
            <ReferenceObjectPrompt
              onRetryWithReference={handleRetryWithReference}
              onManualFallback={handleManualFallback}
            />
          ) : (
            <AnalyzeButton
              status={analysis.status}
              progressPct={analysis.progressPct}
              hasPhotos={hasPhotos}
              onStart={analysis.startAnalysis}
              onManualFallback={handleManualFallback}
            />
          )}
        </div>
      )}

      {/* Analysis Result */}
      {showResult && analysis.dimensions && (
        <div className="mb-6">
          <AnalysisResultPanel
            lengthCm={analysis.dimensions.length_cm}
            widthCm={analysis.dimensions.width_cm}
            heightCm={analysis.dimensions.height_cm}
            confidence={analysis.confidence}
            onAccept={handleAcceptCvDimensions}
            onEdit={handleManualFallback}
          />
        </div>
      )}

      {/* Manual Dimensions Form */}
      {(showManualForm || initialDims || !showAnalysis) && (
        <section className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <DimensionsForm
            initialLengthCm={initialDims?.length_cm ?? 0}
            initialWidthCm={initialDims?.width_cm ?? 0}
            initialHeightCm={initialDims?.height_cm ?? 0}
            initialOpenings={initialOpenings}
            onSave={handleSave}
            isSaving={isSaving}
          />
        </section>
      )}
    </main>
  );
}
