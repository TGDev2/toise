import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from './project.entity';

export enum ConfidenceScore {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum DimensionSource {
  MANUAL = 'manual',
  SCAN = 'scan',
  IMPORT = 'import',
  CV = 'cv',
}

/**
 * Rectangle composant une pièce non rectangulaire (L, T, U…), vue de dessus.
 * Miroir de `RectSegment` du moteur d'estimation, gardé local à ce module pour
 * ne pas coupler l'entité au module estimations.
 */
export interface RoomSegment {
  x_cm: number;
  y_cm: number;
  length_cm: number;
  width_cm: number;
}

@Entity('room_dimensions')
export class RoomDimensions {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  project_id!: string;

  @Column({ type: 'int' })
  length_cm!: number;

  @Column({ type: 'int' })
  width_cm!: number;

  @Column({ type: 'int' })
  height_cm!: number;

  @Column({ type: 'varchar', length: 10, default: ConfidenceScore.HIGH })
  confidence_score!: ConfidenceScore;

  @Column({ type: 'varchar', length: 10, default: DimensionSource.MANUAL })
  source!: DimensionSource;

  @Column({ type: 'jsonb', nullable: true, default: null })
  raw_cv_output_json!: Record<string, unknown> | null;

  /**
   * Décomposition en rectangles d'une pièce non rectangulaire (ENG-1).
   * `null` → pièce rectangulaire simple `length_cm × width_cm`.
   */
  @Column({ type: 'jsonb', nullable: true, default: null })
  segments_json!: RoomSegment[] | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @OneToOne(() => Project, (p) => p.dimensions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;
}
