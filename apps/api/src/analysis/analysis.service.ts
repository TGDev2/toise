import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, QueryFailedError, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AnalysisJob, AnalysisJobStatus } from './entities/analysis-job.entity';
import {
  CvClientService,
  type CvAnalysisRequest,
  type CvAnalysisResponse,
} from './cv-client/cv-client.service';
import { ProjectsService } from '../projects/projects.service';
import { PhotosService } from '../photos/photos.service';
import {
  ConfidenceScore,
  DimensionSource,
} from '../projects/entities/room-dimensions.entity';
import type { OpeningType } from '../projects/entities/opening.entity';
import type { UpdateDimensionsDto } from '../projects/dto/update-dimensions.dto';
import type { AnalysisStatusDto } from './dto/analysis-status.dto';
import { CvAccuracyService } from './cv-accuracy.service';
import { resolveUncertaintyCm } from './dimension-uncertainty';

/**
 * Au-delà de ce délai sans la moindre progression, un job actif est tenu pour
 * perdu. Le traitement vit dans une promesse en mémoire : un redémarrage de
 * l'API l'emporte sans que rien ne le reprenne, et la ligne resterait
 * `pending`/`processing` à jamais — bloquant toute analyse ultérieure sur ce
 * projet. `updated_at` sert de battement de cœur : chaque étape le rafraîchit.
 *
 * Large devant `cvService.timeoutMs` (120 s par défaut), qui borne la seule
 * étape longue du pipeline : un job vivant ne peut pas être pris pour perdu.
 */
const STALE_JOB_TIMEOUT_MS = 15 * 60 * 1000;

const STALE_JOB_MESSAGE =
  "L'analyse a ete interrompue avant son terme. Relancez-la.";

