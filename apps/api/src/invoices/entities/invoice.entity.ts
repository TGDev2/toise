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
import { Quote } from '../../quotes/entities/quote.entity';
import { numericTransformer } from '../../common/transformers/numeric.transformer';

export enum InvoiceStatus {
  ISSUED = 'issued',
  PAID = 'paid',
}

export enum InvoiceType {
  /** Facture unique / de solde — le seul type émis aujourd'hui. */
  SOLDE = 'solde',
  /** Réservés : facture d'acompte et avoir, non implémentés (cf. tasks/todo.md §PRO-4). */
  ACOMPTE = 'acompte',
  AVOIR = 'avoir',
}

/** Mention obligatoire au 1er septembre 2026. */
export enum OperationCategory {
  BIENS = 'biens',
  SERVICES = 'services',
  MIXTE = 'mixte',
}

export type InvoiceLineKind = 'material' | 'labor' | 'discount';

/**
 * Ligne de facture. Distincte de `QuoteLineItem`/`QuoteLaborLine` : sur un
 * devis la remise s'applique au total, alors qu'une facture doit vérifier
 * `Σ line_total_ht === total_ht` — d'où la ligne `discount` en montant négatif
 * (`InvoicesService.buildLineItems`).
 */
export interface InvoiceLineItem {
  kind: InvoiceLineKind;
  label: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unit_price_ht: number;
  line_total_ht: number;
  tva_rate: number;
}

/** Identité figée d'une partie, pour que la facture se réimprime à l'identique. */
export interface InvoicePartySnapshot {
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
  email: string | null;
  phone: string | null;
  siret: string | null;
  siren: string | null;
  vat_number: string | null;
  vat_exempt?: boolean;
  legal_form?: string | null;
  capital_social?: number | null;
  rcs_city?: string | null;
  rm_department?: string | null;
  insurance_name?: string | null;
  insurance_policy?: string | null;
  insurance_coverage?: string | null;
  iban?: string | null;
  bic?: string | null;
  is_company?: boolean;
}

export interface VatBreakdownEntry {
  rate: number;
  base_ht: number;
  tva_amount: number;
  /** Renseigné en franchise en base : « TVA non applicable, art. 293 B du CGI ». */
  exemption_reason?: string;
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Auteur de l'émission. L'émetteur légal, lui, est `organization_id`
   * (PLAT-4) : `null` quand l'auteur a supprimé son compte. La facture, elle,
   * ne peut pas disparaître avec lui — sa conservation s'impose à l'entreprise
   * émettrice (art. L102 B LPF, cf. docs/CONFORMITE_FACTURATION.md).
   */
  @Column({ type: 'uuid', nullable: true })
  user_id!: string | null;

  @Index()
  @Column({ type: 'uuid' })
  organization_id!: string;

  @Column({ type: 'uuid', nullable: true })
  quote_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  project_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  client_id!: string | null;

  @Column({ type: 'varchar', length: 20 })
  invoice_number!: string;

  @Column({ type: 'varchar', length: 20, default: InvoiceType.SOLDE })
  invoice_type!: InvoiceType;

  @Column({ type: 'varchar', length: 20, default: InvoiceStatus.ISSUED })
  status!: InvoiceStatus;

  /** Conserve la mention « Réf. devis » même si le devis est supprimé. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  source_quote_number!: string | null;

  @Column({ type: 'date' })
  issued_on!: string;

  /** Date de la prestation — art. 242 nonies A du CGI. */
  @Column({ type: 'date', nullable: true })
  supply_date!: string | null;

  @Column({ type: 'date' })
  due_on!: string;

  @Column({ type: 'varchar', length: 3, default: 'EUR' })
  currency!: string;

  @Column({ type: 'jsonb' })
  seller_snapshot!: InvoicePartySnapshot;

  @Column({ type: 'jsonb' })
  buyer_snapshot!: InvoicePartySnapshot;

  // ── Mentions obligatoires au 1er septembre 2026 ──

  @Column({ type: 'varchar', length: 9, nullable: true })
  buyer_siren!: string | null;

  @Column({ type: 'text', nullable: true })
  delivery_address!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: OperationCategory.SERVICES,
  })
  operation_category!: OperationCategory;

  @Column({ type: 'boolean', default: false })
  vat_on_debits!: boolean;

  @Column({ type: 'jsonb' })
  items_json!: InvoiceLineItem[];

  @Column({ type: 'jsonb' })
  vat_breakdown!: VatBreakdownEntry[];

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
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  total_tva!: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  total_ttc!: number;

  @Column({ type: 'text', nullable: true })
  payment_terms!: string | null;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  late_penalty_rate!: number | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at!: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @ManyToOne(() => Quote, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'quote_id' })
  quote!: Quote | null;

  @ManyToOne(() => Project, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'project_id' })
  project!: Project | null;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'client_id' })
  client!: Client | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
