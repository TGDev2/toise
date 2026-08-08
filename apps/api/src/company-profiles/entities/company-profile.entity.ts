import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { numericTransformer } from '../../common/transformers/numeric.transformer';

@Entity('company_profiles')
export class CompanyProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Auteur de la saisie. L'identité légale appartient à `organization_id`
   * (PLAT-4) : `null` quand l'auteur a supprimé son compte, l'identité de
   * l'entreprise ne dépendant pas de la personne qui l'a renseignée.
   */
  @Column({ type: 'uuid', nullable: true })
  user_id!: string | null;

  @Index()
  @Column({ type: 'uuid' })
  organization_id!: string;

  @Column({ type: 'varchar', length: 255 })
  raison_sociale!: string;

  @Column({ type: 'varchar', length: 14, unique: true })
  siret!: string;

  @Column({ type: 'varchar', length: 255 })
  address_line1!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address_line2!: string | null;

  @Column({ type: 'varchar', length: 10 })
  postal_code!: string;

  @Column({ type: 'varchar', length: 100 })
  city!: string;

  @Column({ type: 'varchar', length: 2, default: 'FR' })
  country!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  specialties!: string[];

  // ── Mentions légales de facturation (PRO-4) ──
  // Toutes nullables : la complétude n'est exigée qu'à l'émission d'une facture,
  // via findMissingLegalMentions(). Le SIREN et le numéro RCS ne sont pas stockés,
  // ils se dérivent du SIRET (9 premiers chiffres).

  @Column({ type: 'varchar', length: 50, nullable: true })
  legal_form!: string | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  capital_social!: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  vat_number!: string | null;

  /** Franchise en base de TVA (art. 293 B du CGI). */
  @Column({ type: 'boolean', default: false })
  vat_exempt!: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  rcs_city!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  rm_department!: string | null;

  /** Assurance décennale — obligatoire pour le BTP (art. L243-2 code des assurances). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  insurance_name!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  insurance_policy!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  insurance_coverage!: string | null;

  @Column({ type: 'varchar', length: 34, nullable: true })
  iban!: string | null;

  @Column({ type: 'varchar', length: 11, nullable: true })
  bic!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  late_penalty_rate!: number | null;

  @Column({ type: 'integer', nullable: true })
  default_payment_terms_days!: number | null;

  /** Taux horaire par défaut proposé sur une ligne de MO (E2-3). Nullable : pas de valeur plausible en repli. */
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  default_labor_hourly_rate!: number | null;

  /**
   * E1-11 — cite ou non le fabricant et le produit dans la justification
   * affichée d'une quantité (liste d'achat, devis). Vrai par défaut : c'est
   * l'argument de traçabilité le plus fort. Un artisan qui pose une autre
   * marque que celle sourcée le désactive — la justification technique
   * (ratio, norme, date) reste, seul le nom commercial disparaît.
   *
   * Lu **en direct** à chaque réponse (`materials/render-justification.ts`),
   * jamais figé dans un chiffrage ou une liste d'achat : basculer ce réglage
   * doit changer l'affichage immédiatement, y compris sur ce qui a déjà été
   * généré. Seul le devis, une fois émis, fige sa propre apparence
   * (`Quote.items_json`) — cette colonne n'agit alors plus que sur les
   * devis en brouillon et les listes d'achat.
   */
  @Column({ type: 'boolean', default: true })
  show_material_brands!: boolean;

  @OneToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