/** Code PostgreSQL d'une violation de contrainte d'unicité. */
const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    (err as QueryFailedError & { code?: string }).code === PG_UNIQUE_VIOLATION
  );
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @InjectRepository(AnalysisJob)
    private readonly jobRepo: Repository<AnalysisJob>,
    private readonly cvClient: CvClientService,
    private readonly projectsService: ProjectsService,
    private readonly photosService: PhotosService,
    private readonly cvAccuracyService: CvAccuracyService,
  ) {}

  async startAnalysis(
    projectId: string,
    organizationId: string,
    referenceObject?: CvAnalysisRequest['reference_object'],
  ): Promise<AnalysisJob> {
    // Verify project ownership
    await this.projectsService.findOneForOrg(projectId, organizationId);

    // Verify project has photos
    const photos = await this.photosService.getProjectPhotos(
      projectId,
      organizationId,
    );
    if (photos.length === 0) {
      throw new BadRequestException(
        "Le projet doit avoir au moins une photo pour lancer l'analyse",
      );
    }

    // Un job perdu au redémarrage ne doit pas condamner le projet.
    await this.reclaimStaleJobs(projectId);

    // Contrôle d'absence pour rendre le refus lisible ; ce n'est pas lui qui
    // garantit l'exclusivité — deux appels simultanés le franchissent tous les
    // deux. C'est l'index unique partiel de `analysis_jobs` qui tranche, et
    // c'est sa violation qui est traduite ci-dessous.
    const existingJob = await this.jobRepo.findOne({
      where: {
        project_id: projectId,
        status: In([AnalysisJobStatus.PENDING, AnalysisJobStatus.PROCESSING]),
      },
    });
    if (existingJob) {
      throw new ConflictException(
        'Une analyse est deja en cours pour ce projet',
      );
    }

    // Create job
    const job = this.jobRepo.create({
      project_id: projectId,
      status: AnalysisJobStatus.PENDING,
    });
    let saved: AnalysisJob;
    try {
      saved = await this.jobRepo.save(job);
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(
          'Une analyse est deja en cours pour ce projet',
        );
      }
      throw err;
    }

    // Fire-and-forget processing
    const imagePaths = photos.map((p) => p.storage_url);
    this.processAnalysis(
      saved.id,
      projectId,
      organizationId,
      imagePaths,
      referenceObject,
    ).catch((err: Error) =>
      this.logger.error(
        `Analysis processing failed for job ${saved.id}: ${err.message}`,
      ),
    );

    return saved;
  }

  /**
   * Marque en échec les jobs actifs qui ne progressent plus. Appelé avant de
   * démarrer une analyse et avant d'en lire le statut : sans cela, un client
   * qui interroge un job perdu tourne indéfiniment sur « en cours ».
   */
  private async reclaimStaleJobs(projectId: string): Promise<void> {
    await this.jobRepo.update(
      {
        project_id: projectId,
        status: In([AnalysisJobStatus.PENDING, AnalysisJobStatus.PROCESSING]),
        updated_at: LessThan(new Date(Date.now() - STALE_JOB_TIMEOUT_MS)),
      },
      {
        status: AnalysisJobStatus.FAILED,
        error_message: STALE_JOB_MESSAGE,
        completed_at: new Date(),
        progress_pct: 100,
      },
    );
  }

  async getJobStatus(
    projectId: string,
    organizationId: string,
    jobId: string,
  ): Promise<AnalysisStatusDto> {
    // Verify project ownership
    await this.projectsService.findOneForOrg(projectId, organizationId);

    await this.reclaimStaleJobs(projectId);

    const job = await this.jobRepo.findOne({
      where: { id: jobId, project_id: projectId },
    });
    if (!job) {
      throw new NotFoundException("Job d'analyse non trouve");
    }

    const result: AnalysisStatusDto = {
      job_id: job.id,
      status: job.status,
      progress_pct: job.progress_pct,
      started_at: job.started_at?.toISOString() ?? null,
      completed_at: job.completed_at?.toISOString() ?? null,
    };

    if (job.status === AnalysisJobStatus.COMPLETED && job.result_json) {
      const data = job.result_json as unknown as CvAnalysisResponse;
      result.dimensions = data.dimensions;
      result.confidence = data.confidence;
      result.confidence_score = data.confidence_score ?? null;
      result.reference_detected = data.reference_detected;
      result.openings = data.openings ?? null;
      result.opening_detector = data.opening_detector ?? null;

      // L'incertitude par dimension (CV-5) est calculée une seule fois à
      // l'écriture (cf. processAnalysis) et persistée sur room_dimensions —
      // on la relit ici plutôt que de la recalculer, room_dimensions restant
      // la source de vérité (une correction manuelle ultérieure l'efface).
      if (result.dimensions) {
        const persisted = await this.projectsService.getDimensions(
          projectId,
          organizationId,
        );
        if (persisted?.source === DimensionSource.CV) {
          result.dimensions = {
            ...result.dimensions,
            length_cm_uncertainty: persisted.length_cm_uncertainty,
            width_cm_uncertainty: persisted.width_cm_uncertainty,
            height_cm_uncertainty: persisted.height_cm_uncertainty,
          };
        }
      }
    }

    if (job.status === AnalysisJobStatus.FAILED) {
      result.error_message = job.error_message;
    }

    return result;
  }

  private async processAnalysis(
    jobId: string,
    projectId: string,
    organizationId: string,
    imagePaths: string[],
    referenceObject?: CvAnalysisRequest['reference_object'],
  ): Promise<void> {
    // Update to processing
    await this.jobRepo.update(jobId, {
      status: AnalysisJobStatus.PROCESSING,
      progress_pct: 10,
      started_at: new Date(),
    });

    try {
      // Call CV service. A caller-provided reference_object (A4 / bank card
      // marker) overrides the default door auto-detection.
      const cvResponse = await this.cvClient.analyze({
        image_paths: imagePaths,
        ...(referenceObject ? { reference_object: referenceObject } : {}),
      });

      await this.jobRepo.update(jobId, { progress_pct: 80 });

      if (cvResponse.status === 'error') {
        await this.jobRepo.update(jobId, {
          status: AnalysisJobStatus.FAILED,
          error_message:
            cvResponse.error ?? 'Le service CV a retourne une erreur',
          completed_at: new Date(),
          progress_pct: 100,
        });
        return;
      }

      // Les écritures projet d'abord, le job COMPLETED seulement après : le
      // statut du job est ce que le client lit pour savoir que la donnée est
      // là. L'ordre inverse publiait un résultat avant de l'avoir écrit — et
      // laissait, en cas d'échec, un job en échec sur un projet déjà modifié.
      if (cvResponse.status === 'success' && cvResponse.dimensions) {
        const confidenceMap: Record<string, ConfidenceScore> = {
          high: ConfidenceScore.HIGH,
          medium: ConfidenceScore.MEDIUM,
          low: ConfidenceScore.LOW,
        };

        const dto = {
          length_cm: cvResponse.dimensions.length_cm,
          width_cm: cvResponse.dimensions.width_cm,
          height_cm: cvResponse.dimensions.height_cm,
        } as UpdateDimensionsDto;

        const confidenceScore =
          confidenceMap[cvResponse.confidence] ?? ConfidenceScore.MEDIUM;

        // CV-5 : incertitude par champ, calculée une seule fois ici puis
        // persistée sur room_dimensions (cf. dimension-uncertainty.ts).
        const accuracyReport = await this.cvAccuracyService.getReport();
        const uncertainty = {
          length_cm: resolveUncertaintyCm(
            'length_cm',
            confidenceScore,
            accuracyReport,
          ),
          width_cm: resolveUncertaintyCm(
            'width_cm',
            confidenceScore,
            accuracyReport,
          ),
          height_cm: resolveUncertaintyCm(
            'height_cm',
            confidenceScore,
            accuracyReport,
          ),
        };

        await this.projectsService.applyCvAnalysis(projectId, organizationId, {
          dimensions: dto,
          confidence_score: confidenceScore,
          raw_cv_output_json: cvResponse.raw_output,
          uncertainty,
          // Liste éventuellement vide : le remplacement doit alors effacer
          // les ouvertures de l'analyse précédente.
          openings: (cvResponse.openings ?? []).map((detected) => ({
            type: detected.type as OpeningType,
            width_cm: detected.width_cm,
            height_cm: detected.height_cm,
            count: detected.count,
            cv_confidence: detected.confidence,
          })),
        });
      }

      // Store result (including no_reference status)
      await this.jobRepo.update(jobId, {
        status: AnalysisJobStatus.COMPLETED,
        result_json: cvResponse as unknown as QueryDeepPartialEntity<
          Record<string, unknown>
        >,
        completed_at: new Date(),
        progress_pct: 100,
      });

      this.logger.log(
        `Analysis job ${jobId} completed: status=${cvResponse.status}`,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erreur inconnue du pipeline CV';
      this.logger.error(`Analysis job ${jobId} failed: ${message}`);

      await this.jobRepo.update(jobId, {
        status: AnalysisJobStatus.FAILED,
        error_message: message,
        completed_at: new Date(),
        progress_pct: 100,
      });
    }
  }
}
