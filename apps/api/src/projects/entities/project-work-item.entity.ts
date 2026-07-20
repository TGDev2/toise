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
import { Room } from './room.entity';
import { WorkType } from './work-type.entity';

export enum SkillLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  EXPERT = 'expert',
}

/**
 * Travaux d'une pièce (ENG-2 : rattachés à `room_id`, plus au projet). Table et
 * classe conservées sous le nom historique `project_work_items` pour limiter le
 * churn ; l'unicité est désormais (room_id, work_type_id).
 */
@Entity('project_work_items')
@Unique(['room_id', 'work_type_id'])
export class ProjectWorkItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  room_id!: string;

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

  @ManyToOne(() => Room, (r) => r.workItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room!: Room;

  @ManyToOne(() => WorkType, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'work_type_id' })
  work_type!: WorkType;
}
