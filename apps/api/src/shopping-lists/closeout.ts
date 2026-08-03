/**
 * BACKLOG DATA-5 : clôture de chantier — ce qui reste sur les bras, ce qui est
 * encore reprenable, et l'écart entre l'estimation et la réalité.
 *
 * Module pur, sans I/O ni dépendance Nest : c'est le seul étage où se décide
 * ce que l'écran affirme à l'utilisateur, donc le seul qui doive être
 * entièrement testable sans base.
 *
 * Trois partis pris, tous dans le même sens — ne jamais annoncer plus que ce
 * qu'on sait :
 *
 * 1. **Le surplus se compte contre l'estimation, pas contre la consommation.**
 *    Personne ne déclare ce qu'il a ouvert. Les conditionnements achetés
 *    au-delà de ce que l'estimation prévoyait sont les seuls dont on puisse
 *    dire qu'ils n'ont pas été nécessaires — et encore, sous réserve qu'ils
 *    soient restés fermés. L'écran le formule comme une condition, pas comme
 *    un constat.
 * 2. **Une catégorie couramment exclue ne compte pas dans le montant annoncé.**
 *    La peinture part dans un total « sous réserve » distinct.
 * 3. **L'arrondi au conditionnement n'est pas imputé à l'utilisateur.**
 *    `packaging_floor_percent` donne le taux de perte qu'il aurait eu en
 *    achetant exactement l'estimation. Sans lui, un carrelage vendu au carton
 *    de 1,44 m² ferait passer l'arrondi pour de la négligence.
 */

import {
  RESTRICTED_CATEGORIES,
  matchReturnPolicy,
  returnDeadline,
  type ReturnPolicy,
} from './return-policies';

/** Ce qu'on peut dire de la reprise d'une ligne en surplus. */
export type Returnability =
  /** Enseigne connue, catégorie sans restriction publiée. */
  | 'likely'
  /** Catégorie couramment exclue (peinture teintée, pot ouvert). */
  | 'restricted'
  /** Enseigne non renseignée ou absente du catalogue : aucun délai affirmé. */
  | 'unknown';

export interface CloseoutMaterialInput {
  material_id: string;
  material_name: string;
  material_category: string;
  material_unit: string;
  packaging_label: string;
  packaging_qty_per_unit: number;
  /** Conditionnements prévus par l'estimation (avant toute correction). */
  estimated_units: number;
  /** Conditionnements déclarés achetés. `null` = pas encore déclaré. */
  purchased_units: number | null;
  real_unit_price: number | null;
  store_name: string | null;
  /** Besoin net issu de l'estimation, hors perte. `null` si indisponible. */
  theoretical_qty: number | null;
  /** Facteur de perte appliqué par le moteur. `null` si non déterminable. */
  estimated_waste_percent: number | null;
}

export interface CloseoutComplementaryInput {
  complementary_material_id: string;
  name: string;
  unit_label: string;
  estimated_quantity: number;
  purchased_quantity: number | null;
  real_unit_price: number | null;
  store_name: string | null;
}

export interface CloseoutPolicyRef {
  slug: string;
  label: string;
  window_days: number | null;
  loyalty_window_days: number | null;
  loyalty_program: string | null;
  conditions_fr: readonly string[];
  excluded_fr: readonly string[];
  source_url: string;
  verified_on: string;
}

export interface CloseoutLine {
  kind: 'material' | 'complementary';
  /** `material_id` ou `complementary_material_id` selon `kind`. */
  item_id: string;
  name: string;
  unit_label: string;
  estimated_units: number;
  purchased_units: number | null;
  /** `true` dès que l'utilisateur a déclaré une quantité pour cette ligne. */
  is_declared: boolean;
  /** Conditionnements achetés au-delà de l'estimation. */
  surplus_units: number;
  /** Volume correspondant, dans l'unité du matériau. */
  surplus_volume: number | null;
  /** Manque déclaré : l'utilisateur a acheté moins que prévu. */
  shortfall_units: number;
  real_unit_price: number | null;
  store_name: string | null;
  /** Montant du surplus, `null` sans prix connu. Hors total si `restricted`. */
  surplus_value: number | null;
  returnability: Returnability;
  policy: CloseoutPolicyRef | null;
  /** Motif publié de la restriction de catégorie, le cas échéant. */
  restriction_reason: string | null;
  return_deadline: string | null;
  days_remaining: number | null;
  estimated_waste_percent: number | null;
  /** Perte impliquée par l'achat, si tout ce qui a été ouvert a été consommé. */
  implied_waste_percent: number | null;
  /** Perte minimale imposée par le conditionnement, à estimation respectée. */
  packaging_floor_percent: number | null;
  /** `implied - estimated`, en points. Positif = plus de marge que prévu. */
  waste_delta_points: number | null;
}

