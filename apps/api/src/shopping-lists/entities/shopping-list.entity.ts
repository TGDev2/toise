import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';

export interface ShoppingListMaterialItem {
  material_id: string;
  work_type_code: string;
  work_type_label: string;
  material_name: string;
  material_category: string;
  material_unit: string;
  packaging_label: string;
  packaging_qty_per_unit: number;
  adjusted_qty: number;
  original_units_needed: number;
  units_needed: number;
  /**
   * E1-5 : détail de l'achat quand plusieurs formats sont panachés
   * (« 1 pot de 5 L + 1 pot de 2,5 L »), du plus grand au plus petit. Absent
   * sur un achat à format unique et sur les listes d'avant E1-5.
   *
   * Purement descriptif : `units_needed` reste le nombre total de contenants,
   * et aucun calcul ne s'adosse à ce détail. Une correction manuelle de la
   * quantité ne le recalcule pas — l'assortiment ne décrit alors plus l'achat,
   * et l'affichage cesse de le montrer (`ShoppingListMaterials`).
   */
  packaging_breakdown?: { label: string; units: number }[];
  is_manually_adjusted: boolean;
  /**
   * DATA-5 : conditionnements **réellement achetés**, déclarés à la clôture.
   *
   * Distinct de `units_needed`, qui reste la liste de courses — ce qu'il faut
   * acheter, corrigeable avant les courses. Sans cette séparation, une ligne
   * jamais regardée est indiscernable d'une ligne confirmée, et
   * `WasteLearningService` lisait la première comme « l'estimation était
   * exacte » : une non-observation qui confirmait le catalogue.
   *
   * `null` ou absent = l'utilisateur n'a rien déclaré. Seules les lignes
   * déclarées alimentent DATA-3 et DATA-4.
   */
  purchased_units?: number | null;
  /** ENG-2 : nombre de pièces mutualisées sur cette ligne (≥ 2 → affichage « N pièces »). */
  room_count?: number;
  /** Legacy : présent sur les listes générées avant la mutualisation ENG-2. */
  work_item_id?: string;
  real_unit_price?: number | null;
  store_name?: string | null;
  /**
   * Fourchette basse/haute (CV-5), propagée depuis l'incertitude de mesure
   * CV. Absente pour un matériau sans pièce CV en amont, ou une correction
   * manuelle antérieure à cette fonctionnalité.
   */
  units_needed_low?: number;
  units_needed_high?: number;
}

export interface ShoppingListComplementaryItem {
  complementary_material_id: string;
  name: string;
  description_fr: string;
  category: string;
  unit_label: string;
  default_quantity: number;
  quantity: number;
  is_removed: boolean;
  /**
   * Legacy : plus jamais écrit depuis E1-6, où les quantités calculées sont
   * repassées au catalogue. Encore lu (export PDF, web) pour les listes
   * générées avant, dont l'instantané JSONB le porte toujours.
   */
  is_calculated?: boolean;
  real_unit_price?: number | null;
  store_name?: string | null;
  /** DATA-5 : quantité réellement achetée, déclarée à la clôture. */
  purchased_quantity?: number | null;
}

export interface ShoppingListData {
  material_items: ShoppingListMaterialItem[];
  complementary_items: ShoppingListComplementaryItem[];
}

export interface CategoryBreakdown {
  category: string;
  label: string;
  real_cost: number;
  brute_cost: number;
}

export interface BudgetSummary {
  total_real_cost: number;
  total_brute_cost: number;
  savings_amount: number;
  savings_percent: number;
  items_priced: number;
  items_total: number;
  is_complete: boolean;
  by_category: CategoryBreakdown[];
  computed_at: string;
}

@Entity('shopping_lists')
export class ShoppingList {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  project_id!: string;

  @Column({ type: 'uuid' })
  estimation_id!: string;

  @Column({ type: 'jsonb' })
  items_json!: ShoppingListData;

  @Column({ type: 'jsonb', nullable: true, default: null })
  budget_summary_json!: BudgetSummary | null;

  /**
   * DATA-5 : date d'achat déclarée (`yyyy-mm-dd`), au niveau de la liste.
   *
   * Sert d'origine au calcul des échéances de reprise. Au niveau de la liste
   * et non de la ligne : l'acheteur qui étale ses courses sur plusieurs
   * semaines est hors périmètre, et une date par ligne ferait payer à tout le
   * monde la précision qui ne sert qu'à lui.
   */
  @Column({ type: 'date', nullable: true, default: null })
  purchased_on!: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    unique: true,
    nullable: true,
    default: null,
  })
  share_token!: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  share_token_created_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;
}
