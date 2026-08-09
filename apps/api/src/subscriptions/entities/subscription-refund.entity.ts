import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * D'où vient le remboursement. Un remboursement émis depuis le tableau de bord
 * Stripe produit la même trace qu'une demande faite depuis le produit : sans
 * cela, la politique ne tiendrait que sur le chemin heureux et un geste manuel
 * laisserait l'accès ouvert sans que rien ne le dise.
 */
export enum RefundOrigin {
  SELF_SERVICE = 'self_service',
  STRIPE_DASHBOARD = 'stripe_dashboard',
}

/**
 * Trace du « 30 jours satisfait ou remboursé » (ADR 0002 §D4, E3-3).
 *
 * Une ligne par remboursement effectivement émis chez Stripe. Elle sert trois
 * rôles distincts, et c'est pour cela qu'elle existe plutôt que de se déduire
 * de l'API Stripe à la demande :
 *
 * 1. **idempotence** — `stripe_refund_id` est unique. Deux demandes
 *    concurrentes, ou une demande rejouée après une panne réseau, ne peuvent
 *    pas produire deux remboursements ;
 * 2. **condition** — une facture déjà remboursée ne l'est pas deux fois, et la
 *    question se tranche en base, pas en re-listant Stripe ;
 * 3. **mesure** — l'ADR §3.2 fait du taux de remboursement le seul signal
 *    précoce sur la qualité de la promesse, et §5.1 en fixe le seuil d'alerte
 *    (> 20 % sur les 25 premières ventes). Un signal qui n'est compté nulle
 *    part n'est pas un signal.
 *
 * `eligible_until` est stockée alors qu'elle se recalcule : elle fige la règle
 * **telle qu'appliquée ce jour-là**. Si `REFUND_WINDOW_DAYS` change un jour,
 * une ligne ancienne reste explicable sans avoir à retrouver la valeur de la
 * constante à la date du remboursement.
 */
@Entity('subscription_refunds')
export class SubscriptionRefund {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  /**
   * Identifiants Stripe conservés en texte et non en clés étrangères : la ligne
   * `subscriptions` est **supprimée** à la résiliation d'un compte
   * (`cancelForAccountDeletion`), et une trace financière qui disparaîtrait
   * avec elle ne serait plus une trace.
   */
  @Column({ type: 'varchar', length: 255 })
  stripe_subscription_id!: string;

  /**
   * Nullable, et c'est délibéré : un remboursement émis depuis le tableau de
   * bord Stripe arrive par `charge.refunded`, dont la charge ne porte **pas**
   * de lien vers la facture depuis l'API 2025 (le champ `Charge.invoice`
   * n'existe plus dans le SDK v21). On le résout au mieux via
   * `invoicePayments.list` ; si ce détour échoue, la trace enregistre ce qu'on
   * sait plutôt que d'inventer une référence.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  stripe_invoice_id!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripe_charge_id!: string | null;

  /** Clé d'idempotence de toute la politique : unique en base. */
  @Column({ type: 'varchar', length: 255, unique: true })
  stripe_refund_id!: string;

  @Column({ type: 'integer' })
  amount_cents!: number;

  @Column({ type: 'varchar', length: 10 })
  currency!: string;

  @Column({ type: 'varchar', length: 20 })
  origin!: RefundOrigin;

  /** Motif libre saisi par l'abonné, borné par le DTO. `null` si non fourni. */
  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  /**
   * Date de paiement de la facture remboursée — l'ancre de la fenêtre.
   * `null` quand la facture n'a pas pu être résolue (voir ci-dessus).
   */
  @Column({ type: 'timestamptz', nullable: true })
  invoice_paid_at!: Date | null;

  /**
   * Date limite **telle qu'appliquée** à cette demande, et non recalculée à la
   * lecture : si `REFUND_WINDOW_DAYS` change un jour, une ligne ancienne reste
   * explicable sans avoir à retrouver la valeur de la constante à l'époque.
   *
   * `null` pour un remboursement émis depuis le tableau de bord Stripe : c'est
   * un geste **hors** politique, que l'opérateur peut faire à n'importe quelle
   * date. Y écrire une échéance laisserait croire qu'une condition a été
   * vérifiée alors qu'aucune ne l'a été.
   */
  @Column({ type: 'timestamptz', nullable: true })
  eligible_until!: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
