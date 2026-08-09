import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
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
  findOneForUser: jest.fn(),
  applyCvAnalysis: jest.fn(),
  getDimensions: jest.fn(),
};
const photosServiceMock = { getProjectPhotos: jest.fn() };
const cvAccuracyServiceMock = { getReport: jest.fn() };
const configServiceMock = { get: jest.fn() };

describe('AnalysisService', () => {
  let service: AnalysisService;

  beforeEach(async () => {
    jest.clearAllMocks();
    jobRepoMock.update.mockResolvedValue({});
    projectsServiceMock.findOneForUser.mockResolvedValue({
      id: 'project-uuid',
    });
    projectsServiceMock.applyCvAnalysis.mockResolvedValue(undefined);
    cvAccuracyServiceMock.getReport.mockResolvedValue(makeReport());
    // `processAnalysis`/`getJobStatus` ne passent pas par le coupure-circuit
    // CV_ENABLED (posé dans `startAnalysis`) : ce défaut à `true` ne les
    // affecte pas, seul le describe dédié ci-dessous le fait varier.
    configServiceMock.get.mockReturnValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalysisService,
        { provide: getRepositoryToken(AnalysisJob), useValue: jobRepoMock },
        { provide: CvClientService, useValue: cvClientMock },
        { provide: ProjectsService, useValue: projectsServiceMock },
        { provide: PhotosService, useValue: photosServiceMock },
        { provide: CvAccuracyService, useValue: cvAccuracyServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
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
      expect(projectsServiceMock.applyCvAnalysis).toHaveBeenCalledWith(
        'project-uuid',
        'user-uuid',
        expect.objectContaining({
          dimensions: { length_cm: 420, width_cm: 310, height_cm: 250 },
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

      expect(projectsServiceMock.applyCvAnalysis).toHaveBeenCalledWith(
        'project-uuid',
        'user-uuid',
        expect.objectContaining({
          uncertainty: { length_cm: 3.5, width_cm: 2, height_cm: 2 },
        }),
      );
    });

    it('does not touch the project when the CV service found no dimensions', async () => {
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

      expect(projectsServiceMock.applyCvAnalysis).not.toHaveBeenCalled();
      expect(cvAccuracyServiceMock.getReport).not.toHaveBeenCalled();
    });

    it('transmet une liste d’ouvertures vide plutôt que de sauter le remplacement', async () => {
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

      // Une analyse qui ne détecte rien doit effacer les ouvertures de la
      // précédente : c'est `applyCvAnalysis` qui remplace, encore faut-il
      // qu'on l'appelle.
      expect(projectsServiceMock.applyCvAnalysis).toHaveBeenCalledWith(
        'project-uuid',
        'user-uuid',
        expect.objectContaining({ openings: [] }),
      );
    });

    it('ne marque COMPLETED qu’après avoir écrit le projet', async () => {
      cvClientMock.analyze.mockResolvedValue({
        status: 'success',
        dimensions: { length_cm: 420, width_cm: 310, height_cm: 250 },
        confidence: 'medium',
        confidence_score: 0.6,
        reference_detected: true,
        openings: [],
        raw_output: {},
      });
      projectsServiceMock.applyCvAnalysis.mockRejectedValueOnce(
        new Error('écriture refusée'),
      );

      await callProcessAnalysis(
        service,
        'job-1',
        'project-uuid',
        'user-uuid',
        imagePaths,
      );

      expect(jobRepoMock.update).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({ status: AnalysisJobStatus.FAILED }),
      );
      expect(jobRepoMock.update).not.toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({ status: AnalysisJobStatus.COMPLETED }),
      );
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

  describe('startAnalysis (coupure-circuit CV_ENABLED)', () => {
    it('refuse proprement quand le service CV est débranché, sans toucher au projet ni au job', async () => {
      configServiceMock.get.mockReturnValue(false);

      await expect(
        service.startAnalysis('project-uuid', 'user-uuid'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(
        service.startAnalysis('project-uuid', 'user-uuid'),
      ).rejects.toThrow(
        "L'analyse photo par intelligence artificielle n'est pas disponible actuellement. Merci de saisir les dimensions manuellement.",
      );

      expect(projectsServiceMock.findOneForUser).not.toHaveBeenCalled();
      expect(photosServiceMock.getProjectPhotos).not.toHaveBeenCalled();
      expect(cvClientMock.analyze).not.toHaveBeenCalled();
    });
  });
});
