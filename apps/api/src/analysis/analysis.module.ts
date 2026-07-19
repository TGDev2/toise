import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ProjectsModule } from '../projects/projects.module';
import { PhotosModule } from '../photos/photos.module';
import { UsersModule } from '../users/users.module';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';
import { AnalysisJob } from './entities/analysis-job.entity';
import { CvCorrectionLog } from './entities/cv-correction-log.entity';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { CvClientService } from './cv-client/cv-client.service';
import { CvCorrectionService } from './cv-correction.service';
import { CvAccuracyController } from './cv-accuracy.controller';
import { CvAccuracyService } from './cv-accuracy.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalysisJob, CvCorrectionLog]),
    HttpModule,
    ProjectsModule,
    PhotosModule,
    UsersModule,
    FeatureGatesModule,
  ],
  controllers: [AnalysisController, CvAccuracyController],
  providers: [
    AnalysisService,
    CvClientService,
    CvCorrectionService,
    CvAccuracyService,
  ],
  exports: [CvCorrectionService],
})
export class AnalysisModule {}
