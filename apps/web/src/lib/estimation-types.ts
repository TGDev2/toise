export interface EstimationLineItem {
  work_item_id: string;
  work_type_code: string;
  work_type_label: string;
  material_id: string;
  material_name: string;
  material_unit: string;
  gross_surface_m2: number;
  surface_m2: number;
  theoretical_qty: number;
  waste_factor_percent: number;
  waste_factor_source: 'catalog' | 'default';
  adjusted_qty: number;
  packaging_label: string;
  packaging_qty_per_unit: number;
  units_needed: number;
  pose_type: string;
  number_of_coats?: number;
}

export interface EstimationResponse {
  id: string;
  project_id: string;
  skill_level: string;
  created_at: string;
  total_items: number;
  items: EstimationLineItem[];
}
