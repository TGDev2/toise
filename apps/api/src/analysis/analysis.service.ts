import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
import {
  OpeningSource,
  type OpeningType,
} from '../projects/entities/opening.entity';
import type { UpdateDimensionsDto } from '../projects/dto/update-dimensions.dto';
import type { AnalysisStatusDto } from './dto/analysis-status.dto';
import { CvAccuracyService } from './cv-accuracy.service';
import { resolveUncertaintyCm } from './dimension-uncertainty';

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

    // Check no pending/processing job exists
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
    const saved = await this.jobRepo.save(job);

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

  async getJobStatus(
    projectId: string,
    organizationId: string,
    jobId: string,
  ): Promise<AnalysisStatusDto> {
    // Verify project ownership
    await this.projectsService.findOneForOrg(projectId, organizationId);

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

      // Store result (including no_reference status)
      await this.jobRepo.update(jobId, {
        status: AnalysisJobStatus.COMPLETED,
        result_json: cvResponse as unknown as QueryDeepPartialEntity<
          Record<string, unknown>
        >,
        completed_at: new Date(),
        progress_pct: 100,
      });

      // If dimensions were extracted, update room_dimensions
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

        await this.projectsService.updateDimensions(
          projectId,
          organizationId,
          dto,
          {
            source: DimensionSource.CV,
            confidence_score: confidenceScore,
            raw_cv_output_json: cvResponse.raw_output,
            uncertainty,
          },
        );
      }

      // Save detected openings
      if (
        cvResponse.status === 'success' &&
        cvResponse.openings &&
        cvResponse.openings.length > 0
      ) {
        await this.projectsService.removeCvOpenings(projectId);

        for (const detected of cvResponse.openings) {
          await this.projectsService.addOpening(
            projectId,
            organizationId,
            {
              type: detected.type as OpeningType,
              width_cm: detected.width_cm,
              height_cm: detected.height_cm,
              count: detected.count,
            },
            {
              source: OpeningSource.CV,
              cv_confidence: detected.confidence,
            },
          );
        }
      }

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
