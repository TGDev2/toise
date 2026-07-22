import { resolveUncertaintyCm } from './dimension-uncertainty';
import { ConfidenceScore } from '../projects/entities/room-dimensions.entity';
import type { CvAccuracyReport } from './cv-accuracy.service';

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

describe('resolveUncertaintyCm', () => {
  it('falls back to the heuristic band per confidence level when there is no accuracy data', () => {
    const report = makeReport();
    expect(
      resolveUncertaintyCm('length_cm', ConfidenceScore.HIGH, report),
    ).toBe(2);
    expect(
      resolveUncertaintyCm('length_cm', ConfidenceScore.MEDIUM, report),
    ).toBe(8);
    expect(resolveUncertaintyCm('length_cm', ConfidenceScore.LOW, report)).toBe(
      20,
    );
  });

  it('falls back to the heuristic band when the matching group exists but lacks sufficient_data', () => {
    const report = makeReport([
      {
        entity_type: 'dimension',
        field: 'length_cm',
        sample_size: 3,
        sufficient_data: false,
        median_error_cm: 1.5,
        median_relative_error_pct: 1,
        min_error_cm: 1,
        max_error_cm: 2,
      },
    ]);
    expect(
      resolveUncertaintyCm('length_cm', ConfidenceScore.MEDIUM, report),
    ).toBe(8);
  });

  it('prefers the empirical median_error_cm once sufficient_data is reached', () => {
    const report = makeReport([
      {
        entity_type: 'dimension',
        field: 'width_cm',
        sample_size: 7,
        sufficient_data: true,
        median_error_cm: 4.5,
        median_relative_error_pct: 1.5,
        min_error_cm: 1,
        max_error_cm: 9,
      },
    ]);
    expect(resolveUncertaintyCm('width_cm', ConfidenceScore.LOW, report)).toBe(
      4.5,
    );
  });

  it('ignores groups for other entity_type/field combinations', () => {
    const report = makeReport([
      {
        entity_type: 'opening',
        field: 'width_cm',
        sample_size: 10,
        sufficient_data: true,
        median_error_cm: 3,
        median_relative_error_pct: 2,
        min_error_cm: 1,
        max_error_cm: 5,
      },
      {
        entity_type: 'dimension',
        field: 'height_cm',
        sample_size: 10,
        sufficient_data: true,
        median_error_cm: 6,
        median_relative_error_pct: 2,
        min_error_cm: 1,
        max_error_cm: 9,
      },
    ]);
    // 'width_cm' n'a pas de groupe dimension:width_cm dans ce rapport →
    // repli heuristique, pas de confusion avec opening:width_cm.
    expect(resolveUncertaintyCm('width_cm', ConfidenceScore.HIGH, report)).toBe(
      2,
    );
    expect(
      resolveUncertaintyCm('height_cm', ConfidenceScore.HIGH, report),
    ).toBe(6);
  });
});
