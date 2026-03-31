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

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalysisJob, CvCorrectionLog]),
    HttpModule,
    ProjectsModule,
    PhotosModule,
    UsersModule,
    FeatureGatesModule,
  ],
  controllers: [AnalysisController],
  providers: [AnalysisService, CvClientService, CvCorrectionService],
  exports: [CvCorrectionService],
})
export class AnalysisModule {}
