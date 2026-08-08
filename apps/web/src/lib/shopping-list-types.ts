import type { PackagingUnitsLine } from './packaging';

export interface ShoppingListMaterialItem {
  material_id: string;
  work_type_code: string;
  work_type_label: string;
  material_name: string;
  material_category: string;
  material_unit: string;
  packaging_label: string;
  packaging_qty_per_unit: number;
  adjusted_qty: number;
  original_units_needed: number;
  units_needed: number;
  // E1-5 : détail par format d'un achat panaché, absent si un format suffit.
  packaging_breakdown?: PackagingUnitsLine[];
  is_manually_adjusted: boolean;
  // DATA-5 : conditionnements réellement achetés, déclarés à la clôture.
  // `null`/absent = rien de déclaré, la ligne n'est encore qu'une prévision.
  purchased_units?: number | null;
  // ENG-2 : nombre de pièces mutualisées sur cette ligne (≥ 2 → « N pièces »).
  room_count?: number;
  // Legacy : présent sur les listes générées avant la mutualisation ENG-2.
  work_item_id?: string;
  real_unit_price?: number | null;
  store_name?: string | null;
  // CV-5 : fourchette basse/haute propagée depuis l'incertitude de mesure CV.
  units_needed_low?: number;
  units_needed_high?: number;
  /**
   * E1-11 — la justification déjà rendue côté API : le ratio, sa source, la
   * règle appliquée à l'exécution. Jamais un objet à interpréter ici — le
   * réglage marques a déjà été tranché avant la réponse
   * (`materials/render-justification.ts`).
   */
  justification_fr?: string;
  /** Lien vers la fiche technique citée. Absent si les marques sont masquées. */
  justification_url?: string;
}

export interface ShoppingListComplementaryItem {
  complementary_material_id: string;
  name: string;
  description_fr: string;
  category: string;
  unit_label: string;
  default_quantity: number;
  quantity: number;
  is_removed: boolean;
  is_calculated?: boolean;
  real_unit_price?: number | null;
  store_name?: string | null;
  // DATA-5 : quantité réellement achetée, déclarée à la clôture.
  purchased_quantity?: number | null;
}

/**
 * E1-8 — la quantité que l'API valorise (`costedUnits`, `budget-summary.ts`) :
 * la déclarée quand elle existe, la prévue sinon. Les totaux de ligne affichés
 * doivent s'additionner jusqu'au total du tableau de bord ; ils montraient la
 * quantité prévue même sur un chantier clôturé, et ne s'y retrouvaient plus.
 */
export function costedUnits(item: ShoppingListMaterialItem): number {
  if (item.purchased_units != null) return item.purchased_units;
  return item.units_needed;
}

/** Pendant de `costedUnits` pour les consommables. */
export function costedQuantity(item: ShoppingListComplementaryItem): number {
  return item.purchased_quantity ?? item.quantity;
}

export interface CategoryBreakdown {
  category: string;
  label: string;
  real_cost: number;
  brute_cost: number;
}

export interface BudgetSummary {
  total_real_cost: number;
  total_brute_cost: number;
  savings_amount: number;
  savings_percent: number;
  items_priced: number;
  items_total: number;
  is_complete: boolean;
  by_category: CategoryBreakdown[];
  computed_at: string;
  // COM-1 : distingue « calculable en direct » (is_complete) de « réellement
  // persisté par finalize() » — regenerate() peut effacer le budget finalisé
  // sans que is_complete ne le signale. Optionnel : absent des snapshots
  // BudgetSummary figés sur une publication communauté (déjà finalisés par
  // construction), présent sur la réponse live de GET .../budget-summary.
  is_finalized?: boolean;
}

export interface ShoppingListResponse {
  id: string;
  project_id: string;
  estimation_id: string;
  is_stale: boolean;
  material_items: ShoppingListMaterialItem[];
  complementary_items: ShoppingListComplementaryItem[];
  created_at: string;
  updated_at: string;
}
