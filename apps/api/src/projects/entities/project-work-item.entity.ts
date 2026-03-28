import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Project } from './project.entity';
import { WorkType } from './work-type.entity';

export enum SkillLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  EXPERT = 'expert',
}

@Entity('project_work_items')
@Unique(['project_id', 'work_type_id'])
export class ProjectWorkItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  project_id!: string;

  @Column({ type: 'uuid' })
  work_type_id!: string;

  @Column({ type: 'varchar', length: 20 })
  skill_level!: SkillLevel;

  @Column({ type: 'jsonb', default: {} })
  custom_params!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @ManyToOne(() => Project, (p) => p.workItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @ManyToOne(() => WorkType, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'work_type_id' })
  work_type!: WorkType;
}
