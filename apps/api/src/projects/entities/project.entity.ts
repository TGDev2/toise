import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { RoomDimensions } from './room-dimensions.entity';
import { Opening } from './opening.entity';
import { ProjectWorkItem } from './project-work-item.entity';
import { ProjectPhoto } from '../../photos/entities/project-photo.entity';

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

  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

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

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToOne(() => RoomDimensions, (rd) => rd.project, { eager: true })
  dimensions!: RoomDimensions | null;

  @OneToMany(() => Opening, (o) => o.project, { eager: true })
  openings!: Opening[];

  @OneToMany(() => ProjectWorkItem, (wi) => wi.project)
  workItems!: ProjectWorkItem[];

  @OneToMany(() => ProjectPhoto, (photo) => photo.project)
  photos!: ProjectPhoto[];
}
