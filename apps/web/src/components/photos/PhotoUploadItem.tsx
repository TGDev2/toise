'use client';

import type { PhotoEntry } from '@/hooks/usePhotoUpload';
import { AuthenticatedImage } from './AuthenticatedImage';

/** Vignette neutre : avant chargement, après échec, ou sans photo du tout. */
function PhotoPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <svg
        className="h-8 w-8 text-stone-300"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
        />
      </svg>
    </div>
  );
}

interface PhotoUploadItemProps {
  photo: PhotoEntry;
  onRemove: () => void;
  onRetry: () => void;
}

export function PhotoUploadItem({
  photo,
  onRemove,
  onRetry,
}: PhotoUploadItemProps) {
  const label =
    photo.file?.name ?? photo.serverPhoto?.original_filename ?? 'Photo';
  // Après un rechargement, `previewUrl` est nul et seule la photo serveur reste :
  // elle est derrière le guard, donc elle passe par un fetch authentifié.
  const serverPath =
    photo.serverPhoto?.thumbnail_url ?? photo.serverPhoto?.url ?? null;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="relative aspect-[4/3] bg-stone-100">
        {photo.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- object URL local
          <img
            src={photo.previewUrl}
            alt={label}
            className="h-full w-full object-cover"
          />
        ) : serverPath ? (
          <AuthenticatedImage
            path={serverPath}
            alt={label}
            className="h-full w-full object-cover"
            fallback={<PhotoPlaceholder />}
          />
        ) : (
          <PhotoPlaceholder />
        )}

        {/* Progress overlay */}
        {(photo.status === 'compressing' || photo.status === 'uploading') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
            <p className="text-xs font-medium text-white">
              {photo.status === 'compressing' ? 'Compression...' : `${photo.progress}%`}
            </p>
            <div className="mt-2 h-1.5 w-3/4 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full rounded-full bg-white transition-all duration-200"
                style={{ width: `${photo.status === 'compressing' ? 0 : photo.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error overlay */}
        {photo.status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-900/60 p-2">
            <p className="text-center text-xs font-medium text-white">
              {photo.error}
            </p>
            {photo.file && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry();
                }}
                className="rounded-lg bg-white/90 px-3 py-1 text-xs font-medium text-red-700 hover:bg-white"
              >
                Réessayer
              </button>
            )}
          </div>
        )}

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
          aria-label="Supprimer la photo"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Filename */}
      <div className="px-2 py-1.5">
        <p className="truncate text-xs text-stone-500">
          {photo.file?.name ?? photo.serverPhoto?.original_filename ?? ''}
        </p>
      </div>
    </div>
  );
}
