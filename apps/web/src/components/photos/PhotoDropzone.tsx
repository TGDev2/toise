'use client';

import { useCallback, useRef } from 'react';

interface PhotoDropzoneProps {
  onFiles: (files: File[]) => void;
  disabled: boolean;
}

export function PhotoDropzone({ onFiles, disabled }: PhotoDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFiles(Array.from(files));
      }
      if (inputRef.current) inputRef.current.value = '';
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
      className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
        disabled
          ? 'cursor-not-allowed border-stone-200 bg-stone-50 opacity-50'
          : 'cursor-pointer border-stone-300 bg-white/60 hover:border-[var(--accent)] hover:bg-white/80'
      }`}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,.heic"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />

      <svg
        className="h-10 w-10 text-stone-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
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

      <div>
        <p className="text-sm font-medium text-stone-700">
          Prendre ou ajouter des photos
        </p>
        <p className="mt-1 text-xs text-stone-500">
          JPEG, PNG ou HEIC - 20 Mo max par photo
        </p>
      </div>
    </div>
  );
}
