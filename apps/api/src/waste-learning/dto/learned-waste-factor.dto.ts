/** BACKLOG DATA-3 : facteur appris tel qu'exposé à l'admin (numeric → number). */
export interface LearnedWasteFactorDto {
  material_id: string;
  pose_type: string;
  skill_level: string;
  factor_percent: number;
  baseline_percent: number;
  observed_percent: number;
  sample_size: number;
  computed_at: string;
}
