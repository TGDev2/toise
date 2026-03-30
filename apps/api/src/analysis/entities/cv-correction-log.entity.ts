import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { AnalysisJob } from './analysis-job.entity';

@Entity('cv_correction_logs')
export class CvCorrectionLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  project_id!: string;

  @Column({ type: 'uuid' })
  analysis_job_id!: string;

  @Column({ type: 'varchar', length: 20 })
  entity_type!: string; // 'dimension' | 'opening'

  @Column({ type: 'varchar', length: 30, nullable: true })
  field!: string | null;

  @Column({ type: 'jsonb' })
  cv_value!: unknown;

  @Column({ type: 'jsonb' })
  user_value!: unknown;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @ManyToOne(() => AnalysisJob, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'analysis_job_id' })
  analysis_job!: AnalysisJob;
}
