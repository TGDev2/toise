'use client';

import { useState } from 'react';
import type { PhotoEntry } from '@/hooks/usePhotoUpload';
import { PhotoDropzone } from './PhotoDropzone';
import { PhotoUploadItem } from './PhotoUploadItem';
import { CAPTURE_TIPS, PhotoCaptureGuidance } from './PhotoCaptureGuidance';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface PhotoUploadPanelProps {
  photos: PhotoEntry[];
  canAddMore: boolean;
  readyCount: number;
  maxPhotos: number;
  onFiles: (files: File[]) => void;
  onRemove: (localId: string) => void;
  onRetry: (localId: string) => void;
}

export function PhotoUploadPanel({
  photos,
  canAddMore,
  readyCount,
  maxPhotos,
  onFiles,
  onRemove,
  onRetry,
}: PhotoUploadPanelProps) {
  const [guideAcknowledged, setGuideAcknowledged] = useState(false);
  // Écran de conseils avant capture (BACKLOG CV-4) : bloque la prise de vue tant qu'il
  // n'a pas été validé, sauf si des photos existent déjà (reprise d'un projet en cours).
  const showGuide = photos.length === 0 && !guideAcknowledged;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-stone-900">
          Photos de la pièce
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Ajoutez 1 a {maxPhotos} photos pour faciliter l&apos;analyse des dimensions.
          Photographiez les coins opposés et les murs entiers.
        </p>
      </div>

      {showGuide ? (
        <PhotoCaptureGuidance onAcknowledge={() => setGuideAcknowledged(true)} />
      ) : (
        <>
          {/* Shooting guide reminder */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-xs font-medium text-amber-800">
              Conseils pour de meilleures photos :
            </p>
            <ul className="mt-2 space-y-1 text-xs text-amber-700">
              {CAPTURE_TIPS.map((tip) => (
                <li key={tip.title}>&#8226; {tip.text}</li>
              ))}
            </ul>
          </div>

          {/* Photo count */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-stone-700">
              {readyCount}/{maxPhotos} photo{readyCount !== 1 ? 's' : ''}
            </p>
            {!canAddMore && (
              <p className="text-xs text-stone-500">Nombre maximum atteint</p>
            )}
          </div>

          {/* Photo grid */}
          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((photo) => (
                <PhotoUploadItem
                  key={photo.localId}
                  photo={photo}
                  apiUrl={API_URL}
                  onRemove={() => onRemove(photo.localId)}
                  onRetry={() => onRetry(photo.localId)}
                />
              ))}
            </div>
          )}

          {/* Dropzone */}
          {canAddMore && (
            <PhotoDropzone onFiles={onFiles} disabled={false} />
          )}
        </>
      )}
    </div>
  );
}
