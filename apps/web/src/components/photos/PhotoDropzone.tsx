'use client';

import { useCallback, useRef } from 'react';

interface PhotoDropzoneProps {
  onFiles: (files: File[]) => void;
  disabled: boolean;
}

const ACCEPT = 'image/jpeg,image/png,image/heic,.heic';

export function PhotoDropzone({ onFiles, disabled }: PhotoDropzoneProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      const files = input.files;
      if (files && files.length > 0) {
        onFiles(Array.from(files));
      }
      input.value = '';
    },
    [onFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/'),
      );
      if (files.length > 0) onFiles(files);
    },
    [onFiles, disabled],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
        disabled
          ? 'border-stone-200 bg-stone-50 opacity-50'
          : 'border-stone-300 bg-white/60'
      }`}
    >
      {/*
        PRO-5 : deux entrées distinctes au lieu d'un seul input porteur de
        `capture="environment"`. Cet attribut force l'appareil photo et retire
        l'accès à la photothèque sur Android comme sur iOS : un artisan ayant
        déjà photographié la pièce devait tout refaire sur place. La capture
        directe reste l'action mise en avant — c'est le cas d'usage du parcours.
      */}
      <input
        ref={cameraRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        multiple
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      <input
        ref={galleryRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />

      <svg
        className="h-9 w-9 text-stone-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
        />
      </svg>

      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          type="button"
          disabled={disabled}
          onClick={() => cameraRef.current?.click()}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed"
        >
          Prendre une photo
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => galleryRef.current?.click()}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed"
        >
          Choisir dans la galerie
        </button>
      </div>

      <p className="text-xs text-stone-500">
        JPEG, PNG ou HEIC - 20 Mo max par photo
      </p>
    </div>
  );
}
