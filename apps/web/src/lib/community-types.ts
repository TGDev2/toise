import type { PaginationMeta } from './project-types';

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

export interface MaterialItem {
  name: string;
  quantity: string;
}

export interface CommunityProjectDetail {
  id: string;
  title: string;
  work_type: string;
  description: string | null;
  materials_list: MaterialItem[];
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
