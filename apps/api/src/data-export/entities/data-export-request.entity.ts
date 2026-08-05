import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum DataExportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}

/**
 * Une demande d'export RGPD (art. 20) par compte. Toujours asynchrone —
 * `DataExportService.processExport` tourne en tâche de fond, jamais dans la
 * requête HTTP qui crée la ligne — pour ne jamais avoir à choisir entre
 * bufferiser une archive potentiellement volumineuse et couper la réponse
 * avant qu'elle soit prête.
 *
 * `file_path` pointe sous le préfixe `exports/<user_id>/` du même volume que
 * les photos (`StorageProvider`), pas un volume dédié. `expires_at` borne la
 * durée de vie de l'archive : elle porte IBAN/BIC et des données clients, elle
 * ne doit pas traîner sur le disque au-delà de sa fenêtre de téléchargement
 * (purge horaire, cf. `DataExportService`).
 */
@Entity('data_export_requests')
export class DataExportRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: DataExportStatus.PENDING,
  })
  status!: DataExportStatus;

  @Column({ type: 'varchar', length: 1024, nullable: true, default: null })
  file_path!: string | null;

  @Column({ type: 'bigint', nullable: true, default: null })
  file_size_bytes!: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  error_message!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  requested_at!: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  completed_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  expires_at!: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
