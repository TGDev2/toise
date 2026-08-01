'use client';

import { useAuth } from '@/contexts/AuthContext';
import { apiGet } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';
import type { ServerPhoto } from '@/hooks/usePhotoUpload';
import { PhotoUploadPanel } from '@/components/photos/PhotoUploadPanel';
import { FlowProgress } from '@/components/quote-flow/FlowProgress';
import { StickyActionBar } from '@/components/ui';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function PhotosPage() {
  const { appUser, isGuest, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const {
    photos,
    addFiles,
    removePhoto,
    retryPhoto,
    loadExistingPhotos,
    isUploading,
    canProceed,
    canAddMore,
    readyCount,
    maxPhotos,
  } = usePhotoUpload(projectId);

  useEffect(() => {
    if (isLoading) return;

    // Guest users skip photos -- redirect to dimensions
    if (isGuest || !appUser) {
      router.replace(`/projects/${projectId}/dimensions`);
      return;
    }

    async function load() {
      try {
        const existing = await apiGet<ServerPhoto[]>(
          `/projects/${projectId}/photos`,
        );
        loadExistingPhotos(existing);
      } catch (err) {
        setError(getErrorMessage(err, 'Impossible de charger les photos'));
      } finally {
        setLoaded(true);
      }
    }

    load();
  }, [isLoading, appUser, isGuest, projectId, router, loadExistingPhotos]);

  const handleNext = useCallback(() => {
    router.push(`/projects/${projectId}/dimensions`);
  }, [router, projectId]);

  const handleSkip = useCallback(() => {
    router.push(`/projects/${projectId}/dimensions`);
  }, [router, projectId]);

  if (isLoading || !loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <p className="text-stone-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <FlowProgress step="photos" projectId={projectId} backHref="/dashboard" />

        <div className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)] sm:p-8">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <PhotoUploadPanel
            photos={photos}
            canAddMore={canAddMore}
            readyCount={readyCount}
            maxPhotos={maxPhotos}
            onFiles={addFiles}
            onRemove={removePhoto}
            onRetry={retryPhoto}
          />

        </div>

        {/*
          L'analyse CV est l'action principale de l'étape, pas une option à côté
          de « Suivant » : c'est elle qui remplit les mesures et évite la saisie
          manuelle. Elle prend donc la barre collante, « Suivant » reculant en
          action secondaire tant qu'aucune photo n'est prête.
        */}
        <StickyActionBar>
          {canProceed ? (
            <button
              onClick={() =>
                router.push(`/projects/${projectId}/dimensions?analyze=true`)
              }
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)]"
            >
              Analyser les dimensions
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!canProceed}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? 'Upload en cours...' : 'Suivant'}
            </button>
          )}
          <button
            onClick={handleSkip}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-stone-300 px-6 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
          >
            {canProceed ? 'Saisir les mesures à la main' : 'Passer cette étape'}
          </button>
        </StickyActionBar>
      </div>
    </div>
  );
}
