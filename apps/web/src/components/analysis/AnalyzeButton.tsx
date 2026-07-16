'use client';

interface AnalyzeButtonProps {
  status: string;
  progressPct: number;
  hasPhotos: boolean;
  onStart: () => void;
  onManualFallback: () => void;
}

export function AnalyzeButton({
  status,
  progressPct,
  hasPhotos,
  onStart,
  onManualFallback,
}: AnalyzeButtonProps) {
  if (status === 'processing' || status === 'starting') {
    return (
      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <svg
            className="h-5 w-5 animate-spin text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800">
              Analyse en cours...
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-blue-200">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-blue-600">
              {progressPct}% — Temps estimé : environ 30 secondes
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
        <p className="text-sm font-medium text-red-800">
          L&apos;analyse automatique a échoué
        </p>
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={onStart}
            className="rounded-full border border-red-300 px-4 py-1.5 text-sm text-red-700 hover:-translate-y-0.5 hover:bg-red-100"
          >
            Réessayer
          </button>
          <button
            type="button"
            onClick={onManualFallback}
            className="rounded-full bg-stone-950 px-4 py-1.5 text-sm text-white hover:-translate-y-0.5"
          >
            Saisie manuelle
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onStart}
      disabled={!hasPhotos}
      className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="flex items-center gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
            Analyser les photos automatiquement
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              Bêta
            </span>
          </p>
          <p className="text-xs text-emerald-600">
            {hasPhotos
              ? 'Estimation approximative des dimensions à partir de vos photos (~30s) — à vérifier avant de continuer'
              : 'Ajoutez des photos au projet pour activer l\'analyse'}
          </p>
        </div>
      </div>
    </button>
  );
}
