'use client';

import { useAuth } from '@/contexts/AuthContext';
import { apiGet } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';
import type { ServerPhoto } from '@/hooks/usePhotoUpload';
import { PhotoUploadPanel } from '@/components/photos/PhotoUploadPanel';
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
        {/* Back to dashboard */}
        <button
          onClick={() => router.push('/dashboard')}
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:underline"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Tableau de bord
        </button>

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

          {/* Actions */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              onClick={handleSkip}
              className="rounded-xl border border-stone-300 px-6 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              Passer cette etape
            </button>

            <button
              onClick={handleNext}
              disabled={!canProceed}
              className="rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? 'Upload en cours...' : 'Suivant'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
