'use client';

import { useState } from 'react';
import type { ReferenceType } from '@/hooks/useAnalysis';

interface ReferenceObjectPromptProps {
  onRetry: () => void;
  onRetryWithReference: (type: ReferenceType) => void;
  onManualFallback: () => void;
}

type MarkerType = Extract<ReferenceType, 'a4' | 'card'>;

const MARKERS: Record<
  MarkerType,
  { label: string; hint: string; guidance: string }
> = {
  a4: {
    label: 'Feuille A4',
    hint: '21 × 29,7 cm',
    guidance:
      'Scotchez une feuille A4 bien à plat contre un mur, entièrement visible dans le cadre, puis reprenez la photo.',
  },
  card: {
    label: 'Carte bancaire',
    hint: 'format standard',
    guidance:
      'Posez une carte bancaire (ou de fidélité) bien à plat contre un mur, entièrement visible dans le cadre, puis reprenez la photo.',
  },
};

export function ReferenceObjectPrompt({
  onRetry,
  onRetryWithReference,
  onManualFallback,
}: ReferenceObjectPromptProps) {
  const [selected, setSelected] = useState<MarkerType | null>(null);

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
      <p className="text-sm font-medium text-amber-800">
        Aucune porte standard détectée dans l&apos;image
      </p>
      <p className="mt-1 text-xs text-amber-700">
        L&apos;analyse a besoin d&apos;un objet de taille connue pour calibrer
        les dimensions. Pas de porte visible ? Utilisez un étalon : une feuille
        A4 ou une carte bancaire posée au mur.
      </p>

      {/* Étalon universel (BACKLOG CV-3) */}
      <div className="mt-4 rounded-xl border border-amber-200 bg-white/70 p-3">
        <p className="text-xs font-medium text-stone-700">
          Calibrer avec un objet étalon
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(Object.keys(MARKERS) as MarkerType[]).map((type) => {
            const isActive = selected === type;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={isActive}
                onClick={() => setSelected(type)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  isActive
                    ? 'border-amber-500 bg-amber-100 text-amber-900'
                    : 'border-stone-300 bg-white text-stone-700 hover:border-amber-300'
                }`}
              >
                <span className="block font-medium">{MARKERS[type].label}</span>
                <span className="block text-xs text-stone-500">
                  {MARKERS[type].hint}
                </span>
              </button>
            );
          })}
        </div>

        {selected && (
          <p className="mt-2 text-xs text-stone-600">{MARKERS[selected].guidance}</p>
        )}

        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && onRetryWithReference(selected)}
          className="mt-3 w-full rounded-full bg-amber-600 px-4 py-1.5 text-sm text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Relancer l&apos;analyse avec cet étalon
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-stone-300 px-4 py-1.5 text-sm text-stone-700 transition hover:-translate-y-0.5 hover:bg-stone-100"
        >
          Relancer avec une porte
        </button>
        <button
          type="button"
          onClick={onManualFallback}
          className="rounded-full border border-stone-300 px-4 py-1.5 text-sm text-stone-700 transition hover:-translate-y-0.5 hover:bg-stone-100"
        >
          Passer à la saisie manuelle
        </button>
      </div>
    </div>
  );
}
