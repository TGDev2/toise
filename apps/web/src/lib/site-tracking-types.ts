export type MilestoneStatus = 'pending' | 'in_progress' | 'done';

export interface SiteMilestone {
  id: string;
  project_id: string;
  label: string;
  status: MilestoneStatus;
  planned_date: string | null;
  actual_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMilestonePayload {
  label: string;
  planned_date?: string;
}

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: 'À venir',
  in_progress: 'En cours',
  done: 'Terminé',
};

export const MILESTONE_STATUS_COLORS: Record<MilestoneStatus, string> = {
  pending: 'bg-stone-100 text-stone-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-emerald-100 text-emerald-700',
};

export const MILESTONE_NEXT_STATUS: Record<MilestoneStatus, MilestoneStatus | null> = {
  pending: 'in_progress',
  in_progress: 'done',
  done: null,
};
