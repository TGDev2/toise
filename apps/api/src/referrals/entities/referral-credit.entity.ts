import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ReferralCreditStatus {
  PENDING = 'pending',
  APPLIED = 'applied',
}

/**
 * Ledger local du crédit « 1 mois Pro offert » (COM-3). Le crédit réel est un
 * `Stripe.CustomerBalanceTransaction` négatif sur le compte du parrain ; cette
 * table trace la tentative (idempotence, audit) et porte l'état `pending` tant
 * que le parrain n'a pas encore de `stripe_customer_id` (cf. ReferralsService).
 */
@Entity('referral_credits')
export class ReferralCredit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  referrer_user_id!: string;

  @Column({ type: 'uuid', unique: true })
  referred_user_id!: string;

  @Column({ type: 'int' })
  amount_cents!: number;

  @Column({ type: 'varchar', length: 3, default: 'eur' })
  currency!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: ReferralCreditStatus.PENDING,
  })
  status!: ReferralCreditStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripe_balance_transaction_id!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  applied_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
