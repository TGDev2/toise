import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CvAccuracyService, CvAccuracyReport } from './cv-accuracy.service';
import { CvAccuracyQueryDto } from './dto/cv-accuracy-query.dto';

const CSV_HEADER = [
  'entity_type',
  'field',
  'sample_size',
  'sufficient_data',
  'median_error_cm',
  'median_relative_error_pct',
  'min_error_cm',
  'max_error_cm',
];

function toCsvRow(
  label: { entity_type: string; field: string | null },
  metrics: CvAccuracyReport['overall'],
): string {
  return [
    label.entity_type,
    label.field ?? '',
    metrics.sample_size,
    metrics.sufficient_data,
    metrics.median_error_cm ?? '',
    metrics.median_relative_error_pct ?? '',
    metrics.min_error_cm ?? '',
    metrics.max_error_cm ?? '',
  ].join(',');
}

function toCsv(report: CvAccuracyReport): string {
  const lines = [
    CSV_HEADER.join(','),
    ...report.groups.map((group) => toCsvRow(group, group)),
    toCsvRow({ entity_type: 'overall', field: null }, report.overall),
  ];
  return lines.join('\n');
}

@Controller('admin/cv-accuracy')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class CvAccuracyController {
  constructor(private readonly cvAccuracyService: CvAccuracyService) {}

  @Get('report')
  async getReport(
    @Query() query: CvAccuracyQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const report = await this.cvAccuracyService.getReport(query.days);

    if (query.format === 'csv') {
      const date = report.generated_at.slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="cv-accuracy-${date}.csv"`,
      );
      res.send(toCsv(report));
      return;
    }

    res.json(report);
  }
}
