'use client';

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
  'w-full rounded-2xl border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]';

export function ShapeSections({
  sections,
  onAdd,
  onUpdate,
  onRemove,
}: ShapeSectionsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-stone-800">
            Votre pièce a-t-elle un décroché ?
          </h3>
          <p className="text-xs text-stone-500">
            Ajoutez chaque partie non rectangulaire (aile en L, décroché en T…).
          </p>
        </div>
        <button
          type="button"
          onClick={() => onAdd({ ...DEFAULT_SECTION })}
          className="shrink-0 rounded-xl bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-200 transition-colors"
        >
          + Décroché
        </button>
      </div>

      {sections.length === 0 && (
        <p className="text-xs text-stone-400 italic">
          Aucun décroché — la pièce est un simple rectangle.
        </p>
      )}

      {sections.map((section, index) => (
        <ShapeSectionRow
          key={index}
          section={section}
          index={index}
          onUpdate={(updated) => onUpdate(index, updated)}
          onRemove={() => onRemove(index)}
        />
      ))}
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
          className="rounded-xl p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500 transition-colors"
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
