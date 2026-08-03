import type { PackagingUnitsLine } from './packaging';

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
  /** `learned` : facteur recalculé sur les achats réels (DATA-3). */
  waste_factor_source: 'catalog' | 'default' | 'learned';
  adjusted_qty: number;
  /** Le format seul, ou l'assortiment composé s'il y a panachage (E1-5). */
  packaging_label: string;
  /** Contenu moyen par contenant — le format exact tant qu'il n'y en a qu'un. */
  packaging_qty_per_unit: number;
  /** Nombre total de contenants, tous formats confondus. */
  units_needed: number;
  /** E1-5 : détail par format, absent sur un achat à format unique. */
  packaging_breakdown?: PackagingUnitsLine[];
  pose_type: string;
  number_of_coats?: number;
  excluded_surface_m2?: number;
  /** Fourchette basse/haute (CV-5), absente si la pièce n'a pas d'incertitude connue. */
  surface_m2_low?: number;
  surface_m2_high?: number;
  adjusted_qty_low?: number;
  adjusted_qty_high?: number;
  units_needed_low?: number;
  units_needed_high?: number;
}

export interface EstimationResponse {
  id: string;
  project_id: string;
  skill_level: string;
  created_at: string;
  total_items: number;
  items: EstimationLineItem[];
}
