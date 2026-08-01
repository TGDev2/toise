'use client';

import type { InputHTMLAttributes } from 'react';
import { normalizeDecimalInput } from '@/lib/decimal-input';

type NativeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'inputMode'
>;

export interface DecimalInputProps extends NativeProps {
  /** Valeur contrôlée, toujours en notation point (« 3.5 »). */
  value: string;
  /** Reçoit la valeur normalisée ; n'est pas appelé si la frappe est refusée. */
  onValueChange: (value: string) => void;
}

/**
 * Champ décimal utilisable au doigt (PRO-5).
 *
 * `type="text" inputMode="decimal"` plutôt que `type="number"` : c'est ce qui
 * ouvre le pavé décimal sur mobile **et** laisse passer la virgule française,
 * que `type="number"` rejette (cf. `lib/decimal-input.ts`). Conséquence assumée :
 * on perd les flèches de pas natives, sans usage sur mobile, et la validation de
 * bornes (`min`/`max`) qui n'était de toute façon appliquée par aucun formulaire
 * du parcours — les valeurs sont bornées côté API par les DTO `class-validator`.
 */
export function DecimalInput({
  value,
  onValueChange,
  className = '',
  ...rest
}: DecimalInputProps) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => {
        const next = normalizeDecimalInput(e.target.value);
        if (next !== null) onValueChange(next);
      }}
      className={className}
      {...rest}
    />
  );
}
