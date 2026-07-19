import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, MoreThanOrEqual, Repository } from 'typeorm';
import { CvCorrectionLog } from './entities/cv-correction-log.entity';

// Sous ce seuil, une médiane n'est pas fiable pour communiquer publiquement
// sur la précision (CV-2 est le prérequis explicite de cette communication).
const MIN_SAMPLE_SIZE = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CvAccuracyMetrics {
  sample_size: number;
  sufficient_data: boolean;
  median_error_cm: number | null;
  median_relative_error_pct: number | null;
  min_error_cm: number | null;
  max_error_cm: number | null;
}

export interface CvAccuracyGroup extends CvAccuracyMetrics {
  entity_type: string;
  field: string | null;
}

export interface CvAccuracyReport {
  generated_at: string;
  since: string | null;
  days: number | null;
  min_sample_size: number;
  total_corrections: number;
  skipped_non_numeric: number;
  groups: CvAccuracyGroup[];
  overall: CvAccuracyMetrics;
}

interface Deviation {
  absolute: number;
  relative: number | null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// Écart médian au sens du backlog (médiane de |cv - user|), pas la "median
// absolute deviation" statistique (médiane de l'écart à la médiane).
function summarizeDeviations(deviations: Deviation[]): CvAccuracyMetrics {
  if (deviations.length === 0) {
    return {
      sample_size: 0,
      sufficient_data: false,
      median_error_cm: null,
      median_relative_error_pct: null,
      min_error_cm: null,
      max_error_cm: null,
    };
  }

  const absolutes = deviations.map((d) => d.absolute);
  const relatives = deviations
    .map((d) => d.relative)
    .filter((r): r is number => r !== null);

  return {
    sample_size: deviations.length,
    sufficient_data: deviations.length >= MIN_SAMPLE_SIZE,
    median_error_cm: round2(median(absolutes)),
    median_relative_error_pct:
      relatives.length > 0 ? round2(median(relatives) * 100) : null,
    min_error_cm: round2(Math.min(...absolutes)),
    max_error_cm: round2(Math.max(...absolutes)),
  };
}

@Injectable()
export class CvAccuracyService {
  constructor(
    @InjectRepository(CvCorrectionLog)
    private readonly correctionRepo: Repository<CvCorrectionLog>,
  ) {}

  async getReport(days?: number): Promise<CvAccuracyReport> {
    const since = days ? new Date(Date.now() - days * DAY_MS) : null;
    const where: FindOptionsWhere<CvCorrectionLog> = since
      ? { created_at: MoreThanOrEqual(since) }
      : {};

    const rows = await this.correctionRepo.find({
      where,
      select: ['entity_type', 'field', 'cv_value', 'user_value'],
    });

    let skippedNonNumeric = 0;
    const byGroup = new Map<
      string,
      { entity_type: string; field: string | null; deviations: Deviation[] }
    >();

    for (const row of rows) {
      if (!isFiniteNumber(row.cv_value) || !isFiniteNumber(row.user_value)) {
        skippedNonNumeric += 1;
        continue;
      }

      const absolute = Math.abs(row.user_value - row.cv_value);
      const relative =
        row.cv_value !== 0 ? absolute / Math.abs(row.cv_value) : null;

      const key = `${row.entity_type}:${row.field ?? '*'}`;
      let group = byGroup.get(key);
      if (!group) {
        group = {
          entity_type: row.entity_type,
          field: row.field,
          deviations: [],
        };
        byGroup.set(key, group);
      }
      group.deviations.push({ absolute, relative });
    }

    const groups: CvAccuracyGroup[] = Array.from(byGroup.values())
      .map((group) => ({
        entity_type: group.entity_type,
        field: group.field,
        ...summarizeDeviations(group.deviations),
      }))
      .sort(
        (a, b) =>
          a.entity_type.localeCompare(b.entity_type) ||
          (a.field ?? '').localeCompare(b.field ?? ''),
      );

    const allDeviations = Array.from(byGroup.values()).flatMap(
      (group) => group.deviations,
    );

    return {
      generated_at: new Date().toISOString(),
      since: since ? since.toISOString() : null,
      days: days ?? null,
      min_sample_size: MIN_SAMPLE_SIZE,
      total_corrections: rows.length,
      skipped_non_numeric: skippedNonNumeric,
      groups,
      overall: summarizeDeviations(allDeviations),
    };
  }
}
