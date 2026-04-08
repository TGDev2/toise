import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AnalysisJob, AnalysisJobStatus } from './entities/analysis-job.entity';
import {
  CvClientService,
  type CvAnalysisResponse,
  type CvDetectedOpening,
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

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @InjectRepository(AnalysisJob)
    private readonly jobRepo: Repository<AnalysisJob>,
    private readonly cvClient: CvClientService,
    private readonly projectsService: ProjectsService,
    private readonly photosService: PhotosService,
  ) {}

  async startAnalysis(projectId: string, userId: string): Promise<AnalysisJob> {
    // Verify project ownership
    await this.projectsService.findOneByUser(projectId, userId);

    // Verify project has photos
    const photos = await this.photosService.getProjectPhotos(projectId, userId);
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
    this.processAnalysis(saved.id, projectId, userId, imagePaths).catch((err) =>
      this.logger.error(
        `Analysis processing failed for job ${saved.id}: ${err.message}`,
      ),
    );

    return saved;
  }

  async getJobStatus(
    projectId: string,
    userId: string,
    jobId: string,
  ): Promise<AnalysisStatusDto> {
    // Verify project ownership
    await this.projectsService.findOneByUser(projectId, userId);

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
    }

    if (job.status === AnalysisJobStatus.FAILED) {
      result.error_message = job.error_message;
    }

    return result;
  }

  private async processAnalysis(
    jobId: string,
    projectId: string,
    userId: string,
    imagePaths: string[],
  ): Promise<void> {
    // Update to processing
    await this.jobRepo.update(jobId, {
      status: AnalysisJobStatus.PROCESSING,
      progress_pct: 10,
      started_at: new Date(),
    });

    try {
      // Call CV service
      const cvResponse = await this.cvClient.analyze({
        image_paths: imagePaths,
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
        result_json: cvResponse as any,
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

        await this.projectsService.updateDimensions(projectId, userId, dto, {
          source: DimensionSource.CV,
          confidence_score:
            confidenceMap[cvResponse.confidence] ?? ConfidenceScore.MEDIUM,
          raw_cv_output_json: cvResponse.raw_output,
        });
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
            userId,
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
