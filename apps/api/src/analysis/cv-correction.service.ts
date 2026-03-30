import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CvCorrectionLog } from './entities/cv-correction-log.entity';
import { AnalysisJob, AnalysisJobStatus } from './entities/analysis-job.entity';

@Injectable()
export class CvCorrectionService {
  private readonly logger = new Logger(CvCorrectionService.name);

  constructor(
    @InjectRepository(CvCorrectionLog)
    private readonly correctionRepo: Repository<CvCorrectionLog>,
    @InjectRepository(AnalysisJob)
    private readonly jobRepo: Repository<AnalysisJob>,
  ) {}

  /**
   * Log a correction when the user modifies CV-detected values.
   */
  async logCorrection(
    projectId: string,
    entityType: 'dimension' | 'opening',
    field: string | null,
    cvValue: unknown,
    userValue: unknown,
  ): Promise<void> {
    // Find the latest completed analysis job for this project
    const latestJob = await this.jobRepo.findOne({
      where: {
        project_id: projectId,
        status: AnalysisJobStatus.COMPLETED,
      },
      order: { completed_at: 'DESC' },
    });

    if (!latestJob) {
      this.logger.debug(
        `No completed analysis job for project ${projectId}, skipping correction log`,
      );
      return;
    }

    const log = this.correctionRepo.create({
      project_id: projectId,
      analysis_job_id: latestJob.id,
      entity_type: entityType,
      field,
      cv_value: cvValue,
      user_value: userValue,
    });

    await this.correctionRepo.save(log);
    this.logger.log(
      `Correction logged for project ${projectId}: ${entityType}.${field ?? '*'}`,
    );
  }
}
