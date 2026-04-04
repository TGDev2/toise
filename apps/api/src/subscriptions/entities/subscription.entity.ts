import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum SubscriptionStatus {
  TRIALING = 'trialing',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  INCOMPLETE = 'incomplete',
  INCOMPLETE_EXPIRED = 'incomplete_expired',
}

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'varchar', length: 255 })
  stripe_customer_id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  stripe_subscription_id!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripe_price_id!: string | null;

  @Column({ type: 'varchar', length: 20, default: SubscriptionStatus.TRIALING })
  status!: SubscriptionStatus;

  @Column({ type: 'timestamptz', nullable: true })
  current_period_start!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  current_period_end!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  trial_end!: Date | null;

  @Column({ type: 'boolean', default: false })
  cancel_at_period_end!: boolean;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
