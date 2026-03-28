export interface ShoppingListMaterialItem {
  material_id: string;
  work_item_id: string;
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
