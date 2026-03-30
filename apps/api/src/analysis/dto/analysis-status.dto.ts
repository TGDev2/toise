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
  } | null;
  confidence?: string | null;
  reference_detected?: boolean;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}
