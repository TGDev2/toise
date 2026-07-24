import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { AnalysisJob, AnalysisJobStatus } from './entities/analysis-job.entity';
import { CvCorrectionLog } from './entities/cv-correction-log.entity';

interface RawOutput {
  opening_detector?: string;
  openings_detail?: unknown[];
  per_image?: { image_path?: string; openings?: unknown[] }[];
}

export interface CvRetrainingExportJob {
  job_id: string;
  project_id: string;
  completed_at: string;
  opening_detector: string;
  openings_detail: unknown[];
  per_image: { image_path: string; openings: unknown[] }[];
  corrections: {
    id: string;
    field: string | null;
    cv_value: unknown;
    user_value: unknown;
    created_at: string;
  }[];
  project_correction_counts: { dimension: number; opening: number };
}

export interface CvRetrainingExport {
  generated_at: string;
  since: string | null;
  next_since: string | null;
  job_count: number;
  jobs: CvRetrainingExportJob[];
}

/**
 * Export des données d'apprentissage CV-6 : jobs d'analyse complétés dont le
 * raw_output contient les détections par image (bbox), avec les corrections
 * d'ouvertures associées et les compteurs d'engagement du projet. Les jobs
 * antérieurs à la capture des bbox sont exclus (inexploitables en labels).
 * Consommé par training/export_client.py sur la machine d'entraînement.
 */
@Injectable()
export class CvRetrainingService {
  constructor(
    @InjectRepository(AnalysisJob)
    private readonly jobRepo: Repository<AnalysisJob>,
    @InjectRepository(CvCorrectionLog)
    private readonly correctionRepo: Repository<CvCorrectionLog>,
  ) {}

  async buildExport(since?: Date, limit = 100): Promise<CvRetrainingExport> {
    const jobs = await this.jobRepo.find({
      where: {
        status: AnalysisJobStatus.COMPLETED,
        ...(since ? { completed_at: MoreThan(since) } : {}),
      },
      order: { completed_at: 'ASC' },
      take: limit,
    });

    const exportable = jobs.filter(
      (job) => this.rawOutput(job)?.openings_detail !== undefined,
    );

    const jobIds = exportable.map((j) => j.id);
    const projectIds = [...new Set(exportable.map((j) => j.project_id))];

    const [corrections, counts] = await Promise.all([
      jobIds.length
        ? this.correctionRepo.find({
            where: { analysis_job_id: In(jobIds), entity_type: 'opening' },
            order: { created_at: 'ASC' },
          })
        : Promise.resolve([]),
      this.countCorrectionsByProject(projectIds),
    ]);

    const correctionsByJob = new Map<string, CvCorrectionLog[]>();
    for (const log of corrections) {
      const list = correctionsByJob.get(log.analysis_job_id) ?? [];
      list.push(log);
      correctionsByJob.set(log.analysis_job_id, list);
    }

    // next_since se base sur le dernier job de la page BRUTE (avant filtre) :
    // une page pleine de jobs sans bbox doit quand même faire avancer le
    // curseur, sinon la pagination boucle.
    const lastJob = jobs[jobs.length - 1];

    return {
      generated_at: new Date().toISOString(),
      since: since?.toISOString() ?? null,
      next_since:
        jobs.length === limit && lastJob.completed_at
          ? lastJob.completed_at.toISOString()
          : null,
      job_count: exportable.length,
      jobs: exportable.map((job) => {
        const raw = this.rawOutput(job);
        return {
          job_id: job.id,
          project_id: job.project_id,
          completed_at: job.completed_at?.toISOString() ?? '',
          opening_detector: raw?.opening_detector ?? 'unknown',
          openings_detail: raw?.openings_detail ?? [],
          per_image: (raw?.per_image ?? []).map((entry) => ({
            image_path: entry.image_path ?? '',
            openings: entry.openings ?? [],
          })),
          corrections: (correctionsByJob.get(job.id) ?? []).map((log) => ({
            id: log.id,
            field: log.field,
            cv_value: log.cv_value,
            user_value: log.user_value,
            created_at: log.created_at.toISOString(),
          })),
          project_correction_counts: counts.get(job.project_id) ?? {
            dimension: 0,
            opening: 0,
          },
        };
      }),
    };
  }

  private rawOutput(job: AnalysisJob): RawOutput | undefined {
    const result = job.result_json as { raw_output?: RawOutput } | null;
    return result?.raw_output;
  }

  private async countCorrectionsByProject(
    projectIds: string[],
  ): Promise<Map<string, { dimension: number; opening: number }>> {
    const counts = new Map<string, { dimension: number; opening: number }>();
    if (projectIds.length === 0) return counts;

    const rows: { project_id: string; entity_type: string; count: string }[] =
      await this.correctionRepo
        .createQueryBuilder('log')
        .select('log.project_id', 'project_id')
        .addSelect('log.entity_type', 'entity_type')
        .addSelect('COUNT(*)', 'count')
        .where('log.project_id IN (:...projectIds)', { projectIds })
        .groupBy('log.project_id')
        .addGroupBy('log.entity_type')
        .getRawMany();

    for (const row of rows) {
      const entry = counts.get(row.project_id) ?? { dimension: 0, opening: 0 };
      if (row.entity_type === 'dimension') {
        entry.dimension = Number(row.count);
      } else if (row.entity_type === 'opening') {
        entry.opening = Number(row.count);
      }
      counts.set(row.project_id, entry);
    }
    return counts;
  }
}
