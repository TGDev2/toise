'use client';

import { DecimalInput } from '@/components/ui';
import type { QuoteLaborLineInput, QuoteLaborKind } from '@/lib/quote-types';

interface LaborLinesEditorProps {
  lines: QuoteLaborLineInput[];
  onAdd: () => void;
  onUpdate: (index: number, line: QuoteLaborLineInput) => void;
  onRemove: (index: number) => void;
}

const inputClass =
  'w-full min-h-11 rounded-2xl border border-stone-300 px-3 py-2 text-base sm:text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]';

function lineTotal(line: QuoteLaborLineInput): number {
  return (line.kind === 'flat' ? 1 : line.quantity) * line.unit_price_ht;
}

function formatPrice(v: number): string {
  return v.toFixed(2).replace('.', ',');
}

/**
 * Liste éditable des lignes de MO d'un devis (E2-3). `unit_price_ht` à `0`
 * s'affiche vide plutôt que « 0,00 » : une ligne proposée sans taux
 * d'entreprise renseigné doit se voir comme incomplète, pas comme gratuite.
 */
export function LaborLinesEditor({
  lines,
  onAdd,
  onUpdate,
  onRemove,
}: LaborLinesEditorProps) {
  return (
    <div className="space-y-4">
      {lines.length === 0 && (
        <p className="text-xs text-stone-400 italic">
          Aucune ligne de main-d&apos;œuvre.
        </p>
      )}

      {lines.map((line, index) => (
        <LaborLineRow
          key={index}
          line={line}
          index={index}
          onUpdate={(updated) => onUpdate(index, updated)}
          onRemove={() => onRemove(index)}
        />
      ))}

      <button
        type="button"
        onClick={onAdd}
        className="inline-flex min-h-11 items-center rounded-xl bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-200"
      >
        + Ajouter une ligne
      </button>
    </div>
  );
}

interface LaborLineRowProps {
  line: QuoteLaborLineInput;
  index: number;
  onUpdate: (line: QuoteLaborLineInput) => void;
  onRemove: () => void;
}

function LaborLineRow({ line, index, onUpdate, onRemove }: LaborLineRowProps) {
  const prefix = `labor-line-${index}`;
  const missingRate = line.unit_price_ht <= 0;

  const setKind = (kind: QuoteLaborKind) => {
    onUpdate({
      ...line,
      kind,
      quantity: kind === 'flat' ? 1 : line.quantity,
    });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${prefix}-label`} className="text-xs text-stone-500">
            Désignation
          </label>
          <input
            id={`${prefix}-label`}
            type="text"
            maxLength={255}
            value={line.label}
            onChange={(e) => onUpdate({ ...line, label: e.target.value })}
            className={inputClass}
          />
          {line.room_name && (
            <p className="mt-1 text-xs text-stone-400">
              {line.room_name}
              {line.surface_m2 != null ? ` — ${line.surface_m2} m²` : ''}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Supprimer la ligne ${line.label || index + 1}`}
          className="mt-5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
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
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setKind('hourly')}
          className={`inline-flex min-h-9 items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold ${
            line.kind === 'hourly'
              ? 'bg-stone-950 text-white'
              : 'border border-stone-300 text-stone-700 hover:bg-white'
          }`}
        >
          Taux horaire
        </button>
        <button
          type="button"
          onClick={() => setKind('flat')}
          className={`inline-flex min-h-9 items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold ${
            line.kind === 'flat'
              ? 'bg-stone-950 text-white'
              : 'border border-stone-300 text-stone-700 hover:bg-white'
          }`}
        >
          Forfait
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {line.kind === 'hourly' && (
          <div>
            <label htmlFor={`${prefix}-hours`} className="text-xs text-stone-500">
              Heures
            </label>
            <DecimalInput
              id={`${prefix}-hours`}
              value={line.quantity === 0 ? '' : String(line.quantity)}
              onValueChange={(v) =>
                onUpdate({ ...line, quantity: parseFloat(v) || 0 })
              }
              className={inputClass}
            />
          </div>
        )}
        <div className={line.kind === 'flat' ? 'col-span-2' : undefined}>
          <label htmlFor={`${prefix}-rate`} className="text-xs text-stone-500">
            {line.kind === 'hourly' ? 'Taux horaire (EUR/h)' : 'Montant forfaitaire (EUR)'}
          </label>
          <DecimalInput
            id={`${prefix}-rate`}
            value={line.unit_price_ht === 0 ? '' : String(line.unit_price_ht)}
            onValueChange={(v) =>
              onUpdate({ ...line, unit_price_ht: parseFloat(v) || 0 })
            }
            className={`${inputClass} ${missingRate ? 'border-amber-400' : ''}`}
          />
          {missingRate && (
            <p className="mt-1 text-xs text-amber-700">Taux requis</p>
          )}
        </div>
      </div>

      <div className="flex justify-end text-sm font-medium text-stone-700">
        {formatPrice(lineTotal(line))} EUR
      </div>
    </div>
  );
}
