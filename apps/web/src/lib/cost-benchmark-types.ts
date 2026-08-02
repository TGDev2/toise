/** BACKLOG DATA-4 : benchmark de coûts anonymisé. */

export type BenchmarkPosition = 'below' | 'around' | 'above';

export type SurfaceBand = 'small' | 'medium' | 'large';

export interface BenchmarkComparison {
  work_type_code: string;
  work_type_label: string;
  surface_band: SurfaceBand;
  surface_band_label: string;
  surface_m2: number;
  cost: number;
  cost_per_m2: number;
  median_cost_per_m2: number;
  /** > 0 : moins cher que la médiane. */
  delta_percent: number;
  position: BenchmarkPosition;
  sample_size: number;
  organization_count: number;
}

export interface BenchmarkOverall {
  cost: number;
  reference_cost: number;
  delta_percent: number;
  position: BenchmarkPosition;
}

export interface CostBenchmarkResponse {
  available: boolean;
  overall: BenchmarkOverall | null;
  comparisons: BenchmarkComparison[];
  work_types_without_reference: string[];
  computed_at: string | null;
}
