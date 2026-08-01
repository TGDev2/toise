import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';

/**
 * `expired` n'existe pas : l'expiration se **dérive** de `ends_at`, elle ne se
 * stocke pas. Un statut à maintenir aurait exigé un sweep quotidien, donc une
 * fenêtre pendant laquelle la base ment sur l'habilitation (PLAT-6 D14).
 */
export enum EnterpriseAgreementStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  TERMINATED = 'terminated',
}

/**
 * Contrat Enterprise annuel négocié sur devis (BACKLOG PLAT-6).
 *
 * C'est **lui** qui porte l'habilitation `enterprise`, pas un abonnement Stripe
 * ni le `subscription_tier` d'une personne : `OrgContextService` interroge cette
 * table avant de retomber sur le palier du propriétaire de l'organisation. Un
 * changement de propriétaire, une rétrogradation Stripe de sa personne ou son
 * départ n'éteignent donc pas le contrat de l'entreprise (PLAT-6 D1, dette
 * inscrite en PLAT-4 §10).
 *
 * Les documents comptables (devis signé, facture annuelle) restent émis hors
 * produit : `invoices` modélise un artisan facturant **son** client, avec sa
 * propre numérotation légale par organisation. Seules leurs références sont
 * conservées ici.
 */
@Entity('enterprise_agreements')
export class EnterpriseAgreement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  organization_id!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: EnterpriseAgreementStatus.DRAFT,
  })
  status!: EnterpriseAgreementStatus;

  @Column({ type: 'timestamptz' })
  starts_at!: Date;

  /** Borne haute de l'habilitation : au-delà, le palier retombe de lui-même. */
  @Column({ type: 'timestamptz' })
  ends_at!: Date;

  @Column({ type: 'integer' })
  annual_amount_cents!: number;

  @Column({ type: 'varchar', length: 3, default: 'EUR' })
  currency!: string;

  /** Référence du devis signé, émis hors produit. */
  @Column({ type: 'varchar', length: 100 })
  quote_reference!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  purchase_order_reference!: string | null;

  @Column({ type: 'varchar', length: 255 })
  billing_contact_email!: string;

  /**
   * Engagements de service chiffrés, pas un palier énuméré : le commerce peut
   * signer 99,5 % ou 99,95 % sans migration (PLAT-6 D11). `numeric` est rendu
   * en `string` par le driver `pg` — la lecture le reconvertit.
   */
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  sla_uptime_target!: string | null;

  @Column({ type: 'integer', nullable: true })
  sla_support_response_hours!: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sla_support_email!: string | null;

  /** Déclaratif : aucune automatisation d'infrastructure (PLAT-6 §2). */
  @Column({ type: 'boolean', default: false })
  dedicated_environment!: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  dedicated_environment_region!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /** Trace d'auteur uniquement — le contrat appartient à l'organisation. */
  @Column({ type: 'uuid', nullable: true })
  created_by_user_id!: string | null;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