export interface CloseoutSummary {
  purchased_on: string | null;
  lines: CloseoutLine[];
  lines_total: number;
  lines_declared: number;
  /** Lignes déclarées avec un surplus, toutes catégories confondues. */
  surplus_lines: number;
  /**
   * « Ce qui me reste sur les bras » : valeur de tout le surplus chiffré,
   * quelle que soit la reprenabilité. C'est la première des deux questions de
   * l'utilisateur, et la seule à laquelle on réponde toujours.
   */
  surplus_value_total: number;
  /**
   * « Ce que je peux encore rendre » : la part du surplus dont l'enseigne est
   * connue et la catégorie sans restriction publiée. Sous-ensemble strict de
   * `surplus_value_total` — les trois montants qui suivent le partitionnent.
   */
  recoverable_amount: number;
  /** Surplus de catégorie couramment exclue : annoncé à part, sous réserve. */
  restricted_amount: number;
  /** Surplus dont l'enseigne est inconnue : aucune reprise n'est affirmée. */
  unknown_amount: number;
  /** Lignes en surplus sans prix connu : un compte, pas un montant. */
  unpriced_surplus_lines: number;
  /** Échéance la plus proche parmi les lignes en surplus. */
  earliest_deadline: string | null;
  /** Enseignes en surplus absentes du catalogue : aucun délai affirmé. */
  unknown_retailers: string[];
  computed_at: string;
}

/**
 * Quantité réellement achetée pour une ligne, ou `null` si rien n'a été
 * déclaré. Source unique de la question « qu'a acheté l'utilisateur ? » —
 * DATA-3 et DATA-4 la posent tous les deux et doivent recevoir la même
 * réponse.
 *
 * Le repli sur `units_needed` ne vaut que pour une ligne **corrigée à la
 * main** avant DATA-5 : c'était alors la seule trace d'un achat réel. Une
 * ligne intacte n'a jamais été une observation, et la compter comme
 * « estimé == acheté » revenait à faire confirmer le catalogue par le silence.
 * C'est ce biais que la déclaration explicite supprime.
 */
export function declaredPurchasedUnits(item: {
  purchased_units?: number | null;
  units_needed: number;
  is_manually_adjusted: boolean;
}): number | null {
  if (item.purchased_units != null) {
    return item.purchased_units;
  }
  return item.is_manually_adjusted ? item.units_needed : null;
}

/** Quantité valorisée d'une ligne, et d'où elle vient. */
export interface CostedQuantity {
  units: number;
  /** `true` quand la quantité vient d'une déclaration de l'utilisateur. */
  is_declared: boolean;
}

/**
 * E1-8 — **la** référence de quantité de tout calcul de coût : la quantité
 * déclarée quand elle existe, la quantité prévue sinon.
 *
 * Deux formules valorisaient jusqu'ici deux quantités différentes — le tableau
 * de bord multipliait le prix par `units_needed` (la liste de courses), le
 * benchmark par la quantité déclarée — et affichaient les deux résultats sous
 * le même mot, « coût réel ». Un chantier clôturé portait donc deux totaux
 * contradictoires sur le même écran.
 *
 * `is_declared` porte la nuance que le nombre seul ne peut pas porter : sans
 * déclaration, le montant reste une prévision. Les appelants qui **publient**
 * un coût (benchmark DATA-4, cohorte inter-organisations) exigent le drapeau ;
 * ceux qui montrent son budget à l'utilisateur se contentent du repli, parce
 * qu'un écran vide avant la clôture ne rend service à personne.
 */
