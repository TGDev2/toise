import type { PaginationMeta } from './project-types';
import type {
  ShoppingListMaterialItem,
  ShoppingListComplementaryItem,
  BudgetSummary,
} from './shopping-list-types';

export interface CommunityProjectSummary {
  id: string;
  title: string;
  work_type: string;
  thumbnail_url: string | null;
  likes_count: number;
  comments_count: number;
  user_display_name: string;
  published_at: string | null;
}

export interface PurchaseListSnapshot {
  material_items: ShoppingListMaterialItem[];
  complementary_items: ShoppingListComplementaryItem[];
}

export interface CommunityProjectDetail {
  id: string;
  title: string;
  work_type: string;
  description: string | null;
  // COM-1 : liste d'achats réelle figée au moment du partage (quantités +
  // prix réels), plutôt qu'une saisie manuelle. Absente (null) sur les
  // publications antérieures que le backfill n'a pas pu rattacher.
  purchase_list: PurchaseListSnapshot | null;
  budget_summary: BudgetSummary | null;
  total_cost_cents: number;
  duration_days: number;
  length_cm: number;
  width_cm: number;
  height_cm: number | null;
  before_photo_ids: string[];
  after_photo_ids: string[];
  likes_count: number;
  comments_count: number;
  user_display_name: string;
  published_at: string | null;
  has_liked: boolean;
  is_owner: boolean;
}

export interface CommunityComment {
  id: string;
  content: string;
  user_display_name: string;
  is_owner: boolean;
  created_at: string;
}

export interface PaginatedCommunityProjects {
  data: CommunityProjectSummary[];
  meta: PaginationMeta;
}

export interface PaginatedComments {
  data: CommunityComment[];
  meta: PaginationMeta;
}

export interface ToggleLikeResponse {
  liked: boolean;
  likes_count: number;
}
