import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CvRetrainingService } from './cv-retraining.service';
import { AnalysisJob, AnalysisJobStatus } from './entities/analysis-job.entity';
import { CvCorrectionLog } from './entities/cv-correction-log.entity';

const detection = {
  image_path: 'project-a/img1.jpg',
  bbox_xywh: [10, 20, 50, 120],
  confidence: 0.8,
  width_cm: 90,
  height_cm: 204,
};

const jobWithBoxes = {
  id: 'job-new',
  project_id: 'project-a',
  status: AnalysisJobStatus.COMPLETED,
  completed_at: new Date('2026-07-10T10:00:00.000Z'),
  result_json: {
    status: 'success',
    raw_output: {
      opening_detector: 'yolo',
      openings_detail: [
        {
          type: 'door',
          width_cm: 90,
          height_cm: 204,
          count: 1,
          confidence: 0.8,
          boxes: [detection],
        },
      ],
      per_image: [{ image_path: 'project-a/img1.jpg', openings: [detection] }],
    },
  },
};

// Job antérieur à la capture des bbox (CV-6) : raw_output sans openings_detail
const legacyJob = {
  id: 'job-legacy',
  project_id: 'project-b',
  status: AnalysisJobStatus.COMPLETED,
  completed_at: new Date('2026-07-01T10:00:00.000Z'),
  result_json: {
    status: 'success',
    raw_output: { per_image: [{ image_path: 'project-b/img1.jpg' }] },
  },
};

const openingCorrection = {
  id: 'log-1',
  project_id: 'project-a',
  analysis_job_id: 'job-new',
  entity_type: 'opening',
  field: 'removed',
  cv_value: { opening_id: 'op-1', type: 'door' },
  user_value: { deleted: true },
  created_at: new Date('2026-07-11T10:00:00.000Z'),
};

const jobRepoMock = {
  find: jest.fn(),
};

const queryBuilderMock = {
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  addGroupBy: jest.fn().mockReturnThis(),
  getRawMany: jest.fn(),
};

const correctionRepoMock = {
  find: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
};

describe('CvRetrainingService', () => {
  let service: CvRetrainingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    jobRepoMock.find.mockResolvedValue([legacyJob, jobWithBoxes]);
    correctionRepoMock.find.mockResolvedValue([openingCorrection]);
    queryBuilderMock.getRawMany.mockResolvedValue([
      { project_id: 'project-a', entity_type: 'dimension', count: '3' },
      { project_id: 'project-a', entity_type: 'opening', count: '1' },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CvRetrainingService,
        { provide: getRepositoryToken(AnalysisJob), useValue: jobRepoMock },
        {
          provide: getRepositoryToken(CvCorrectionLog),
          useValue: correctionRepoMock,
        },
      ],
    }).compile();

    service = module.get(CvRetrainingService);
  });

  it('excludes jobs without persisted bboxes (openings_detail)', async () => {
    const result = await service.buildExport();

    expect(result.job_count).toBe(1);
    expect(result.jobs.map((j) => j.job_id)).toEqual(['job-new']);
  });

  it('shapes the export with detections, corrections and engagement counts', async () => {
    const result = await service.buildExport();
    const job = result.jobs[0];

    expect(job.opening_detector).toBe('yolo');
    expect(job.per_image).toEqual([
      { image_path: 'project-a/img1.jpg', openings: [detection] },
    ]);
    expect(job.openings_detail).toHaveLength(1);
    expect(job.corrections).toEqual([
      {
        id: 'log-1',
        field: 'removed',
        cv_value: { opening_id: 'op-1', type: 'door' },
        user_value: { deleted: true },
        created_at: '2026-07-11T10:00:00.000Z',
      },
    ]);
    expect(job.project_correction_counts).toEqual({ dimension: 3, opening: 1 });
  });

  it('only fetches opening corrections for the exported jobs', async () => {
    await service.buildExport();

    const [[findArgs]] = correctionRepoMock.find.mock.calls as [
      [{ where: { entity_type: string } }],
    ];
    expect(findArgs.where.entity_type).toBe('opening');
  });

  it('paginates via next_since on the raw page, even if all jobs are filtered', async () => {
    jobRepoMock.find.mockResolvedValue([legacyJob, jobWithBoxes]);

    const result = await service.buildExport(undefined, 2);

    // page pleine (2 jobs bruts) → curseur sur le dernier job brut
    expect(result.next_since).toBe('2026-07-10T10:00:00.000Z');
  });

  it('returns next_since null when the page is not full', async () => {
    const result = await service.buildExport(undefined, 100);
    expect(result.next_since).toBeNull();
  });

  it('applies the since filter and default limit', async () => {
    await service.buildExport(new Date('2026-07-05T00:00:00.000Z'));

    expect(jobRepoMock.find).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { completed_at: 'ASC' },
        take: 100,
      }),
    );
  });
});
