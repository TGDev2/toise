import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstimationResult } from './entities/estimation-result.entity';
import { EmailCapture } from './entities/email-capture.entity';
import { MaterialCatalog } from '../materials/entities/material-catalog.entity';
import { LearnedWasteFactor } from '../materials/entities/learned-waste-factor.entity';
import { WorkType } from '../projects/entities/work-type.entity';
import { ProjectsModule } from '../projects/projects.module';
import { OrgContextModule } from '../organizations/org-context.module';
import { EmailModule } from '../email/email.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EstimationEngine } from './estimation-engine';
import { EstimationsService } from './estimations.service';
import { EstimationsController } from './estimations.controller';
import { PublicCalculatorsController } from './public-calculators.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EstimationResult,
      MaterialCatalog,
      LearnedWasteFactor,
      WorkType,
      EmailCapture,
    ]),
    ProjectsModule,
    OrgContextModule,
    EmailModule,
    AnalyticsModule,
  ],
  controllers: [EstimationsController, PublicCalculatorsController],
  providers: [EstimationEngine, EstimationsService],
  exports: [EstimationsService],
})
export class EstimationsModule {}
