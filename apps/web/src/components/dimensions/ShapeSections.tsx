'use client';

import { useState } from 'react';
import type { ShapeSection, ShapeSide } from '@/lib/surface';

interface ShapeSectionsProps {
  sections: ShapeSection[];
  onAdd: (section: ShapeSection) => void;
  onUpdate: (index: number, section: ShapeSection) => void;
  onRemove: (index: number) => void;
}

const SIDE_LABELS: Record<ShapeSide, string> = {
  right: 'Droite',
  left: 'Gauche',
  top: 'Haut',
  bottom: 'Bas',
};

const SIDES: ShapeSide[] = ['right', 'left', 'top', 'bottom'];

const DEFAULT_SECTION: ShapeSection = {
  side: 'right',
  offset_cm: 0,
  along_cm: 100,
  depth_cm: 100,
};

const inputClass =
  'w-full min-h-11 rounded-2xl border border-stone-300 px-3 py-2 text-base sm:text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]';

const ORDINALS = ['second', 'troisième'] as const;
/** Nombre de décrochés au-delà duquel la saisie guidée cède la place à un simple lien. */
const GUIDED_LIMIT = ORDINALS.length + 1;

const primaryButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-xl bg-stone-900 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-stone-700';
const secondaryButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100';

export function ShapeSections({
  sections,
  onAdd,
  onUpdate,
  onRemove,
}: ShapeSectionsProps) {
  // Répond « non » à la question initiale : bascule vers l'affichage
  // « pièce simple », avec un moyen discret de revenir dessus.
  const [declinedFirst, setDeclinedFirst] = useState(false);
  // Répond « non » à une relance (2ᵉ ou 3ᵉ décroché) : arrête de guider,
  // mais laisse un ajout libre pour les formes en U (4 rectangles et plus).
  const [declinedMore, setDeclinedMore] = useState(false);

  const addDefault = () => {
    onAdd({ ...DEFAULT_SECTION });
    setDeclinedFirst(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-stone-800">
          Votre pièce a-t-elle un décroché ?
        </h3>
        <p className="text-xs text-stone-500">
          Un L, un T, une alcôve : ajoutez chaque partie non rectangulaire, une par une.
        </p>
      </div>

      {sections.map((section, index) => (
        <ShapeSectionRow
          key={index}
          section={section}
          index={index}
          onUpdate={(updated) => onUpdate(index, updated)}
          onRemove={() => onRemove(index)}
        />
      ))}

      {sections.length === 0 && !declinedFirst && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={addDefault} className={primaryButtonClass}>
            Oui, ajouter un décroché
          </button>
          <button
            type="button"
            onClick={() => setDeclinedFirst(true)}
            className={secondaryButtonClass}
          >
            Non, c&apos;est un rectangle simple
          </button>
        </div>
      )}

      {sections.length === 0 && declinedFirst && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-stone-400 italic">Pièce simple (rectangle).</p>
          <button
            type="button"
            onClick={() => setDeclinedFirst(false)}
            className="text-xs font-medium text-stone-500 underline underline-offset-2 hover:text-stone-700"
          >
            + Ajouter un décroché
          </button>
        </div>
      )}

      {sections.length >= 1 && sections.length < GUIDED_LIMIT && !declinedMore && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-stone-300 p-3">
          <p className="text-xs text-stone-600">
            Ajouter un {ORDINALS[sections.length - 1]} décroché ?
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={addDefault} className={primaryButtonClass}>
              Oui, ajouter
            </button>
            <button
              type="button"
              onClick={() => setDeclinedMore(true)}
              className={secondaryButtonClass}
            >
              Non, c&apos;est tout
            </button>
          </div>
        </div>
      )}

      {sections.length >= 1 && (sections.length >= GUIDED_LIMIT || declinedMore) && (
        <button
          type="button"
          onClick={addDefault}
          className="text-xs font-medium text-stone-500 underline underline-offset-2 hover:text-stone-700"
        >
          + Ajouter un autre décroché
        </button>
      )}
    </div>
  );
}

interface ShapeSectionRowProps {
  section: ShapeSection;
  index: number;
  onUpdate: (section: ShapeSection) => void;
  onRemove: () => void;
}

function ShapeSectionRow({
  section,
  index,
  onUpdate,
  onRemove,
}: ShapeSectionRowProps) {
  const prefix = `section-${index}`;

  const num = (value: string) => Math.max(0, parseInt(value, 10) || 0);

  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-lg bg-stone-200 px-2 py-1 text-xs font-medium text-stone-700">
          Décroché {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Supprimer décroché ${index + 1}`}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path
              fillRule="evenodd"
              d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label htmlFor={`${prefix}-side`} className="text-xs text-stone-500">
            Côté
          </label>
          <select
            id={`${prefix}-side`}
            value={section.side}
            onChange={(e) =>
              onUpdate({ ...section, side: e.target.value as ShapeSide })
            }
            className={inputClass}
          >
            {SIDES.map((side) => (
              <option key={side} value={side}>
                {SIDE_LABELS[side]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${prefix}-offset`} className="text-xs text-stone-500">
            Depuis le coin (cm)
          </label>
          <input
            id={`${prefix}-offset`}
            type="number"
            min="0"
            step="1"
            value={section.offset_cm}
            onChange={(e) =>
              onUpdate({ ...section, offset_cm: num(e.target.value) })
            }
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={`${prefix}-along`} className="text-xs text-stone-500">
            Largeur (cm)
          </label>
          <input
            id={`${prefix}-along`}
            type="number"
            min="1"
            step="1"
            value={section.along_cm}
            onChange={(e) =>
              onUpdate({ ...section, along_cm: num(e.target.value) })
            }
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={`${prefix}-depth`} className="text-xs text-stone-500">
            Profondeur (cm)
          </label>
          <input
            id={`${prefix}-depth`}
            type="number"
            min="1"
            step="1"
            value={section.depth_cm}
            onChange={(e) =>
              onUpdate({ ...section, depth_cm: num(e.target.value) })
            }
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}
