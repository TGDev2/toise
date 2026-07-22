import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalysisService } from './analysis.service';
import { AnalysisJob, AnalysisJobStatus } from './entities/analysis-job.entity';
import { CvClientService } from './cv-client/cv-client.service';
import { CvAccuracyService } from './cv-accuracy.service';
import { ProjectsService } from '../projects/projects.service';
import { PhotosService } from '../photos/photos.service';
import {
  ConfidenceScore,
  DimensionSource,
} from '../projects/entities/room-dimensions.entity';
import type { CvAccuracyReport } from './cv-accuracy.service';

// processAnalysis() est privée et invoquée en fire-and-forget par
// startAnalysis() — on la ré-expose ici via un cast en passant par `unknown`
// (seule façon d'outrepasser la visibilité `private` de TypeScript sans
// perdre le typage du call site) pour l'awaiter proprement plutôt que de
// dépendre du timing d'une promesse non attendue.
function callProcessAnalysis(
  service: AnalysisService,
  jobId: string,
  projectId: string,
  userId: string,
  imagePaths: string[],
): Promise<void> {
  return (
    service as unknown as {
      processAnalysis: (
        jobId: string,
        projectId: string,
        userId: string,
        imagePaths: string[],
      ) => Promise<void>;
    }
  ).processAnalysis(jobId, projectId, userId, imagePaths);
}

function makeReport(groups: CvAccuracyReport['groups'] = []): CvAccuracyReport {
  return {
    generated_at: '2026-07-22T00:00:00.000Z',
    since: null,
    days: null,
    min_sample_size: 5,
    total_corrections: 0,
    skipped_non_numeric: 0,
    groups,
    overall: {
      sample_size: 0,
      sufficient_data: false,
      median_error_cm: null,
      median_relative_error_pct: null,
      min_error_cm: null,
      max_error_cm: null,
    },
  };
}

const jobRepoMock = { findOne: jest.fn(), update: jest.fn() };
const cvClientMock = { analyze: jest.fn() };
const projectsServiceMock = {
  findOneByUser: jest.fn(),
  updateDimensions: jest.fn(),
  getDimensions: jest.fn(),
  removeCvOpenings: jest.fn(),
  addOpening: jest.fn(),
};
const photosServiceMock = { getProjectPhotos: jest.fn() };
const cvAccuracyServiceMock = { getReport: jest.fn() };

