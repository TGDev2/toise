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
  /**
   * E1-8 — pourquoi cette ligne est là, quand sa présence même résulte d'une
   * condition (aujourd'hui : le film pare-vapeur). Sa jumelle est
   * `MaterialExclusion.reason_fr`, qui dit pourquoi une ligne n'y est pas.
   */
  inclusion_reason_fr?: string;
  /**
   * E1-8 — pièces à découper, pour un matériau dont les chutes ne se
   * réutilisent pas. Sa présence dit que `units_needed` vient d'un comptage et
   * non d'une division par la longueur de barre.
   */
  pieces_needed?: number;
  piece_length_m?: number;
  pieces_per_bar?: number;
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

/**
 * E1-8 — un matériau lié à l'ouvrage que le chantier ne demande pas, et
 * pourquoi.
 *
 * Le motif arrive **rédigé** du serveur. Le traduire ici depuis `reason_code`
 * écrirait la règle une seconde fois, dans une seconde langue de programme,
 * avec une seconde occasion de diverger — c'est la leçon des tables recopiées
 * (raccord de motif, largeur de joint) que ce dépôt a déjà payée.
 */
export interface MaterialExclusion {
  work_item_id: string;
  work_type_code: string;
  work_type_label: string;
  material_id: string;
  material_name: string;
  reason_code: string;
  reason_fr: string;
  room_id?: string;
  room_name?: string;
}

export interface EstimationResponse {
  id: string;
  project_id: string;
  skill_level: string;
  created_at: string;
  total_items: number;
  items: EstimationLineItem[];
  /** `null` sur une estimation antérieure à E1-8 ; `[]` si rien n'est écarté. */
  exclusions_json?: MaterialExclusion[] | null;
}