export function costedUnits(item: {
  purchased_units?: number | null;
  units_needed: number;
  is_manually_adjusted: boolean;
}): CostedQuantity {
  const declared = declaredPurchasedUnits(item);
  return declared === null
    ? { units: item.units_needed, is_declared: false }
    : { units: declared, is_declared: true };
}

/**
 * Pendant de `costedUnits` pour les consommables, qui n'ont ni conditionnement
 * ni correction manuelle : la quantité déclarée, ou celle du forfait.
 */
export function costedComplementaryQuantity(item: {
  purchased_quantity?: number | null;
  quantity: number;
}): CostedQuantity {
  return item.purchased_quantity != null
    ? { units: item.purchased_quantity, is_declared: true }
    : { units: item.quantity, is_declared: false };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function toPolicyRef(policy: ReturnPolicy): CloseoutPolicyRef {
  return {
    slug: policy.slug,
    label: policy.label,
    window_days: policy.window_days,
    loyalty_window_days: policy.loyalty_window_days,
    loyalty_program: policy.loyalty_program,
    conditions_fr: policy.conditions_fr,
    excluded_fr: policy.excluded_fr,
    source_url: policy.source_url,
    verified_on: policy.verified_on,
  };
}

function daysBetween(fromIso: string, toIso: string): number | null {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) {
    return null;
  }
  return Math.round((to - from) / 86_400_000);
}

/**
 * Taux de perte impliqué par un volume acheté face au besoin net.
 *
 * `null` dès que le besoin net est inconnu ou nul : une division par zéro
 * rendrait `Infinity`, qu'un écran afficherait consciencieusement.
 */
function wastePercent(
  volume: number,
  theoreticalQty: number | null,
): number | null {
  if (theoreticalQty === null || theoreticalQty <= 0) {
    return null;
  }
  return round1((volume / theoreticalQty - 1) * 100);
}

function buildMaterialLine(
  input: CloseoutMaterialInput,
  purchasedOn: string | null,
  today: string,
): CloseoutLine {
  const isDeclared = input.purchased_units !== null;
  const purchased = input.purchased_units ?? 0;
  const surplus = isDeclared
    ? Math.max(0, purchased - input.estimated_units)
    : 0;
  const shortfall = isDeclared
    ? Math.max(0, input.estimated_units - purchased)
    : 0;

  const policy = matchReturnPolicy(input.store_name);
  const restriction = RESTRICTED_CATEGORIES[input.material_category] ?? null;

  let returnability: Returnability = 'unknown';
  if (restriction !== null) {
    returnability = 'restricted';
  } else if (policy !== null) {
    returnability = 'likely';
  }

  const deadline =
    policy !== null && purchasedOn !== null
      ? returnDeadline(policy, purchasedOn)
      : null;

  const surplusValue =
    surplus > 0 && input.real_unit_price !== null
      ? round2(surplus * input.real_unit_price)
      : null;

  const impliedWaste = isDeclared
    ? wastePercent(
        purchased * input.packaging_qty_per_unit,
        input.theoretical_qty,
      )
    : null;
  const packagingFloor = wastePercent(
    input.estimated_units * input.packaging_qty_per_unit,
    input.theoretical_qty,
  );

  return {
    kind: 'material',
    item_id: input.material_id,
    name: input.material_name,
    unit_label: input.packaging_label,
    estimated_units: input.estimated_units,
    purchased_units: input.purchased_units,
    is_declared: isDeclared,
    surplus_units: surplus,
    surplus_volume:
      surplus > 0 ? round2(surplus * input.packaging_qty_per_unit) : null,
    shortfall_units: shortfall,
    real_unit_price: input.real_unit_price,
    store_name: input.store_name,
    surplus_value: surplusValue,
    returnability,
    policy: policy === null ? null : toPolicyRef(policy),
    restriction_reason: restriction,
    return_deadline: deadline,
    days_remaining: deadline === null ? null : daysBetween(today, deadline),
    estimated_waste_percent: input.estimated_waste_percent,
    implied_waste_percent: impliedWaste,
    packaging_floor_percent: packagingFloor,
    waste_delta_points:
      impliedWaste !== null && input.estimated_waste_percent !== null
        ? round1(impliedWaste - input.estimated_waste_percent)
        : null,
  };
}

