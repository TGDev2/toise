import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';

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
  /** Pièce d'origine (ENG-2). Absent → estimation mono-pièce (legacy/public). */
  room_id?: string;
  room_name?: string;
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
 * la quantité totale continue. `ceil(Σ) ≤ Σ ceil` → mutualiser ne coûte jamais
 * plus de conditionnements.
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
  room_count: number;
  contributions: PurchaseContribution[];
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
