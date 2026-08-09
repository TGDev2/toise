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

  /**
   * Date d'**émission** (`event.created`) du dernier événement Stripe appliqué
   * à cette ligne — pas la date de la dernière écriture locale, qui est
   * `updated_at`.
   *
   * Stripe ne garantit pas l'ordre de livraison de ses webhooks. Sans ce
   * filigrane, un événement retardé écrasait un état plus récent et restaurait
   * un palier périmé. `null` = aucun événement appliqué depuis la migration
   * 1711468800076 : le prochain passe sans condition. Cf. `applyEventState`.
   */
  @Column({ type: 'timestamptz', nullable: true })
  last_stripe_event_at!: Date | null;

  /**
   * Date de la **première** entrée en `past_due` de l'épisode d'impayé en
   * cours ; `null` dès que l'abonnement en sort. C'est le point de départ du
   * délai de grâce (`STRIPE_PAST_DUE_GRACE_DAYS`).
   *
   * « Première » est la propriété qui compte : Stripe rejoue
   * `invoice.payment_failed` à chaque relance, sur environ trois semaines. Un
   * horodatage réécrit à chaque passage repousserait l'échéance à chaque
   * relance et le délai n'expirerait jamais. L'invariant est tenu par le
   * `COALESCE` d'`applyEventState`, dans la même instruction que la garde
   * d'ordonnancement — l'écrire ailleurs permettrait à un événement périmé
   * d'estampiller une ligne redevenue `active`, et le prochain impayé
   * démarrerait avec un délai déjà consommé.
   */
  @Column({ type: 'timestamptz', nullable: true })
  past_due_since!: Date | null;

  /**
   * `current_period_end` pour lequel le préavis de reconduction a déjà été
   * envoyé ; `null` tant qu'aucun ne l'a été.
   *
   * L'idempotence des autres e-mails de cycle de vie passe par
   * `lifecycle_email_sends`, mais son index unique partiel
   * `(user_id, email_type) WHERE project_id IS NULL` ne laisse partir un
   * e-mail « par compte » **qu'une fois pour toujours**. Sur une reconduction
   * annuelle, l'abonné aurait été prévenu la première année et jamais plus —
   * une panne qui ne se serait vue qu'au bout de deux ans.
   *
   * La bonne clé de dédoublonnage n'est donc pas le compte mais **la période
   * annoncée** : ce filigrane se réarme de lui-même à chaque échéance.
   */
  @Column({ type: 'timestamptz', nullable: true })
  renewal_notice_sent_for!: Date | null;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
