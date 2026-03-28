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

  @Column({ type: 'integer', default: 0 })
  total_items!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;
}
