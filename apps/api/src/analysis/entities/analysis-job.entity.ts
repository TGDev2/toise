import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';

export enum AnalysisJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('analysis_jobs')
export class AnalysisJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  project_id!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: AnalysisJobStatus.PENDING,
  })
  status!: AnalysisJobStatus;

  @Column({ type: 'smallint', default: 0 })
  progress_pct!: number;

  @Column({ type: 'jsonb', nullable: true, default: null })
  result_json!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true, default: null })
  error_message!: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  started_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  completed_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;
}
