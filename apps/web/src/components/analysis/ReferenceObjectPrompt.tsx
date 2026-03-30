'use client';

import { useState } from 'react';

interface ReferenceObjectPromptProps {
  onRetryWithReference: (type: string, heightCm: number) => void;
  onManualFallback: () => void;
}

export function ReferenceObjectPrompt({
  onRetryWithReference,
  onManualFallback,
}: ReferenceObjectPromptProps) {
  const [refType, setRefType] = useState('door');
  const [customHeight, setCustomHeight] = useState('');

  const handleRetry = () => {
    const heightCm = refType === 'door' ? 204 : Number(customHeight);
    if (!heightCm || heightCm <= 0) return;
    onRetryWithReference(refType, heightCm);
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
      <p className="text-sm font-medium text-amber-800">
        Aucune porte standard detectee dans l&apos;image
      </p>
      <p className="mt-1 text-xs text-amber-600">
        Indiquez un objet de reference pour calibrer les dimensions :
      </p>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor="ref-type"
            className="block text-xs font-medium text-stone-600"
          >
            Type d&apos;objet
          </label>
          <select
            id="ref-type"
            value={refType}
            onChange={(e) => setRefType(e.target.value)}
            className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            <option value="door">Porte standard (204 cm)</option>
            <option value="custom">Autre (saisir la hauteur)</option>
          </select>
        </div>

        {refType === 'custom' && (
          <div className="flex-1">
            <label
              htmlFor="custom-height"
              className="block text-xs font-medium text-stone-600"
            >
              Hauteur (cm)
            </label>
            <input
              id="custom-height"
              type="number"
              min="10"
              max="500"
              value={customHeight}
              onChange={(e) => setCustomHeight(e.target.value)}
              placeholder="Ex: 80"
              className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={handleRetry}
          disabled={refType === 'custom' && (!customHeight || Number(customHeight) <= 0)}
          className="rounded-full bg-amber-600 px-4 py-1.5 text-sm text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Relancer l&apos;analyse
        </button>
        <button
          type="button"
          onClick={onManualFallback}
          className="rounded-full border border-stone-300 px-4 py-1.5 text-sm text-stone-700 transition hover:-translate-y-0.5 hover:bg-stone-100"
        >
          Passer a la saisie manuelle
        </button>
      </div>
    </div>
  );
}
