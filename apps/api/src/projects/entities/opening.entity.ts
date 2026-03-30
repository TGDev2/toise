import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from './project.entity';

export enum OpeningType {
  DOOR = 'door',
  WINDOW = 'window',
}

export enum OpeningSource {
  MANUAL = 'manual',
  CV = 'cv',
}

@Entity('openings')
export class Opening {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  project_id!: string;

  @Column({ type: 'varchar', length: 10 })
  type!: OpeningType;

  @Column({ type: 'int' })
  width_cm!: number;

  @Column({ type: 'int' })
  height_cm!: number;

  @Column({ type: 'int', default: 1 })
  count!: number;

  @Column({ type: 'varchar', length: 10, default: OpeningSource.MANUAL })
  source!: OpeningSource;

  @Column({ type: 'real', nullable: true, default: null })
  cv_confidence!: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @ManyToOne(() => Project, (p) => p.openings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;
}
