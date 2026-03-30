import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ProjectsModule } from '../projects/projects.module';
import { PhotosModule } from '../photos/photos.module';
import { UsersModule } from '../users/users.module';
import { AnalysisJob } from './entities/analysis-job.entity';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { CvClientService } from './cv-client/cv-client.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalysisJob]),
    HttpModule,
    ProjectsModule,
    PhotosModule,
    UsersModule,
  ],
  controllers: [AnalysisController],
  providers: [AnalysisService, CvClientService],
})
export class AnalysisModule {}
