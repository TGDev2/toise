import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { LifecycleEmailType } from '../lifecycle-email-type.enum';

/**
 * Trace d'idempotence pour les e-mails de cycle de vie (BACKLOG PLAT-2).
 * `project_id` reste `null` sauf pour `project_abandoned` — les deux index
 * uniques partiels (migration 1711468800050) distinguent le cas "par compte"
 * (project_id IS NULL) du cas "par projet".
 */
@Entity('lifecycle_email_sends')
export class LifecycleEmailSend {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'uuid', nullable: true, default: null })
  project_id!: string | null;

  @Column({ type: 'varchar', length: 30 })
  email_type!: LifecycleEmailType;

  @CreateDateColumn({ type: 'timestamptz' })
  sent_at!: Date;
}
