import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstimationResult } from './entities/estimation-result.entity';
import { EmailCapture } from './entities/email-capture.entity';
import { LearnedWasteFactor } from '../materials/entities/learned-waste-factor.entity';
import { WorkTypeMaterial } from '../materials/entities/work-type-material.entity';
import { WorkType } from '../projects/entities/work-type.entity';
import { ProjectsModule } from '../projects/projects.module';
import { UserContextModule } from '../users/user-context.module';
import { EmailModule } from '../email/email.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EstimationEngine } from './estimation-engine';
import { EstimationsService } from './estimations.service';
import { EstimationsController } from './estimations.controller';
import { PublicCalculatorsController } from './public-calculators.controller';
import { PublicQuoteCheckController } from './public-quote-check.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EstimationResult,
      LearnedWasteFactor,
      WorkTypeMaterial,
      WorkType,
      EmailCapture,
    ]),
    ProjectsModule,
    UserContextModule,
    EmailModule,
    AnalyticsModule,
  ],
  controllers: [
    EstimationsController,
    PublicCalculatorsController,
    PublicQuoteCheckController,
  ],
  providers: [EstimationEngine, EstimationsService],
  exports: [EstimationsService],
})
export class EstimationsModule {}
