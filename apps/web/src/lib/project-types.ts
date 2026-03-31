export type ProjectStatus = 'draft' | 'active' | 'estimated' | 'completed';

export interface ProjectSummary {
  id: string;
  name: string;
  room_name: string;
  work_type: string | null;
  status: ProjectStatus;
  dimensions: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  } | null;
  is_read_only?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedProjects {
  data: ProjectSummary[];
  meta: PaginationMeta;
}

export const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; bg: string; text: string }
> = {
  draft: { label: 'Brouillon', bg: 'bg-stone-100', text: 'text-stone-600' },
  active: { label: 'En cours', bg: 'bg-amber-100', text: 'text-amber-700' },
  estimated: { label: 'Estime', bg: 'bg-blue-100', text: 'text-blue-700' },
  completed: { label: 'Termine', bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

export const WORK_TYPE_LABELS: Record<string, string> = {
  painting: 'Peinture',
  tiling: 'Carrelage',
  flooring: 'Parquet',
  partition: 'Cloison',
};
