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
  is_manually_adjusted: boolean;
  // ENG-2 : nombre de pièces mutualisées sur cette ligne (≥ 2 → « N pièces »).
  room_count?: number;
  // Legacy : présent sur les listes générées avant la mutualisation ENG-2.
  work_item_id?: string;
  real_unit_price?: number | null;
  store_name?: string | null;
  // CV-5 : fourchette basse/haute propagée depuis l'incertitude de mesure CV.
  units_needed_low?: number;
  units_needed_high?: number;
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
