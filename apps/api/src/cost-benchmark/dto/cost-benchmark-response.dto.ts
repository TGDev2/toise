import type { BenchmarkPosition, SurfaceBand } from '../cost-benchmark';
import { surfaceBandLabel } from '../cost-benchmark';
import type { ProjectBenchmark } from '../cost-benchmark.service';

export class BenchmarkComparisonDto {
  work_type_code!: string;
  work_type_label!: string;
  surface_band!: SurfaceBand;
  surface_band_label!: string;
  surface_m2!: number;
  cost!: number;
  cost_per_m2!: number;
  median_cost_per_m2!: number;
  /** > 0 : moins cher que la médiane. */
  delta_percent!: number;
  position!: BenchmarkPosition;
  /**
   * Assise du chiffre, exposée à l'utilisateur : une comparaison sans sa taille
   * d'échantillon se lit comme une vérité alors que c'est une estimation.
   */
  sample_size!: number;
  organization_count!: number;
}

export class CostBenchmarkResponseDto {
  /** `false` : rien à comparer (aucune cohorte publiable, ou budget non chiffré). */
  available!: boolean;
  overall!: {
    cost: number;
    reference_cost: number;
    delta_percent: number;
    position: BenchmarkPosition;
  } | null;
  comparisons!: BenchmarkComparisonDto[];
  /** Libellés des ouvrages du projet sans cohorte publiable. */
  work_types_without_reference!: string[];
  computed_at!: string | null;

  static fromBenchmark(benchmark: ProjectBenchmark): CostBenchmarkResponseDto {
    return {
      available: benchmark.comparisons.length > 0,
      overall: benchmark.overall,
      comparisons: benchmark.comparisons.map((c) => ({
        ...c,
        surface_band_label: surfaceBandLabel(c.surface_band),
      })),
      work_types_without_reference: benchmark.work_types_without_reference,
      computed_at: benchmark.computed_at,
    };
  }
}
