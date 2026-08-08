'use client';

import { useState } from 'react';
import type { QuantityValidationState } from '@/lib/quantity-validation-types';

/**
 * E2-4 — le geste qui précède l'émission.
 *
 * Un seul tap pour valider l'ensemble : c'est la contrainte produit, et elle
 * est aussi la bonne conception. Une case par ligne aurait fait payer à tout le
 * monde la vigilance que trois personnes sur cent exercent réellement, et
 * aurait produit une trace moins crédible — cent taps machinaux ne valent pas
 * mieux qu'un tap conscient.
 *
 * La correction ligne par ligne reste possible sans quitter l'écran. Elle
 * n'écrit pas ici : elle passe par la liste d'achats, seul chemin d'écriture
 * d'une quantité, qui enregistre au passage l'écart au calcul.
 */

const QTY_FIELD =
  'w-20 rounded-xl border border-stone-300 px-3 py-2 text-right text-base sm:text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]';

function formatValidatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

interface QuantityValidationPanelProps {
  state: QuantityValidationState;
  /** Enregistre la quantité retenue et rafraîchit l'état de validation. */
  onCorrect: (materialId: string, units: number) => Promise<void>;
  onValidate: () => Promise<void>;
  busy: boolean;
}

export function QuantityValidationPanel({
  state,
  onCorrect,
  onValidate,
  busy,
}: QuantityValidationPanelProps) {
  const validated = state.validated_at !== null;

  if (state.lines.length === 0) return null;

  return (
    <section
      aria-labelledby="quantity-validation-title"
      className={`mt-6 rounded-[2rem] border p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)] ${
        validated
          ? 'border-emerald-200 bg-emerald-50/70'
          : 'border-amber-300 bg-amber-50/70'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="quantity-validation-title"
          className="text-lg font-semibold text-stone-950"
        >
          Quantités à valider
        </h2>
        <span className="text-sm text-stone-600">
          {state.lines.length} ligne{state.lines.length > 1 ? 's' : ''}
        </span>
      </div>

      <p className="mt-2 text-sm text-stone-600">
        Ces quantités sont calculées à partir de la géométrie saisie et de
        ratios sourcés. Relisez-les et corrigez ce qui ne correspond pas à votre
        chantier : ce sont elles qui partiront sur le devis.
      </p>

      <ul className="mt-4 divide-y divide-stone-200/70">
        {state.lines.map((line) => (
          <QuantityRow
            key={line.material_id}
            line={line}
            disabled={busy}
            onCorrect={onCorrect}
          />
        ))}
      </ul>

      {validated ? (
        <p className="mt-5 text-sm font-medium text-emerald-800">
          Quantités validées le {formatValidatedAt(state.validated_at!)}
          {state.validated_by ? ` par ${state.validated_by}` : ''}.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void onValidate()}
          disabled={busy}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          Je valide ces quantités
        </button>
      )}
    </section>
  );
}

interface QuantityRowProps {
  line: QuantityValidationState['lines'][number];
  disabled: boolean;
  onCorrect: (materialId: string, units: number) => Promise<void>;
}

function QuantityRow({ line, disabled, onCorrect }: QuantityRowProps) {
  const [draft, setDraft] = useState(String(line.units_needed));
  const [syncedUnits, setSyncedUnits] = useState(line.units_needed);

  /*
    La prop fait autorité : après un `PATCH`, la page recharge et la quantité
    retenue peut différer de ce qui a été tapé (borne serveur, correction
    concurrente d'un autre onglet). Sans cette resynchronisation, le champ
    afficherait indéfiniment une valeur que la base ne porte pas — le défaut
    exact des composants qui lisent leur prop dans `useState(initial)`
    (leçon 24).

    Pendant le rendu et non dans un effet : un effet imposerait un second rendu,
    donc un affichage transitoire de l'ancienne valeur. Reste un cas résiduel
    assumé — si le `PATCH` échoue, la quantité de la prop ne bouge pas et le
    brouillon saisi demeure à l'écran, à côté du message d'erreur de la page.
    C'est le comportement voulu : effacer la saisie d'un artisan parce que le
    réseau a lâché serait pire que de la lui laisser sous les yeux.
  */
  if (line.units_needed !== syncedUnits) {
    setSyncedUnits(line.units_needed);
    setDraft(String(line.units_needed));
  }

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(String(line.units_needed));
      return;
    }
    if (parsed === line.units_needed) return;
    void onCorrect(line.material_id, parsed);
  };

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-stone-900">
          {line.material_name}
        </p>
        <p className="truncate text-xs text-stone-500">
          {line.work_type_label} · {line.packaging_label}
        </p>
      </div>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        aria-label={`Quantité pour ${line.material_name}`}
        className={QTY_FIELD}
      />
    </li>
  );
}
