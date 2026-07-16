import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('stripe_events')
export class StripeEvent {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  event_id!: string;

  @Column({ type: 'varchar', length: 100 })
  event_type!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  processed_at!: Date;
}
