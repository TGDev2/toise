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

export enum PhotoStatus {
  UPLOADING = 'uploading',
  READY = 'ready',
  ERROR = 'error',
}

@Entity('project_photos')
export class ProjectPhoto {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  project_id!: string;

  @Column({ type: 'varchar', length: 1024 })
  storage_url!: string;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  thumbnail_url!: string | null;

  @Column({ type: 'varchar', length: 255 })
  original_filename!: string;

  @Column({ type: 'varchar', length: 50 })
  mime_type!: string;

  @Column({ type: 'int' })
  size_bytes!: number;

  @Column({ type: 'varchar', length: 20, default: PhotoStatus.UPLOADING })
  status!: PhotoStatus;

  @Column({ type: 'smallint', default: 0 })
  sort_order!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;
}
