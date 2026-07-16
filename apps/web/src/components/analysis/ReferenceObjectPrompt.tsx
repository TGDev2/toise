'use client';

interface ReferenceObjectPromptProps {
  onRetry: () => void;
  onManualFallback: () => void;
}

export function ReferenceObjectPrompt({
  onRetry,
  onManualFallback,
}: ReferenceObjectPromptProps) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
      <p className="text-sm font-medium text-amber-800">
        Aucune porte standard détectée dans l&apos;image
      </p>
      <p className="mt-1 text-xs text-amber-700">
        L&apos;analyse a besoin d&apos;une porte entièrement visible pour
        calibrer les dimensions. Reprenez une photo où une porte apparaît en
        entier, puis relancez l&apos;analyse — ou saisissez les dimensions
        manuellement.
      </p>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-amber-600 px-4 py-1.5 text-sm text-white transition hover:-translate-y-0.5"
        >
          Relancer l&apos;analyse
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
