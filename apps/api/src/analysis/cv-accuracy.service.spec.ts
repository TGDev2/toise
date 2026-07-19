import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MoreThanOrEqual } from 'typeorm';
import { CvAccuracyService } from './cv-accuracy.service';
import { CvCorrectionLog } from './entities/cv-correction-log.entity';

type Row = Pick<
  CvCorrectionLog,
  'entity_type' | 'field' | 'cv_value' | 'user_value'
>;

function row(
  entity_type: string,
  field: string | null,
  cv_value: unknown,
  user_value: unknown,
): Row {
  return { entity_type, field, cv_value, user_value };
}

const correctionRepoMock = {
  find: jest.fn(),
};

describe('CvAccuracyService', () => {
  let service: CvAccuracyService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CvAccuracyService,
        {
          provide: getRepositoryToken(CvCorrectionLog),
          useValue: correctionRepoMock,
        },
      ],
    }).compile();

    service = module.get(CvAccuracyService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns empty groups and a null overall when there are no corrections', async () => {
    correctionRepoMock.find.mockResolvedValue([]);

    const report = await service.getReport();

    expect(report.total_corrections).toBe(0);
    expect(report.skipped_non_numeric).toBe(0);
    expect(report.groups).toEqual([]);
    expect(report.overall).toEqual({
      sample_size: 0,
      sufficient_data: false,
      median_error_cm: null,
      median_relative_error_pct: null,
      min_error_cm: null,
      max_error_cm: null,
    });
  });

  it('computes the median error for an odd-sized group (below the sufficient_data threshold)', async () => {
    correctionRepoMock.find.mockResolvedValue([
      row('dimension', 'length_cm', 100, 101), // |dev|=1
      row('dimension', 'length_cm', 100, 105), // |dev|=5
      row('dimension', 'length_cm', 100, 103), // |dev|=3
    ]);

    const report = await service.getReport();

    expect(report.groups).toEqual([
      {
        entity_type: 'dimension',
        field: 'length_cm',
        sample_size: 3,
        sufficient_data: false, // 3 < MIN_SAMPLE_SIZE (5)
        median_error_cm: 3,
        median_relative_error_pct: 3, // median(1,5,3)/100 = 3%
        min_error_cm: 1,
        max_error_cm: 5,
      },
    ]);
  });

  it('computes the median error for an even-sized group and flags sufficient_data at the threshold', async () => {
    correctionRepoMock.find.mockResolvedValue([
      row('dimension', 'width_cm', 100, 100), // dev=0
      row('dimension', 'width_cm', 100, 102), // dev=2
      row('dimension', 'width_cm', 100, 104), // dev=4
      row('dimension', 'width_cm', 100, 106), // dev=6
      row('dimension', 'width_cm', 100, 108), // dev=8
    ]);

    const report = await service.getReport();

    expect(report.groups).toHaveLength(1);
    expect(report.groups[0].sample_size).toBe(5);
    expect(report.groups[0].sufficient_data).toBe(true); // 5 >= MIN_SAMPLE_SIZE
    expect(report.groups[0].median_error_cm).toBe(4); // median(0,2,4,6,8) = 4
  });

  it('excludes the relative error when cv_value is 0 but keeps the absolute error', async () => {
    correctionRepoMock.find.mockResolvedValue([
      row('dimension', 'height_cm', 0, 5),
    ]);

    const report = await service.getReport();

    expect(report.groups[0].median_error_cm).toBe(5);
    expect(report.groups[0].median_relative_error_pct).toBeNull();
  });

  it('skips non-numeric cv_value/user_value and reports them separately, without affecting group stats', async () => {
    correctionRepoMock.find.mockResolvedValue([
      row('dimension', 'length_cm', 100, 105),
      row('opening', 'width_cm', { unexpected: 'shape' }, 40),
      row('opening', 'width_cm', 40, null),
    ]);

    const report = await service.getReport();

    expect(report.total_corrections).toBe(3);
    expect(report.skipped_non_numeric).toBe(2);
    expect(report.groups).toEqual([
      expect.objectContaining({
        entity_type: 'dimension',
        field: 'length_cm',
        sample_size: 1,
      }),
    ]);
  });

  it('groups independently by entity_type and field, keeping a null field distinct from a named one', async () => {
    correctionRepoMock.find.mockResolvedValue([
      row('dimension', 'length_cm', 100, 101),
      row('dimension', 'width_cm', 100, 101),
      row('opening', 'length_cm', 100, 101),
      row('opening', null, 100, 101),
    ]);

    const report = await service.getReport();

    const keys = report.groups.map((g) => `${g.entity_type}:${g.field ?? '*'}`);
    expect(keys.sort()).toEqual([
      'dimension:length_cm',
      'dimension:width_cm',
      'opening:*',
      'opening:length_cm',
    ]);
  });

  it('computes overall as the median over the pooled deviations, not the average of per-group medians', async () => {
    const lowDeviationRows = Array.from(
      { length: 5 },
      () => row('dimension', 'length_cm', 100, 101), // dev=1, group median=1
    );
    const highDeviationRows = Array.from(
      { length: 7 },
      () => row('opening', 'width_cm', 50, 59), // dev=9, group median=9
    );
    correctionRepoMock.find.mockResolvedValue([
      ...lowDeviationRows,
      ...highDeviationRows,
    ]);

    const report = await service.getReport();

    // average-of-medians would be (1+9)/2=5; the pooled median of
    // [1,1,1,1,1,9,9,9,9,9,9,9] is 9.
    expect(report.overall.median_error_cm).toBe(9);
    expect(report.overall.sample_size).toBe(12);
    expect(report.overall.sufficient_data).toBe(true);
  });

  it('queries without a date filter by default, and with MoreThanOrEqual(since) when days is given', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-19T12:00:00.000Z'));
    correctionRepoMock.find.mockResolvedValue([]);

    await service.getReport();
    expect(correctionRepoMock.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );

    await service.getReport(30);
    const expectedSince = new Date('2026-06-19T12:00:00.000Z');
    expect(correctionRepoMock.find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { created_at: MoreThanOrEqual(expectedSince) },
      }),
    );
  });
});
