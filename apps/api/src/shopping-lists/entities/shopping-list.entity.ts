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
  work_item_id: string;
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
  is_manually_adjusted: boolean;
  real_unit_price?: number | null;
  store_name?: string | null;
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
  is_calculated?: boolean;
  real_unit_price?: number | null;
  store_name?: string | null;
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