describe('AnalysisService', () => {
  let service: AnalysisService;

  beforeEach(async () => {
    jest.clearAllMocks();
    jobRepoMock.update.mockResolvedValue({});
    projectsServiceMock.findOneByUser.mockResolvedValue({ id: 'project-uuid' });
    projectsServiceMock.updateDimensions.mockResolvedValue({});
    projectsServiceMock.removeCvOpenings.mockResolvedValue(undefined);
    projectsServiceMock.addOpening.mockResolvedValue({});
    cvAccuracyServiceMock.getReport.mockResolvedValue(makeReport());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalysisService,
        { provide: getRepositoryToken(AnalysisJob), useValue: jobRepoMock },
        { provide: CvClientService, useValue: cvClientMock },
        { provide: ProjectsService, useValue: projectsServiceMock },
        { provide: PhotosService, useValue: photosServiceMock },
        { provide: CvAccuracyService, useValue: cvAccuracyServiceMock },
      ],
    }).compile();

    service = module.get(AnalysisService);
  });

  describe('processAnalysis (CV-5 uncertainty)', () => {
    const imagePaths = ['photo1.jpg'];

    it('resolves and persists a per-field uncertainty alongside the CV dimensions', async () => {
      cvClientMock.analyze.mockResolvedValue({
        status: 'success',
        dimensions: { length_cm: 420, width_cm: 310, height_cm: 250 },
        confidence: 'medium',
        confidence_score: 0.6,
        reference_detected: true,
        openings: [],
        raw_output: {},
      });

      await callProcessAnalysis(
        service,
        'job-1',
        'project-uuid',
        'user-uuid',
        imagePaths,
      );

      expect(cvAccuracyServiceMock.getReport).toHaveBeenCalled();
      expect(projectsServiceMock.updateDimensions).toHaveBeenCalledWith(
        'project-uuid',
        'user-uuid',
        { length_cm: 420, width_cm: 310, height_cm: 250 },
        expect.objectContaining({
          source: DimensionSource.CV,
          confidence_score: ConfidenceScore.MEDIUM,
          // Aucune donnée cv-accuracy suffisante dans ce test → repli
          // heuristique MEDIUM = ±8 cm (cf. dimension-uncertainty.ts).
          uncertainty: { length_cm: 8, width_cm: 8, height_cm: 8 },
        }),
      );
    });

    it('prefers the empirical median_error_cm over the heuristic band when sufficient_data', async () => {
      cvAccuracyServiceMock.getReport.mockResolvedValue(
        makeReport([
          {
            entity_type: 'dimension',
            field: 'length_cm',
            sample_size: 8,
            sufficient_data: true,
            median_error_cm: 3.5,
            median_relative_error_pct: 1,
            min_error_cm: 1,
            max_error_cm: 6,
          },
        ]),
      );
      cvClientMock.analyze.mockResolvedValue({
        status: 'success',
        dimensions: { length_cm: 420, width_cm: 310, height_cm: 250 },
        confidence: 'high',
        confidence_score: 0.9,
        reference_detected: true,
        openings: [],
        raw_output: {},
      });

      await callProcessAnalysis(
        service,
        'job-1',
        'project-uuid',
        'user-uuid',
        imagePaths,
      );

      expect(projectsServiceMock.updateDimensions).toHaveBeenCalledWith(
        'project-uuid',
        'user-uuid',
        expect.anything(),
        expect.objectContaining({
          uncertainty: { length_cm: 3.5, width_cm: 2, height_cm: 2 },
        }),
      );
    });

    it('does not call updateDimensions when the CV service found no dimensions', async () => {
      cvClientMock.analyze.mockResolvedValue({
        status: 'no_reference',
        reference_detected: false,
        openings: [],
        raw_output: {},
      });

      await callProcessAnalysis(
        service,
        'job-1',
        'project-uuid',
        'user-uuid',
        imagePaths,
      );

      expect(projectsServiceMock.updateDimensions).not.toHaveBeenCalled();
      expect(cvAccuracyServiceMock.getReport).not.toHaveBeenCalled();
    });
  });

  describe('getJobStatus (CV-5 uncertainty merge)', () => {
    it('merges the persisted per-field uncertainty into completed dimensions when source is cv', async () => {
      jobRepoMock.findOne.mockResolvedValue({
        id: 'job-1',
        status: AnalysisJobStatus.COMPLETED,
        progress_pct: 100,
        started_at: null,
        completed_at: null,
        result_json: {
          status: 'success',
          dimensions: { length_cm: 420, width_cm: 310, height_cm: 250 },
          confidence: 'medium',
          confidence_score: 0.6,
          reference_detected: true,
          openings: [],
        },
      });
      projectsServiceMock.getDimensions.mockResolvedValue({
        source: DimensionSource.CV,
        length_cm_uncertainty: 8,
        width_cm_uncertainty: 8,
        height_cm_uncertainty: 8,
      });

      const result = await service.getJobStatus(
        'project-uuid',
        'user-uuid',
        'job-1',
      );

      expect(result.dimensions).toEqual({
        length_cm: 420,
        width_cm: 310,
        height_cm: 250,
        length_cm_uncertainty: 8,
        width_cm_uncertainty: 8,
        height_cm_uncertainty: 8,
      });
    });

    it('leaves dimensions untouched when the persisted source is no longer cv (manual correction since)', async () => {
      jobRepoMock.findOne.mockResolvedValue({
        id: 'job-1',
        status: AnalysisJobStatus.COMPLETED,
        progress_pct: 100,
        started_at: null,
        completed_at: null,
        result_json: {
          status: 'success',
          dimensions: { length_cm: 420, width_cm: 310, height_cm: 250 },
          confidence: 'medium',
          confidence_score: 0.6,
          reference_detected: true,
          openings: [],
        },
      });
      projectsServiceMock.getDimensions.mockResolvedValue({
        source: DimensionSource.MANUAL,
        length_cm_uncertainty: null,
        width_cm_uncertainty: null,
        height_cm_uncertainty: null,
      });

      const result = await service.getJobStatus(
        'project-uuid',
        'user-uuid',
        'job-1',
      );

      expect(result.dimensions).toEqual({
        length_cm: 420,
        width_cm: 310,
        height_cm: 250,
      });
    });
  });
});
