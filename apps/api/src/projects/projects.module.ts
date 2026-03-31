import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';
import { Project } from './entities/project.entity';
import { RoomDimensions } from './entities/room-dimensions.entity';
import { Opening } from './entities/opening.entity';
import { WorkType } from './entities/work-type.entity';
import { ProjectWorkItem } from './entities/project-work-item.entity';
import { CvCorrectionLog } from '../analysis/entities/cv-correction-log.entity';
import { AnalysisJob } from '../analysis/entities/analysis-job.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { CvCorrectionService } from '../analysis/cv-correction.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      RoomDimensions,
      Opening,
      WorkType,
      ProjectWorkItem,
      CvCorrectionLog,
      AnalysisJob,
    ]),
    UsersModule,
    FeatureGatesModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, CvCorrectionService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
