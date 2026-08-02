'use client';

import { useState } from 'react';
import type { CloseoutLine } from '@/lib/closeout-types';
import { formatEuros, formatIsoDate } from '@/lib/closeout-types';

/**
 * DATA-5 — une ligne, une correction : « j'en ai acheté combien ».
 *
 * Rien d'autre n'est demandé. Le prix et l'enseigne, s'ils existent, viennent
 * de la liste de courses ; leur absence n'empêche jamais de clôturer, elle
 * change seulement ce que le produit peut répondre.
 */
function ReturnabilityNote({ line }: { line: CloseoutLine }) {
  if (line.surplus_units <= 0) {
    return null;
  }

  if (line.returnability === 'restricted') {
    return (
      <p className="mt-1 text-xs text-amber-700">
        {line.restriction_reason}
        {line.policy && line.return_deadline ? (
          <>
            {' '}
            Si le conditionnement est intact, {line.policy.label} le reprend
            jusqu’au {formatIsoDate(line.return_deadline)}.
          </>
        ) : null}
      </p>
    );
  }

  if (line.returnability === 'unknown') {
    return (
      <p className="mt-1 text-xs text-stone-500">
        {line.store_name
          ? `Nous ne connaissons pas les conditions de reprise de ${line.store_name} — vérifiez sur votre ticket.`
          : 'Renseignez l’enseigne sur la liste de courses pour connaître le délai de reprise.'}
      </p>
    );
  }

  if (!line.policy || !line.return_deadline) {
    return null;
  }

  return (
    <p className="mt-1 text-xs text-emerald-700">
      Reprenable chez {line.policy.label} jusqu’au{' '}
      {formatIsoDate(line.return_deadline)}
      {line.days_remaining !== null ? ` (${line.days_remaining} jours)` : ''}, si
      l’article est non ouvert et dans son emballage d’origine, avec le ticket.
    </p>
  );
}

/**
 * L'écart estimation ↔ réalité, dit sans imputer l'arrondi à l'utilisateur.
 *
 * `packaging_floor_percent` est la perte minimale que le conditionnement
 * impose : un carrelage vendu au carton de 1,44 m² produit mécaniquement du
 * surplus. Sans ce terme, l'écran ferait passer l'arrondi pour de la
 * négligence.
 */
function WasteNote({ line }: { line: CloseoutLine }) {
  if (
    line.implied_waste_percent === null ||
    line.estimated_waste_percent === null
  ) {
    return null;
  }

  const delta = line.waste_delta_points ?? 0;
  const floor = line.packaging_floor_percent;

  return (
    <p className="mt-1 text-xs text-stone-500">
      Estimation : {line.estimated_waste_percent} % de perte. Votre achat en
      implique {line.implied_waste_percent} %
      {floor !== null ? ` (dont ${floor} % imposés par le conditionnement)` : ''}
      .{' '}
      {delta > 0
        ? `Soit ${delta} points de marge en plus que prévu.`
        : delta < 0
          ? `Soit ${Math.abs(delta)} points de moins que prévu.`
          : 'Conforme à la prévision.'}
    </p>
  );
}

function CloseoutRow({
  line,
  onDeclare,
}: {
  line: CloseoutLine;
  onDeclare?: (units: number) => void;
}) {
  const [local, setLocal] = useState<string>(
    line.purchased_units !== null ? String(line.purchased_units) : '',
  );

  const commit = () => {
    if (local.trim() === '') return;
    const value = Math.max(0, Math.round(Number(local)));
    if (Number.isNaN(value)) return;
    setLocal(String(value));
    if (value !== line.purchased_units) {
      onDeclare?.(value);
    }
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-stone-900">{line.name}</p>
          <p className="text-sm text-stone-500">
            Estimé : {line.estimated_units} × {line.unit_label}
            {line.store_name ? ` · ${line.store_name}` : ''}
            {line.real_unit_price !== null
              ? ` · ${formatEuros(line.real_unit_price)} l’unité`
              : ''}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label
            className="text-sm text-stone-600"
            htmlFor={`purchased-${line.item_id}`}
          >
            Acheté
          </label>
          <input
            id={`purchased-${line.item_id}`}
            type="number"
            inputMode="numeric"
            min={0}
            value={local}
            placeholder={String(line.estimated_units)}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="min-h-11 w-20 rounded-xl border border-stone-300 px-3 text-center text-base sm:text-sm"
          />
        </div>
      </div>

      {line.surplus_units > 0 ? (
        <p className="mt-2 text-sm font-medium text-stone-900">
          {line.surplus_units} {line.unit_label} au-delà du nécessaire
          {line.surplus_value !== null
            ? ` · ${formatEuros(line.surplus_value)}`
            : ''}
        </p>
      ) : null}

      {line.shortfall_units > 0 ? (
        <p className="mt-2 text-sm text-stone-600">
          {line.shortfall_units} de moins que l’estimation — vous avez consommé
          moins que prévu, ou il vous en a manqué.
        </p>
      ) : null}

      <ReturnabilityNote line={line} />
      <WasteNote line={line} />
    </div>
  );
}

export function CloseoutRows({
  lines,
  onDeclare,
}: {
  lines: CloseoutLine[];
  onDeclare?: (line: CloseoutLine, units: number) => void;
}) {
  if (lines.length === 0) {
    return (
      <p className="rounded-2xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">
        Aucun article à déclarer sur ce chantier.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {lines.map((line) => (
        <CloseoutRow
          key={`${line.kind}-${line.item_id}`}
          line={line}
          onDeclare={(units) => onDeclare?.(line, units)}
        />
      ))}
    </div>
  );
}
