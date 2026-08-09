import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ProjectsModule } from '../projects/projects.module';
import { PhotosModule } from '../photos/photos.module';
import { UserContextModule } from '../users/user-context.module';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';
import { AnalysisJob } from './entities/analysis-job.entity';
import { CvCorrectionLog } from './entities/cv-correction-log.entity';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { CvClientService } from './cv-client/cv-client.service';
import { CvCorrectionService } from './cv-correction.service';
import { CvAccuracyController } from './cv-accuracy.controller';
import { CvAccuracyService } from './cv-accuracy.service';
import { CvRetrainingController } from './cv-retraining.controller';
import { CvRetrainingService } from './cv-retraining.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalysisJob, CvCorrectionLog]),
    HttpModule,
    ProjectsModule,
    PhotosModule,
    UserContextModule,
    FeatureGatesModule,
  ],
  controllers: [
    AnalysisController,
    CvAccuracyController,
    CvRetrainingController,
  ],
  providers: [
    AnalysisService,
    CvClientService,
    CvCorrectionService,
    CvAccuracyService,
    CvRetrainingService,
  ],
  exports: [CvCorrectionService],
})
export class AnalysisModule {}
