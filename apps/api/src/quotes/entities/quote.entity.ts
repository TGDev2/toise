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
import { User } from '../../users/entities/user.entity';
import { Project } from '../../projects/entities/project.entity';
import { Client } from '../../clients/entities/client.entity';
import { EstimationResult } from '../../estimations/entities/estimation-result.entity';
import type { MaterialJustification } from '../../estimations/entities/estimation-result.entity';
import { numericTransformer } from '../../common/transformers/numeric.transformer';

export enum QuoteStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  ACCEPTED = 'accepted',
  REFUSED = 'refused',
  NEGOTIATION = 'negotiation',
}

export type QuoteLaborKind = 'hourly' | 'flat';

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
  /**
   * E1-11 — cf. `MaterialJustification`. Copiée depuis la ligne de liste
   * d'achat au moment de la création du devis, comme le reste de
   * `QuoteLineItem` : figée, parce que le devis est un document et non une
   * vue sur le projet. Le choix marque/sans-marque, lui, se fait à
   * l'affichage (`render-justification.ts`), jamais ici.
   */
  justification?: MaterialJustification;
}

/**
 * Une ligne de main-d'œuvre d'un devis (E2-3). Snapshot figé, comme
 * `QuoteLineItem` : le devis est un document, pas une vue sur le projet.
 *
 * Stocké en JSONB, pas dans une table fille : `work_item_id` n'est **pas**
 * garanti être un UUID (le moteur d'estimation émet `'public'` ou
 * `` `${roomId}:${workTypeCode}` `` sur les parcours public/widget) et aucune
 * politique `ON DELETE` ne serait correcte (`CASCADE` ferait disparaître une
 * ligne d'un devis déjà accepté si l'ouvrage est supprimé du projet ;
 * `RESTRICT` interdirait de corriger son projet). `work_item_id` est donc une
 * trace, jamais une clé d'intégrité — jamais de `@IsUUID()`, de `ParseUUIDPipe`
 * ni de FK sur ce champ.
 */
export interface QuoteLaborLine {
  work_item_id: string | null;
  work_type_code: string | null;
  /** Désignation figée, p. ex. « Peinture murale — Salon ». Le PDF ne relit pas le projet. */
  label: string;
  room_name: string | null;
  /** `flat` ⇒ `quantity` vaut toujours 1. */
  kind: QuoteLaborKind;
  /**
   * Surface nette de l'ouvrage au moment du devis — descriptif imprimable,
   * jamais recalculée en `quantity` que l'artisan surcharge librement. Le
   * temps unitaire (min/m²) n'est volontairement **pas** persisté ici : le
   * stocker à côté de `quantity` créerait deux affirmations qui peuvent
   * diverger dès que les heures sont corrigées à la main (leçon 18 —
   * `tasks/lessons.md`). Il se dérive à l'affichage,
   * `quantity × 60 / surface_m2`, jamais l'inverse.
   */
  surface_m2: number | null;
  /** Heures (`hourly`) ou 1 (`flat`). */
  quantity: number;
  /** Taux horaire (`hourly`) ou montant du forfait (`flat`). */
  unit_price_ht: number;
  /** `round2(quantity × unit_price_ht)` — toujours recalculé serveur, jamais accepté du client. */
  line_total_ht: number;
}

@Entity('quotes')
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Auteur du devis. La propriété est portée par `organization_id` (PLAT-4) :
   * `null` quand l'auteur a supprimé son compte, le devis restant acquis à
   * l'organisation qui l'a émis.
   */
  @Column({ type: 'uuid', nullable: true })
  user_id!: string | null;

  @Index()
  @Column({ type: 'uuid' })
  organization_id!: string;

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

  /** Lignes de MO par ouvrage (E2-3). `[]` = devis sans main-d'œuvre. */
  @Column({ type: 'jsonb', default: [] })
  labor_items_json!: QuoteLaborLine[];

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  material_margin_percent!: number;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  discount_percent!: number;

  @Column({ type: 'text', nullable: true })
  payment_terms!: string | null;

  @Column({ type: 'integer', default: 30 })
  validity_days!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'jsonb' })
  items_json!: QuoteLineItem[];

  /**
   * E1-11 — le détail des fournitures ligne à ligne est optionnel et
   * désactivé par défaut : le détailler expose la marge de l'artisan sur les
   * matériaux, ce qu'il évite délibérément. Faux ⇒ le PDF et la page web
   * fondent le sous-total matériaux dans le total, sans tableau ligne à
   * ligne. Choix du devis, figé à l'émission comme le reste de
   * `items_json` — jamais un réglage repris d'un profil d'entreprise après
   * coup.
   */
  @Column({ type: 'boolean', default: false })
  show_material_details!: boolean;

  /**
   * E1-11 — n'a de sens que si `show_material_details` est vrai : justifier
   * une ligne qu'on ne montre pas ne veut rien dire. L'UI le fait respecter,
   * cette colonne ne le contraint pas — un devis dont le détail a été
   * désactivé après coup ne doit pas perdre silencieusement une valeur qui
   * redeviendrait pertinente si le détail est réactivé.
   */
  @Column({ type: 'boolean', default: false })
  show_material_justifications!: boolean;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  subtotal_materials_ht!: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  subtotal_labor_ht!: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  total_ht!: number;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 20,
    transformer: numericTransformer,
  })
  tva_rate!: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
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

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

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
