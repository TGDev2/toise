'use client';

import type { Opening } from '@/lib/surface';
import { totalOpeningsArea } from '@/lib/surface';

interface OpeningsSectionProps {
  openings: Opening[];
  onAdd: (opening: Opening) => void;
  onUpdate: (index: number, opening: Opening) => void;
  onRemove: (index: number) => void;
  grossWallAreaCm2: number;
}

const DOOR_DEFAULTS: Opening = { type: 'door', width_cm: 90, height_cm: 204, count: 1 };
const WINDOW_DEFAULTS: Opening = { type: 'window', width_cm: 120, height_cm: 100, count: 1 };

const inputClass =
  'w-full min-h-11 rounded-2xl border border-stone-300 px-3 py-2 text-base sm:text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]';

export function OpeningsSection({
  openings,
  onAdd,
  onUpdate,
  onRemove,
  grossWallAreaCm2,
}: OpeningsSectionProps) {
  const openingsAreaCm2 = totalOpeningsArea(openings);
  const isOverflow = grossWallAreaCm2 > 0 && openingsAreaCm2 > grossWallAreaCm2;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-800">Ouvertures</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onAdd({ ...DOOR_DEFAULTS })}
            className="inline-flex min-h-11 items-center rounded-xl bg-stone-100 px-4 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-200"
          >
            + Porte
          </button>
          <button
            type="button"
            onClick={() => onAdd({ ...WINDOW_DEFAULTS })}
            className="inline-flex min-h-11 items-center rounded-xl bg-stone-100 px-4 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-200"
          >
            + Fenêtre
          </button>
        </div>
      </div>

      {openings.length === 0 && (
        <p className="text-xs text-stone-400 italic">
          Aucune ouverture ajoutée
        </p>
      )}

      {openings.map((opening, index) => (
        <OpeningRow
          key={index}
          opening={opening}
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
          Les dimensions semblent incohérentes : la surface totale des
          ouvertures dépasse la surface brute des murs.
        </div>
      )}
    </div>
  );
}

interface OpeningRowProps {
  opening: Opening;
  index: number;
  onUpdate: (opening: Opening) => void;
  onRemove: () => void;
}

function OpeningRow({ opening, index, onUpdate, onRemove }: OpeningRowProps) {
  const label = opening.type === 'door' ? 'Porte' : 'Fenêtre';
  const prefix = `opening-${index}`;

  return (
    /*
      PRO-5 : la rangée était un `flex` non wrappé de cinq éléments. À 390 px il
      restait ~51 px de zone de saisie utile par champ, labels tronqués compris.

      Une grille dont seul le gabarit change au breakpoint — et non deux variantes
      masquées l'une ou l'autre : dupliquer la rangée mettrait deux boutons
      « Supprimer » et deux champs de même rôle dans le DOM, que les lecteurs
      d'écran et les tests verraient tous les deux. Le bouton de suppression est
      simplement repoussé en fin de rangée sur `sm:` via `order`.

      Mobile (2 colonnes) :  [badge]   [supprimer]
                             [largeur] [hauteur]
                             [qté]
      sm+ (une rangée)    :  [badge] [largeur] [hauteur] [qté] [supprimer]
    */
    <div className="grid grid-cols-2 items-end gap-2 rounded-2xl border border-stone-200 bg-stone-50 p-3 sm:grid-cols-[auto_1fr_1fr_4rem_auto]">
      <span className="self-center rounded-lg bg-stone-200 px-2 py-1.5 text-center text-xs font-medium text-stone-700">
        {label}
      </span>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Supprimer ${label} ${index + 1}`}
        className="inline-flex h-11 w-11 items-center justify-center justify-self-end rounded-xl text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500 sm:order-last sm:justify-self-auto"
      >
        <TrashIcon />
      </button>

      <div className="min-w-0">
        <label htmlFor={`${prefix}-width`} className="text-xs text-stone-500">
          Largeur (cm)
        </label>
        <input
          id={`${prefix}-width`}
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={opening.width_cm}
          onChange={(e) =>
            onUpdate({ ...opening, width_cm: parseInt(e.target.value) || 0 })
          }
          className={inputClass}
        />
      </div>

      <div className="min-w-0">
        <label htmlFor={`${prefix}-height`} className="text-xs text-stone-500">
          Hauteur (cm)
        </label>
        <input
          id={`${prefix}-height`}
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={opening.height_cm}
          onChange={(e) =>
            onUpdate({ ...opening, height_cm: parseInt(e.target.value) || 0 })
          }
          className={inputClass}
        />
      </div>

      <div className="min-w-0">
        <label htmlFor={`${prefix}-count`} className="text-xs text-stone-500">
          Qté
        </label>
        <input
          id={`${prefix}-count`}
          type="number"
          inputMode="numeric"
          min="1"
          max="50"
          step="1"
          value={opening.count}
          onChange={(e) =>
            onUpdate({ ...opening, count: parseInt(e.target.value) || 1 })
          }
          className={inputClass}
        />
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
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
  );
}
