import type { BudgetSummary } from './shopping-list-types';

/**
 * DATA-5 — miroir web de `apps/api/src/shopping-lists/closeout.ts`.
 *
 * Ce que l'écran affirme sur un délai de reprise vient toujours du serveur,
 * jamais d'une constante locale : la seule source des conditions est
 * `return-policies.ts`, dont chaque entrée porte son URL et sa date de relevé.
 */

/** Ce qu'on peut dire de la reprise d'une ligne en surplus. */
export type Returnability =
  /** Enseigne connue, catégorie sans restriction publiée. */
  | 'likely'
  /** Catégorie couramment exclue (peinture teintée, pot ouvert). */
  | 'restricted'
  /** Enseigne non renseignée ou hors catalogue : aucun délai affirmé. */
  | 'unknown';

export interface CloseoutPolicyRef {
  slug: string;
  label: string;
  window_days: number | null;
  loyalty_window_days: number | null;
  loyalty_program: string | null;
  conditions_fr: string[];
  excluded_fr: string[];
  source_url: string;
  verified_on: string;
}

export interface CloseoutLine {
  kind: 'material' | 'complementary';
  item_id: string;
  name: string;
  unit_label: string;
  estimated_units: number;
  purchased_units: number | null;
  is_declared: boolean;
  surplus_units: number;
  surplus_volume: number | null;
  shortfall_units: number;
  real_unit_price: number | null;
  store_name: string | null;
  surplus_value: number | null;
  returnability: Returnability;
  policy: CloseoutPolicyRef | null;
  restriction_reason: string | null;
  return_deadline: string | null;
  days_remaining: number | null;
  estimated_waste_percent: number | null;
  implied_waste_percent: number | null;
  packaging_floor_percent: number | null;
  waste_delta_points: number | null;
}

export interface CloseoutSummary {
  purchased_on: string | null;
  lines: CloseoutLine[];
  lines_total: number;
  lines_declared: number;
  surplus_lines: number;
  /** Ce qui reste sur les bras : tout le surplus chiffré. */
  surplus_value_total: number;
  /** Ce qui est encore reprenable : enseigne connue, catégorie sans réserve. */
  recoverable_amount: number;
  /** Surplus de catégorie couramment exclue, annoncé sous réserve. */
  restricted_amount: number;
  /** Surplus dont l'enseigne est inconnue : aucune reprise affirmée. */
  unknown_amount: number;
  unpriced_surplus_lines: number;
  earliest_deadline: string | null;
  unknown_retailers: string[];
  computed_at: string;
}

export interface CloseoutResponse {
  closeout: CloseoutSummary;
  budget_summary: BudgetSummary | null;
  is_finalized: boolean;
}

export interface CloseoutRequest {
  purchased_on?: string;
  material_items?: { material_id: string; purchased_units: number }[];
  complementary_items?: {
    complementary_material_id: string;
    purchased_quantity: number;
  }[];
}

/** `1 234,50 EUR` — même graphie ASCII que le reste des écrans budget. */
export function formatEuros(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} EUR`;
}

/** `15/07/2026` depuis un `yyyy-mm-dd`, sans passer par un fuseau. */
export function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}
