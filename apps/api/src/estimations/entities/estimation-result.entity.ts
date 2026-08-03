import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';

/**
 * Un format et son nombre de contenants dans un achat panaché (E1-5).
 * Miroir de `PackagingUnits` du moteur, redéclaré ici pour que le contrat
 * persisté ne dépende pas d'un type interne au calcul.
 */
export interface PackagingUnitsLine {
  label: string;
  units: number;
}

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
  /**
   * Libellé de l'achat : le format seul, ou l'assortiment composé quand
   * plusieurs formats sont panachés (« Pot 5 L + Pot 2.5 L », E1-5).
   */
  packaging_label: string;
  /**
   * Contenu moyen par contenant. Égal au format exact tant qu'un seul format
   * est retenu ; sur un achat panaché, c'est la valeur qui garde vrai
   * `units_needed × packaging_qty_per_unit = volume acheté`.
   */
  packaging_qty_per_unit: number;
  /** Nombre total de contenants, tous formats confondus. */
  units_needed: number;
  /**
   * Détail de l'achat quand plusieurs formats sont panachés (E1-5), du plus
   * grand au plus petit. Absent sur un achat à format unique — le couple
   * (`packaging_label`, `units_needed`) le dit alors entièrement — et sur toute
   * ligne calculée avant E1-5.
   */
  packaging_breakdown?: PackagingUnitsLine[];
  pose_type: string;
  number_of_coats?: number;
  /** Aire déduite via les exclusions manuelles (ENG-3). Absent/0 → aucune. */
  excluded_surface_m2?: number;
  /** Pièce d'origine (ENG-2). Absent → estimation mono-pièce (legacy/public). */
  room_id?: string;
  room_name?: string;
  /**
   * Fourchette basse/haute (CV-5), présente uniquement si la pièce porte une
   * incertitude de mesure connue (dimensions `source='cv'`). Absente pour une
   * pièce en saisie manuelle ou une ligne antérieure à cette fonctionnalité.
   */
  surface_m2_low?: number;
  surface_m2_high?: number;
  adjusted_qty_low?: number;
  adjusted_qty_high?: number;
  units_needed_low?: number;
  units_needed_high?: number;
}

/**
 * Contribution d'une (pièce × work item) à la demande agrégée d'un matériau.
 * Conserve la traçabilité par pièce (affichage + coût « brut » du budget).
 */
export interface PurchaseContribution {
  room_id?: string;
  room_name?: string;
  work_item_id: string;
  work_type_code: string;
  surface_m2: number;
  adjusted_qty: number;
}

/**
 * Ligne d'achat mutualisée (ENG-2) : un matériau, sommé sur toutes les pièces
 * et tous les work items, avec le conditionnement choisi **une seule fois** sur
 * la quantité totale continue — donc jamais plus cher qu'un achat pièce par
 * pièce, au sens du critère d'E1-5. En nombre de contenants, en revanche,
 * l'achat mutualisé peut être plus grand : cf. `EstimationEngine.aggregatePurchases`.
 */
export interface AggregatedMaterialLine {
  material_id: string;
  material_name: string;
  material_unit: string;
  work_type_code: string;
  work_type_label: string;
  total_adjusted_qty: number;
  packaging_label: string;
  packaging_qty_per_unit: number;
  units_needed: number;
  /** Cf. `EstimationLineItem.packaging_breakdown` (E1-5). */
  packaging_breakdown?: PackagingUnitsLine[];
  room_count: number;
  contributions: PurchaseContribution[];
  /**
   * Fourchette basse/haute (CV-5) : conditionnement sélectionné indépendamment
   * sur la somme basse et la somme haute des contributions (même logique que
   * `units_needed`, recalculée sur le total plutôt que sommée ligne à ligne).
   * Présente seulement si au moins une contribution porte une fourchette.
   */
  units_needed_low?: number;
  units_needed_high?: number;
}

@Entity('estimation_results')
export class EstimationResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  project_id!: string;

  @Column({ type: 'varchar', length: 20 })
  skill_level!: string;

  @Column({ type: 'jsonb' })
  items_json!: EstimationLineItem[];

  /**
   * Plan d'achat mutualisé (ENG-2) : 1 ligne par matériau, conditionnement
   * choisi une fois sur la quantité sommée. `null` pour les estimations
   * antérieures à ENG-2 (la liste d'achats retombe alors sur `items_json`).
   */
  @Column({ type: 'jsonb', nullable: true, default: null })
  aggregated_json!: AggregatedMaterialLine[] | null;

  @Column({ type: 'integer', default: 0 })
  total_items!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;
}
