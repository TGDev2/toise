/**
 * BACKLOG E1-8 : le budget réel d'un chantier — ce qui a été dépensé, et ce que
 * la mutualisation des achats a évité de dépenser.
 *
 * Module pur, sans I/O ni dépendance Nest, pour la même raison que `closeout.ts` :
 * c'est ici que se décide un montant en euros affiché à l'utilisateur, puis
 * publié à la communauté. Ce qu'on ne peut pas tester sans base ne se relit pas.
 *
 * Deux partis pris, tous deux hérités d'un défaut constaté :
 *
 * 1. **Une seule quantité valorisée** — celle de `costedUnits` : la déclarée
 *    quand elle existe, la prévue sinon. Ce calcul multipliait le prix réel par
 *    `units_needed` pendant que le benchmark de coûts (DATA-4) le multipliait
 *    par la quantité déclarée : deux « coûts réels » contradictoires pour le
 *    même chantier, à deux endroits du même écran.
 *
 * 2. **L'économie annoncée ne dépend plus du niveau de compétence.** Elle
 *    comparait un achat fictif à 10 % de perte forfaitaire à l'achat réel, qui
 *    porte le facteur du niveau déclaré. Un débutant (15 %) se voyait donc
 *    annoncer une économie **négative** — l'écran lui reprochait d'avoir prévu
 *    la casse — et un expert (5 %) une économie qui n'était que la trace d'une
 *    case cochée dans un formulaire. Aucune des deux n'était un fait.
 *
 *    Ce qui reste, et qui est un fait : à facteur de perte, format et prix
 *    **identiques**, acheter une fois pour tout le chantier coûte moins cher
 *    qu'acheter pièce par pièce, parce que l'arrondi au conditionnement n'est
 *    payé qu'une fois (ENG-2). C'est cet écart, et lui seul, que l'écran appelle
 *    désormais une économie. Il est nul quand le chantier n'a qu'une pièce —
 *    c'est alors la vérité, pas une régression — et il l'est aussi, plus
 *    rarement, quand le panachage d'E1-5 préfère plus de contenants pour moins
 *    de volume (cf. `poolingExtraUnits`).
 *
 *    Le facteur de perte est délibérément hors de la comparaison : c'est une
 *    posture de risque que l'utilisateur choisit, pas un gain que l'outil
 *    produit. Acheter moins parce qu'on se déclare expert n'est une économie
 *    que jusqu'au second aller-retour au magasin. Le panachage des formats
 *    (E1-5) en est exclu pour une raison différente : on ne connaît qu'un prix
 *    par ligne, donc valoriser un assortiment de formats non achetés
 *    supposerait des prix qu'on n'a pas.
 *
 * Invariant tenu par construction : `total_brute_cost = total_real_cost +
 * savings_amount`, avec `savings_amount ≥ 0`. Les trois cartes de l'écran
 * s'additionnent, quel que soit le niveau de compétence.
 */

import type {
  BudgetSummary,
  CategoryBreakdown,
  ShoppingListData,
} from './entities/shopping-list.entity';
import { costedComplementaryQuantity, costedUnits } from './closeout';

const CATEGORY_LABELS: Record<string, string> = {
  painting: 'Peinture',
  tiling: 'Carrelage',
  flooring: 'Parquet / Sol',
  partition: 'Cloison',
  wall_covering: 'Revêtement mural',
};

/**
 * Ce que le budget lit d'une ligne d'estimation : la quantité déjà majorée du
 * facteur de perte, pièce par pièce. Sous-ensemble structurel d'
 * `EstimationLineItem` — le module n'a besoin de rien d'autre.
 */
