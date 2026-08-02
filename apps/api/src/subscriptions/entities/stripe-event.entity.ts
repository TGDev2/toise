import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('stripe_events')
export class StripeEvent {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  event_id!: string;

  @Column({ type: 'varchar', length: 100 })
  event_type!: string;

  /** Date de **réservation** : quelqu'un s'est engagé à traiter cet event. */
  @CreateDateColumn({ type: 'timestamptz' })
  claimed_at!: Date;

  /**
   * Date de **réussite**, nulle tant que l'effet métier n'est pas allé au bout.
   *
   * Ces deux dates étaient une seule colonne, posée à l'insertion : un arrêt du
   * processus entre la réservation et le traitement laissait un event à jamais
   * « traité » alors que rien n'avait eu lieu. Cf. `claimWebhookEvent`.
   */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  processed_at!: Date | null;
}
