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

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @OneToOne(() => Project, (p) => p.dimensions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;
}
