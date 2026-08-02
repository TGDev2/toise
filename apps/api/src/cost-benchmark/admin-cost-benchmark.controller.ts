import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CostBenchmarkService } from './cost-benchmark.service';
import type { CostBenchmarkRunSummary } from './cost-benchmark.service';
import type { SurfaceBand } from './cost-benchmark';

interface PublishedCellDto {
  work_type_code: string;
  surface_band: SurfaceBand;
  median_cost_per_m2: number;
  sample_size: number;
  organization_count: number;
  computed_at: string;
}

/**
 * BACKLOG DATA-4 : inspection et déclenchement manuel du recalcul.
 *
 * `GET` ne liste que les cellules **publiées** : ce sont les seules stockées.
 * Les cellules écartées (volume ou anonymat insuffisant) n'apparaissent que
 * dans le retour de `POST run`, calculé à la volée — savoir qu'une cohorte
 * approche du seuil ne justifie pas d'en conserver la trace.
 *
 * Ce retour porte le détail par cohorte (`pending`) : comptages et distance aux
 * seuils, jamais un coût. Sans lui, un `by_status` disant « 12 cellules sous le
 * seuil » se lit identiquement que la cohorte progresse ou qu'elle stagne, et le
 * seul recours serait de requêter la base à la main.
 */
@Controller('admin/cost-benchmarks')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminCostBenchmarkController {
  constructor(private readonly costBenchmarkService: CostBenchmarkService) {}

  @Get()
  async list(): Promise<{ benchmarks: PublishedCellDto[] }> {
    const benchmarks = await this.costBenchmarkService.findAll();
    return {
      benchmarks: benchmarks.map((b) => ({
        work_type_code: b.work_type_code,
        surface_band: b.surface_band,
        median_cost_per_m2: b.median_cost_per_m2,
        sample_size: b.sample_size,
        organization_count: b.organization_count,
        computed_at: b.computed_at.toISOString(),
      })),
    };
  }

  @Post('run')
  async run(): Promise<CostBenchmarkRunSummary> {
    return this.costBenchmarkService.run();
  }
}
