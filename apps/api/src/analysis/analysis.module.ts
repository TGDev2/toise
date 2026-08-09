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
import { CvAccuracyService } from './cv-accuracy.service';

/**
 * ADR 0001 D2 : la vision par ordinateur est débranchée, son code reste dans
 * git. E4-2 a retiré les deux contrôleurs d'administration qui n'avaient aucun
 * point d'entrée (`admin/cv-accuracy`, `admin/cv-retraining`) ; le reste du
 * module est intact.
 *
 * `CvAccuracyService` **n'est pas** une surface d'administration malgré son
 * ancien contrôleur : `AnalysisService` l'appelle pour dater l'incertitude
 * dimensionnelle (CV-5) persistée sur `room_dimensions`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AnalysisJob, CvCorrectionLog]),
    HttpModule,
    ProjectsModule,
    PhotosModule,
    UserContextModule,
    FeatureGatesModule,
  ],
  controllers: [AnalysisController],
  providers: [
    AnalysisService,
    CvClientService,
    CvCorrectionService,
    CvAccuracyService,
  ],
  exports: [CvCorrectionService],
})
export class AnalysisModule {}
