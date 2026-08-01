import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Project } from '../../projects/entities/project.entity';
import { Room } from '../../projects/entities/room.entity';
import type { RoomSegment } from '../../projects/entities/room-dimensions.entity';

/** Dimensions figées au moment du chantier (PLAT-1). */
export interface RoomLogDimensionsSnapshot {
  length_cm: number;
  width_cm: number;
  height_cm: number;
  source: string;
  segments_json: RoomSegment[] | null;
}

/** Matériau utilisé dans la pièce, figé au moment du chantier (PLAT-1). */
export interface RoomLogMaterialSnapshot {
  material_id: string;
  material_name: string;
  material_category: string;
  work_type_label: string;
  pose_type: string;
  real_unit_price: number | null;
  store_name: string | null;
}

/**
 * Carnet du logement (PLAT-1) : un instantané par (pièce × chantier terminé),
 * pris par `LogbookService.recordChantierCompletion`. `project_id`/`room_id`
 * en `ON DELETE SET NULL` — le carnet doit survivre à la suppression du
 * projet source ; `project_name`/`room_name` figent donc les libellés tels
 * qu'ils étaient au moment du chantier.
 */
@Entity('room_log_entries')
export class RoomLogEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'uuid', nullable: true })
  project_id!: string | null;

  @Column({ type: 'varchar', length: 255 })
  project_name!: string;

  @Column({ type: 'uuid', nullable: true })
  room_id!: string | null;

  @Column({ type: 'varchar', length: 255 })
  room_name!: string;

  @Column({ type: 'jsonb' })
  dimensions_snapshot!: RoomLogDimensionsSnapshot;

  @Column({ type: 'jsonb', default: [] })
  materials_snapshot!: RoomLogMaterialSnapshot[];

  @Column({ type: 'timestamptz' })
  recorded_at!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Project, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'project_id' })
  project!: Project | null;

  @ManyToOne(() => Room, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'room_id' })
  room!: Room | null;
}
