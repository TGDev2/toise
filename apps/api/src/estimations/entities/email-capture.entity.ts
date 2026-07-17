import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { EstimationLineItem } from './estimation-result.entity';

@Entity('email_captures')
export class EmailCapture {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  work_type_code!: string;

  @Column({ type: 'varchar', length: 20 })
  skill_level!: string;

  @Column({ type: 'jsonb', default: [] })
  estimate_snapshot!: EstimationLineItem[];

  @Column({ type: 'boolean', default: false })
  consent!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  consent_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  email_sent_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
