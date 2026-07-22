'use client';

import { useCallback, useRef, useState } from 'react';
import { ApiError, apiDelete, apiUpload } from '@/lib/api';
import { errorHasCode } from '@/lib/errors';

const MAX_PHOTOS = 5;
const MAX_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_RETRIES = 3;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];

export type UploadStatus = 'compressing' | 'uploading' | 'ready' | 'error';

export interface PhotoEntry {
  localId: string;
  file: File | null;
  previewUrl: string | null;
  progress: number;
  status: UploadStatus;
  error: string | null;
  serverPhoto: ServerPhoto | null;
  retryCount: number;
}

export interface ServerPhoto {
  id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  sort_order: number;
  url: string;
  thumbnail_url: string | null;
  created_at: string;
}

// Une rejection serveur deterministe (ex. format/qualite invalide, BACKLOG CV-4) ne doit
// pas etre reessayee -- seuls les incidents reseau/transitoires (ou une 5xx) le justifient.
function isRetryableUploadError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true;
  if (errorHasCode(err, 'NETWORK_ERROR')) return true;
  const status = err.details.statusCode;
  return typeof status === 'number' && status >= 500;
}

async function compressFile(file: File): Promise<File> {
  const { default: imageCompression } = await import(
    'browser-image-compression'
  );
  return imageCompression(file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 4096,
    useWebWorker: true,
    fileType: 'image/jpeg',
  });
}

export function usePhotoUpload(projectId: string) {
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const updatePhoto = useCallback(
    (localId: string, updates: Partial<PhotoEntry>) => {
      setPhotos((prev) =>
        prev.map((p) => (p.localId === localId ? { ...p, ...updates } : p)),
      );
    },
    [],
  );

  const uploadSingleFile = useCallback(
    async (entry: PhotoEntry) => {
      if (!entry.file) return;

      updatePhoto(entry.localId, { status: 'compressing', progress: 0 });

      let fileToUpload: File;
      try {
        fileToUpload = await compressFile(entry.file);
      } catch {
        fileToUpload = entry.file;
      }

      let retryCount = entry.retryCount;
      // Boucle de retry (plutôt que récursion) : MAX_RETRIES tentatives au total.
      for (;;) {
        updatePhoto(entry.localId, { status: 'uploading', progress: 0 });

        try {
          const result = await apiUpload<ServerPhoto>(
            `/projects/${projectId}/photos`,
            fileToUpload,
            (percent) => updatePhoto(entry.localId, { progress: percent }),
          );
          updatePhoto(entry.localId, {
            status: 'ready',
            progress: 100,
            serverPhoto: result,
            error: null,
          });
          return;
        } catch (err) {
          if (isRetryableUploadError(err)) {
            retryCount += 1;
            if (retryCount < MAX_RETRIES) {
              updatePhoto(entry.localId, { retryCount });
              continue;
            }
          }
          updatePhoto(entry.localId, {
            status: 'error',
            error: (err as Error).message || 'Échec de l\'upload',
            retryCount,
          });
          return;
        }
      }
    },
    [projectId, updatePhoto],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      const currentCount = photos.length;
      const availableSlots = MAX_PHOTOS - currentCount;
      if (availableSlots <= 0) return;

      const validFiles: { file: File; error: string | null }[] = [];

      for (const file of files.slice(0, availableSlots)) {
        if (!ALLOWED_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.heic')) {
          validFiles.push({
            file,
            error: 'Format non supporte. Formats acceptes : JPEG, PNG, HEIC',
          });
        } else if (file.size > MAX_SIZE_BYTES) {
          validFiles.push({
            file,
            error: 'La photo dépasse 20 Mo',
          });
        } else {
          validFiles.push({ file, error: null });
        }
      }

      const newEntries: PhotoEntry[] = validFiles.map(({ file, error }) => ({
        localId: crypto.randomUUID(),
        file,
        previewUrl: error ? null : URL.createObjectURL(file),
        progress: 0,
        status: error ? ('error' as const) : ('compressing' as const),
        error,
        serverPhoto: null,
        retryCount: 0,
      }));

      setPhotos((prev) => [...prev, ...newEntries]);

      for (const entry of newEntries) {
        if (!entry.error) {
          uploadSingleFile(entry);
        }
      }
    },
    [photos.length, uploadSingleFile],
  );

  const removePhoto = useCallback(
    async (localId: string) => {
      const photo = photos.find((p) => p.localId === localId);
      if (!photo) return;

      if (photo.previewUrl) {
        URL.revokeObjectURL(photo.previewUrl);
      }

      const controller = abortControllers.current.get(localId);
      if (controller) {
        controller.abort();
        abortControllers.current.delete(localId);
      }

      if (photo.serverPhoto) {
        try {
          await apiDelete(
            `/projects/${projectId}/photos/${photo.serverPhoto.id}`,
          );
        } catch {
          // Ignore deletion errors -- photo will be removed from UI regardless
        }
      }

      setPhotos((prev) => prev.filter((p) => p.localId !== localId));
    },
    [photos, projectId],
  );

  const retryPhoto = useCallback(
    (localId: string) => {
      const photo = photos.find((p) => p.localId === localId);
      if (!photo || photo.status !== 'error' || !photo.file) return;

      const resetEntry: PhotoEntry = {
        ...photo,
        status: 'compressing',
        progress: 0,
        error: null,
        retryCount: 0,
      };
      updatePhoto(localId, resetEntry);
      uploadSingleFile(resetEntry);
    },
    [photos, updatePhoto, uploadSingleFile],
  );

  const loadExistingPhotos = useCallback((serverPhotos: ServerPhoto[]) => {
    setPhotos(
      serverPhotos.map((sp) => ({
        localId: sp.id,
        file: null,
        previewUrl: null,
        progress: 100,
        status: 'ready' as const,
        error: null,
        serverPhoto: sp,
        retryCount: 0,
      })),
    );
  }, []);

  const isUploading = photos.some(
    (p) => p.status === 'compressing' || p.status === 'uploading',
  );
  const readyCount = photos.filter((p) => p.status === 'ready').length;
  const canProceed = readyCount > 0 && !isUploading;
  const canAddMore = photos.length < MAX_PHOTOS;

  return {
    photos,
    addFiles,
    removePhoto,
    retryPhoto,
    loadExistingPhotos,
    isUploading,
    canProceed,
    canAddMore,
    readyCount,
    maxPhotos: MAX_PHOTOS,
  };
}