export interface BudgetEstimationLine {
  material_id: string;
  adjusted_qty: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Conditionnements que l'achat pièce par pièce aurait coûtés **en plus** de
 * l'achat mutualisé, pour un matériau.
 *
 * Le contrefactuel garde tout constant sauf la granularité de l'arrondi : même
 * besoin par pièce (`adjusted_qty`, facteur de perte du niveau déjà appliqué
 * par le moteur), même format que celui réellement acheté. Ne subsiste que
 * l'effet mesuré — l'arrondi payé une fois plutôt qu'à chaque pièce.
 *
 * `original_units_needed` sert de référence mutualisée, et non `units_needed` :
 * une correction manuelle de l'utilisateur ne doit pas se transformer en
 * économie attribuée à l'outil.
 */
function poolingExtraUnits(
  item: {
    material_id: string;
    packaging_qty_per_unit: number;
    original_units_needed?: number;
    units_needed: number;
  },
  lineQtysByMaterial: Map<string, number[]>,
): number {
  const qtys = lineQtysByMaterial.get(item.material_id);
  // Une seule ligne d'estimation → rien n'a été mutualisé, il n'y a rien à
  // compter (c'est aussi le cas des listes antérieures à ENG-2, générées en
  // 1:1 depuis les lignes granulaires).
  if (!qtys || qtys.length < 2) return 0;

  const packaging = item.packaging_qty_per_unit;
  if (!(packaging > 0)) return 0;

  const naiveUnits = qtys.reduce(
    (sum, qty) => sum + Math.ceil(Math.max(0, qty) / packaging),
    0,
  );
  const pooledUnits = item.original_units_needed ?? item.units_needed;

  // `max(0, …)` : le moteur choisit son assortiment au coût minimal (E1-5) et
  // peut retenir plus de contenants que l'achat pièce par pièce. Ce n'est pas
  // une hypothèse d'école — le harnais E1-9 en trouve deux occurrences sur le
  // catalogue réel, dont une peinture murale de débutant sur deux pièces
  // (`estimations/__tests__/two-room-project.spec.ts`). Une économie négative
  // n'est pas une économie.
  return Math.max(0, naiveUnits - pooledUnits);
}

/**
 * Résumé budgétaire d'une liste d'achats.
 *
 * `estimationItems` sont les lignes **granulaires** de l'estimation (une par
 * pièce × ouvrage) : elles portent le contrefactuel de l'achat non mutualisé.
 * La liste, elle, ne porte que le résultat déjà mutualisé.
 */
export function computeBudgetSummary(
  items: ShoppingListData,
  estimationItems: readonly BudgetEstimationLine[],
): BudgetSummary {
  const lineQtysByMaterial = new Map<string, number[]>();
  for (const line of estimationItems) {
    const qtys = lineQtysByMaterial.get(line.material_id);
    if (qtys) {
      qtys.push(line.adjusted_qty);
    } else {
      lineQtysByMaterial.set(line.material_id, [line.adjusted_qty]);
    }
  }

  const categoryTotals = new Map<
    string,
    { real_cost: number; brute_cost: number }
  >();
  let totalRealCost = 0;
  let totalSavings = 0;
  let itemsPriced = 0;

  const materialItems = items.material_items;
  const complementaryItems = items.complementary_items.filter(
    (c) => !c.is_removed,
  );

  for (const item of materialItems) {
    if (item.real_unit_price == null) continue;
    itemsPriced++;

    const realCost = item.real_unit_price * costedUnits(item).units;
    const savings =
      item.real_unit_price * poolingExtraUnits(item, lineQtysByMaterial);
    totalRealCost += realCost;
    totalSavings += savings;

    const cat = item.material_category;
    const existing = categoryTotals.get(cat) || { real_cost: 0, brute_cost: 0 };
    existing.real_cost += realCost;
    existing.brute_cost += realCost + savings;
    categoryTotals.set(cat, existing);
  }

  // Les consommables sont des forfaits, sans conditionnement ni pièce
  // d'origine : rien à mutualiser, donc coût brut = coût réel.
  for (const item of complementaryItems) {
    if (item.real_unit_price == null) continue;
    itemsPriced++;
    totalRealCost +=
      item.real_unit_price * costedComplementaryQuantity(item).units;
  }

  const totalBruteCost = totalRealCost + totalSavings;
  const savingsAmount = round2(totalSavings);
  const savingsPercent =
    totalBruteCost > 0
      ? Math.round((totalSavings / totalBruteCost) * 10000) / 100
      : 0;

  const byCategory: CategoryBreakdown[] = Array.from(
    categoryTotals.entries(),
  ).map(([category, totals]) => ({
    category,
    label: CATEGORY_LABELS[category] || category,
    real_cost: round2(totals.real_cost),
    brute_cost: round2(totals.brute_cost),
  }));

  return {
    total_real_cost: round2(totalRealCost),
    total_brute_cost: round2(totalBruteCost),
    savings_amount: savingsAmount,
    savings_percent: savingsPercent,
    items_priced: itemsPriced,
    items_total: materialItems.length + complementaryItems.length,
    is_complete:
      itemsPriced === materialItems.length + complementaryItems.length,
    by_category: byCategory,
    computed_at: new Date().toISOString(),
  };
}
