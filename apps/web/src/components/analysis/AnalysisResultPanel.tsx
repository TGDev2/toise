'use client';

import { RoomPreview } from '@/components/dimensions/RoomPreview';
import type { DetectedOpening } from '@/hooks/useAnalysis';
import { formatDimensionWithUncertainty } from '@/lib/format-dimension';

interface AnalysisResultPanelProps {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  confidence: string | null;
  /** Incertitude de mesure (cm), CV-5. */
  lengthUncertaintyCm?: number | null;
  widthUncertaintyCm?: number | null;
  heightUncertaintyCm?: number | null;
  openings?: DetectedOpening[];
  onAccept: () => void;
  onEdit: () => void;
}

const CONFIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  high: { label: 'Haute', color: 'bg-emerald-100 text-emerald-800' },
  medium: { label: 'Moyenne', color: 'bg-amber-100 text-amber-800' },
  low: { label: 'Basse', color: 'bg-red-100 text-red-800' },
};

export function AnalysisResultPanel({
  lengthCm,
  widthCm,
  heightCm,
  confidence,
  lengthUncertaintyCm,
  widthUncertaintyCm,
  heightUncertaintyCm,
  openings = [],
  onAccept,
  onEdit,
}: AnalysisResultPanelProps) {
  const conf = confidence ? CONFIDENCE_LABELS[confidence] : null;

  const doorCount = openings
    .filter((o) => o.type === 'door')
    .reduce((sum, o) => sum + o.count, 0);
  const windowCount = openings
    .filter((o) => o.type === 'window')
    .reduce((sum, o) => sum + o.count, 0);

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-emerald-800">
          Dimensions détectées par analyse photo
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            Bêta
          </span>
        </h3>
        {conf && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${conf.color}`}
          >
            Confiance : {conf.label}
          </span>
        )}
      </div>

      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <p className="font-medium">Estimation approximative</p>
        <p className="mt-1">
          L&apos;analyse photo est en version bêta : les dimensions détectées
          sont une estimation. Vérifiez-les et corrigez-les avant de continuer
          — la précision de votre liste d&apos;achat en dépend.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white px-3 py-2 text-center">
          <p className="text-xs text-stone-500">Longueur</p>
          <p className="text-lg font-semibold text-stone-950">
            {formatDimensionWithUncertainty(lengthCm, lengthUncertaintyCm)}
          </p>
        </div>
        <div className="rounded-xl bg-white px-3 py-2 text-center">
          <p className="text-xs text-stone-500">Largeur</p>
          <p className="text-lg font-semibold text-stone-950">
            {formatDimensionWithUncertainty(widthCm, widthUncertaintyCm)}
          </p>
        </div>
        <div className="rounded-xl bg-white px-3 py-2 text-center">
          <p className="text-xs text-stone-500">Hauteur</p>
          <p className="text-lg font-semibold text-stone-950">
            {formatDimensionWithUncertainty(heightCm, heightUncertaintyCm)}
          </p>
        </div>
      </div>

      <div className="mb-4 flex justify-center">
        <RoomPreview
          lengthCm={lengthCm}
          widthCm={widthCm}
          unitSystem="metric"
        />
      </div>

      {openings.length > 0 && (
        <div className="mb-4 rounded-xl bg-white/80 px-3 py-2">
          <p className="mb-1 text-xs font-medium text-stone-600">
            Ouvertures détectées
          </p>
          {openings.map((o, i) => (
            <div
              key={`${o.type}-${i}`}
              className="flex justify-between text-xs text-stone-500"
            >
              <span>
                {o.type === 'door' ? 'Porte' : 'Fenêtre'}
                {o.count > 1 ? ` (${o.count}x)` : ''}
              </span>
              <span>
                {o.width_cm} x {o.height_cm} cm
              </span>
            </div>
          ))}
          {(doorCount > 0 || windowCount > 0) && (
            <p className="mt-1 text-xs text-stone-400">
              {[
                doorCount > 0
                  ? `${doorCount} porte${doorCount > 1 ? 's' : ''}`
                  : null,
                windowCount > 0
                  ? `${windowCount} fenêtre${windowCount > 1 ? 's' : ''}`
                  : null,
              ]
                .filter(Boolean)
                .join(' et ')}{' '}
              détectée{doorCount + windowCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onAccept}
          className="flex-1 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5"
        >
          Utiliser ces dimensions
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full border border-stone-300 px-4 py-2.5 text-sm text-stone-700 transition hover:-translate-y-0.5 hover:bg-stone-100"
        >
          Modifier
        </button>
      </div>
    </div>
  );
}
