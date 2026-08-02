import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Room } from './room.entity';
import { ProjectPhoto } from '../../photos/entities/project-photo.entity';
import type { RoomDimensions } from './room-dimensions.entity';
import type { Opening } from './opening.entity';

export enum WorkType {
  PAINTING = 'painting',
  TILING = 'tiling',
  FLOORING = 'flooring',
  PARTITION = 'partition',
}

export enum ProjectStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ESTIMATED = 'estimated',
  COMPLETED = 'completed',
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Auteur du projet. La propriété, elle, est portée par `organization_id`
   * (PLAT-4) : `null` quand l'auteur a supprimé son compte, le projet restant
   * acquis à son organisation.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  user_id!: string | null;

  @Index()
  @Column({ type: 'uuid' })
  organization_id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  room_name!: string;

  @Column({ type: 'varchar', length: 50, nullable: true, default: null })
  work_type!: WorkType | null;

  @Column({ type: 'varchar', length: 20, default: ProjectStatus.DRAFT })
  status!: ProjectStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @OneToMany(() => Room, (r) => r.project, { eager: true })
  rooms!: Room[];

  @OneToMany(() => ProjectPhoto, (photo) => photo.project)
  photos!: ProjectPhoto[];

  /**
   * Pièce par défaut = 1re pièce par `sort_order` (puis ancienneté). Racine de
   * la compatibilité « 1 projet = 1 pièce » : dimensions/ouvertures projet la
   * ciblent. Requiert `rooms` chargé (eager sur toute lecture `find`/`findOne`).
   */
  private get defaultRoom(): Room | undefined {
    if (!this.rooms || this.rooms.length === 0) return undefined;
    return [...this.rooms].sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        a.created_at.getTime() - b.created_at.getTime(),
    )[0];
  }

  /**
   * Dimensions de la pièce par défaut. Accès de compatibilité conservé pour les
   * consommateurs historiques (contrôleur projet, PDF, communauté, partage).
   */
  get dimensions(): RoomDimensions | null {
    return this.defaultRoom?.dimensions ?? null;
  }

  /** Ouvertures de la pièce par défaut (accès de compatibilité). */
  get openings(): Opening[] {
    return this.defaultRoom?.openings ?? [];
  }
}
