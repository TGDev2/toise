export class StartAnalysisResponseDto {
  job_id!: string;
  status!: string;
}

export class AnalysisStatusDto {
  job_id!: string;
  status!: string;
  progress_pct!: number;
  dimensions?: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
    /** Incertitude de mesure (cm), CV-5. Absent tant que non persisté. */
    length_cm_uncertainty?: number | null;
    width_cm_uncertainty?: number | null;
    height_cm_uncertainty?: number | null;
  } | null;
  confidence?: string | null;
  confidence_score?: number | null;
  reference_detected?: boolean;
  openings?: Array<{
    type: string;
    width_cm: number;
    height_cm: number;
    count: number;
    confidence: number;
  }> | null;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}
