'use client';

import type { ExclusionType, SurfaceExclusion } from '@/lib/surface';
import { totalExclusionsArea } from '@/lib/surface';
import { DecimalInput } from '@/components/ui';

interface ExclusionsSectionProps {
  exclusions: SurfaceExclusion[];
  onAdd: (exclusion: SurfaceExclusion) => void;
  onUpdate: (index: number, exclusion: SurfaceExclusion) => void;
  onRemove: (index: number) => void;
  /** Surface nette des murs restant après déduction des ouvertures. */
  netWallAreaCm2: number;
}

const TYPE_LABELS: Record<ExclusionType, string> = {
  credence: 'Crédence',
  half_wall: 'Demi-mur',
  baseboard: 'Plinthes',
  other: 'Autre',
};

interface QuickAddOption {
  type: ExclusionType;
  /** Description pré-remplie (type `other` uniquement) : sert aussi de libellé du bouton. */
  label?: string;
  area_m2: number;
}

const QUICK_ADD: QuickAddOption[] = [
  { type: 'credence', area_m2: 2 },
  { type: 'half_wall', area_m2: 3 },
  { type: 'baseboard', area_m2: 1 },
  { type: 'other', label: 'Baie vitrée', area_m2: 3 },
  { type: 'other', area_m2: 1 },
];

const inputClass =
  'w-full min-h-11 rounded-2xl border border-stone-300 px-3 py-2 text-base sm:text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]';

export function ExclusionsSection({
  exclusions,
  onAdd,
  onUpdate,
  onRemove,
  netWallAreaCm2,
}: ExclusionsSectionProps) {
  const exclusionsAreaCm2 = totalExclusionsArea(exclusions, 'wall');
  const isOverflow = netWallAreaCm2 > 0 && exclusionsAreaCm2 > netWallAreaCm2;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-800">
            Une zone à ne pas traiter ?
          </h3>
        </div>
        <p className="mt-1 text-xs text-stone-500">
          Crédence, demi-mur, baie vitrée… : ce que vous ne traitez pas est
          retiré du calcul des murs. Cas courants :
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_ADD.map(({ type, label, area_m2 }) => (
            <button
              key={label ?? type}
              type="button"
              onClick={() =>
                onAdd({ surface_target: 'wall', type, label, area_m2 })
              }
              className="inline-flex min-h-11 items-center rounded-xl bg-stone-100 px-4 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-200"
            >
              + {label ?? TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {exclusions.length === 0 && (
        <p className="text-xs text-stone-400 italic">
          Aucune surface exclue
        </p>
      )}

      {exclusions.map((exclusion, index) => (
        <ExclusionRow
          key={index}
          exclusion={exclusion}
          index={index}
          onUpdate={(updated) => onUpdate(index, updated)}
          onRemove={() => onRemove(index)}
        />
      ))}

      {isOverflow && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"
        >
          Les dimensions semblent incoherentes : la surface exclue dépasse la
          surface nette des murs.
        </div>
      )}
    </div>
  );
}

interface ExclusionRowProps {
  exclusion: SurfaceExclusion;
  index: number;
  onUpdate: (exclusion: SurfaceExclusion) => void;
  onRemove: () => void;
}

function ExclusionRow({ exclusion, index, onUpdate, onRemove }: ExclusionRowProps) {
  const prefix = `exclusion-${index}`;
  const displayLabel =
    exclusion.type === 'other' && exclusion.label
      ? exclusion.label
      : TYPE_LABELS[exclusion.type];

  return (
    /*
      Même correction qu'`OpeningsSection` : « Surface (m²) » ne tenait pas dans
      les 96 px de sa colonne à 390 px, et la description devait se partager les
      ~150 px restants. Un seul gabarit de grille, qui change au breakpoint —
      la description passe sous la rangée sur mobile via `col-span-full`, sans
      second champ masqué dans le DOM.
    */
    <div className="grid grid-cols-[auto_1fr_auto] items-end gap-2 rounded-2xl border border-stone-200 bg-stone-50 p-3 sm:grid-cols-[auto_6rem_1fr_auto]">
      <span className="self-center rounded-lg bg-stone-200 px-2 py-1.5 text-xs font-medium text-stone-700">
        {displayLabel}
      </span>

      <div className="min-w-0">
        <label htmlFor={`${prefix}-area`} className="text-xs text-stone-500">
          Surface (m²)
        </label>
        <DecimalInput
          id={`${prefix}-area`}
          value={String(exclusion.area_m2)}
          onValueChange={(v) =>
            onUpdate({ ...exclusion, area_m2: parseFloat(v) || 0 })
          }
          className={inputClass}
        />
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Supprimer ${displayLabel} ${index + 1}`}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500 sm:order-last"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {exclusion.type === 'other' && (
        <div className="col-span-full min-w-0 sm:col-span-1">
          <label htmlFor={`${prefix}-label`} className="text-xs text-stone-500">
            Description
          </label>
          <input
            id={`${prefix}-label`}
            type="text"
            maxLength={255}
            value={exclusion.label ?? ''}
            onChange={(e) => onUpdate({ ...exclusion, label: e.target.value })}
            className={inputClass}
          />
        </div>
      )}
    </div>
  );
}
