import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Project } from './project.entity';
import { RoomDimensions } from './room-dimensions.entity';
import { Opening } from './opening.entity';
import { ProjectWorkItem } from './project-work-item.entity';

/**
 * Pièce d'un projet (ENG-2 multi-pièces). Un projet possède N pièces ; chacune
 * porte sa géométrie (dimensions 1:1 + ouvertures) et ses travaux (work items).
 * La 1re pièce par `sort_order` est la « pièce par défaut » : elle assure la
 * compatibilité descendante avec le modèle « 1 projet = 1 pièce » (les endpoints
 * projet historiques opèrent dessus).
 */
@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  project_id!: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  name!: string;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @ManyToOne(() => Project, (p) => p.rooms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @OneToOne(() => RoomDimensions, (rd) => rd.room, { eager: true })
  dimensions!: RoomDimensions | null;

  @OneToMany(() => Opening, (o) => o.room, { eager: true })
  openings!: Opening[];

  @OneToMany(() => ProjectWorkItem, (wi) => wi.room)
  workItems!: ProjectWorkItem[];
}