function buildComplementaryLine(
  input: CloseoutComplementaryInput,
  purchasedOn: string | null,
  today: string,
): CloseoutLine {
  const isDeclared = input.purchased_quantity !== null;
  const purchased = input.purchased_quantity ?? 0;
  const surplus = isDeclared
    ? Math.max(0, purchased - input.estimated_quantity)
    : 0;
  const shortfall = isDeclared
    ? Math.max(0, input.estimated_quantity - purchased)
    : 0;

  const policy = matchReturnPolicy(input.store_name);
  const deadline =
    policy !== null && purchasedOn !== null
      ? returnDeadline(policy, purchasedOn)
      : null;

  return {
    kind: 'complementary',
    item_id: input.complementary_material_id,
    name: input.name,
    unit_label: input.unit_label,
    estimated_units: input.estimated_quantity,
    purchased_units: input.purchased_quantity,
    is_declared: isDeclared,
    surplus_units: surplus,
    surplus_volume: null,
    shortfall_units: shortfall,
    real_unit_price: input.real_unit_price,
    store_name: input.store_name,
    surplus_value:
      surplus > 0 && input.real_unit_price !== null
        ? round2(surplus * input.real_unit_price)
        : null,
    returnability: policy !== null ? 'likely' : 'unknown',
    policy: policy === null ? null : toPolicyRef(policy),
    restriction_reason: null,
    return_deadline: deadline,
    days_remaining: deadline === null ? null : daysBetween(today, deadline),
    estimated_waste_percent: null,
    implied_waste_percent: null,
    packaging_floor_percent: null,
    waste_delta_points: null,
  };
}

/**
 * Assemble la réponse de clôture.
 *
 * `today` est injecté plutôt que lu : sans cela, « il vous reste 12 jours »
 * serait la seule affirmation de l'écran qu'aucun test ne pourrait fixer.
 */
export function computeCloseout(
  materials: readonly CloseoutMaterialInput[],
  complementaries: readonly CloseoutComplementaryInput[],
  purchasedOn: string | null,
  today: string,
): CloseoutSummary {
  const lines = [
    ...materials.map((item) => buildMaterialLine(item, purchasedOn, today)),
    ...complementaries.map((item) =>
      buildComplementaryLine(item, purchasedOn, today),
    ),
  ];

  let recoverable = 0;
  let restricted = 0;
  let unknown = 0;
  let unpricedSurplusLines = 0;
  let surplusLines = 0;
  let earliest: string | null = null;
  const unknownRetailers = new Set<string>();

  for (const line of lines) {
    if (line.surplus_units <= 0) {
      continue;
    }
    surplusLines++;

    if (line.surplus_value === null) {
      unpricedSurplusLines++;
    } else if (line.returnability === 'restricted') {
      restricted += line.surplus_value;
    } else if (line.returnability === 'likely') {
      recoverable += line.surplus_value;
    } else {
      unknown += line.surplus_value;
    }

    if (line.returnability === 'unknown' && line.store_name) {
      unknownRetailers.add(line.store_name);
    }

    if (
      line.return_deadline !== null &&
      (earliest === null || line.return_deadline < earliest)
    ) {
      earliest = line.return_deadline;
    }
  }

  return {
    purchased_on: purchasedOn,
    lines,
    lines_total: lines.length,
    lines_declared: lines.filter((line) => line.is_declared).length,
    surplus_lines: surplusLines,
    surplus_value_total: round2(recoverable + restricted + unknown),
    recoverable_amount: round2(recoverable),
    restricted_amount: round2(restricted),
    unknown_amount: round2(unknown),
    unpriced_surplus_lines: unpricedSurplusLines,
    earliest_deadline: earliest,
    unknown_retailers: Array.from(unknownRetailers).sort(),
    computed_at: new Date().toISOString(),
  };
}
