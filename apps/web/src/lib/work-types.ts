export interface ContextualQuestionOption {
  value: string;
  label_fr: string;
}

export interface ContextualQuestion {
  key: string;
  type: 'select' | 'number';
  label_fr: string;
  options?: ContextualQuestionOption[];
  required: boolean;
}

export interface WorkTypeRef {
  id: string;
  code: string;
  label_fr: string;
  category: string;
  surface_target: string;
  contextual_questions: ContextualQuestion[];
}

export interface WorkItemSelection {
  work_type_id: string;
  skill_level: string;
  custom_params: Record<string, unknown>;
}

export interface SavedWorkItem {
  id: string;
  work_type: WorkTypeRef;
  skill_level: string;
  custom_params: Record<string, unknown>;
}

export const SKILL_LEVELS = [
  {
    value: 'beginner',
    label: 'Debutant',
    description:
      'Le facteur de perte sera augmenté pour compenser les erreurs de découpe plus fréquentes.',
  },
  {
    value: 'intermediate',
    label: 'Intermediaire',
    description: '',
  },
  {
    value: 'expert',
    label: 'Confirme',
    description: '',
  },
] as const;

export const WORK_TYPE_ICONS: Record<string, string> = {
  wall_painting: '\u{1F3A8}',
  ceiling_painting: '\u{2B06}\u{FE0F}',
  floor_tiling: '\u{1FAA8}',
  wall_tiling: '\u{1F9F1}',
  parquet_flooring: '\u{1FAB5}',
  drywall: '\u{1F9F1}',
  wall_covering: '\u{1F5BC}\u{FE0F}',
};
