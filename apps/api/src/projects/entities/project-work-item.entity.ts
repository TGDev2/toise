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
import { numericTransformer } from '../../common/transformers/numeric.transformer';

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

  /**
   * E1-2 — assiette saisie, uniquement significative quand
   * `work_type.quantity_basis === 'declared'` (aujourd'hui : `drywall`
   * seulement). `NULL` signifie « pas encore déclaré » — jamais un repli
   * implicite vers la hauteur de la pièce ou une autre valeur calculée : ce
   * champ ne porte qu'un seul sens (leçon du dépôt sur `units_needed`, voir
   * `tasks/lessons.md` §18).
   */
  @Column({
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  declared_length_m!: number | null;

  @Column({
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  declared_height_m!: number | null;

  /** Nombre de faces à parementer : 1 (doublage) ou 2 (cloison). */
  @Column({ type: 'smallint', nullable: true })
  declared_clad_faces!: number | null;

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
