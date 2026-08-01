import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Project } from '../../projects/entities/project.entity';
import { Client } from '../../clients/entities/client.entity';
import { EstimationResult } from '../../estimations/entities/estimation-result.entity';

export enum QuoteStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  ACCEPTED = 'accepted',
  REFUSED = 'refused',
  NEGOTIATION = 'negotiation',
}

export enum LaborType {
  HOURLY = 'hourly',
  FLAT = 'flat',
}

export interface QuoteLineItem {
  material_name: string;
  material_category: string;
  work_type_label: string;
  packaging_label: string;
  units_needed: number;
  base_unit_price: number;
  margin_percent: number;
  unit_price_with_margin: number;
  line_total_ht: number;
}

@Entity('quotes')
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'uuid' })
  project_id!: string;

  @Column({ type: 'uuid', nullable: true })
  client_id!: string | null;

  @Column({ type: 'uuid' })
  estimation_id!: string;

  @Column({ type: 'varchar', length: 20 })
  quote_number!: string;

  @Column({ type: 'varchar', length: 20, default: QuoteStatus.DRAFT })
  status!: QuoteStatus;

  @Column({ type: 'varchar', length: 10, default: LaborType.HOURLY })
  labor_type!: LaborType;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  labor_hourly_rate!: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  labor_estimated_hours!: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  labor_flat_amount!: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  material_margin_percent!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  discount_percent!: number;

  @Column({ type: 'text', nullable: true })
  payment_terms!: string | null;

  @Column({ type: 'integer', default: 30 })
  validity_days!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'jsonb' })
  items_json!: QuoteLineItem[];

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  subtotal_materials_ht!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  subtotal_labor_ht!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  total_ht!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 20 })
  tva_rate!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  total_ttc!: number;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  accepted_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  refused_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  reminder_7d_sent_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  reminder_14d_sent_at!: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'client_id' })
  client!: Client | null;

  @ManyToOne(() => EstimationResult, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'estimation_id' })
  estimation!: EstimationResult;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
