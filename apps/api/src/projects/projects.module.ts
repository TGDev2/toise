import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgContextModule } from '../organizations/org-context.module';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { Project } from './entities/project.entity';
import { Room } from './entities/room.entity';
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
      Room,
      RoomDimensions,
      Opening,
      WorkType,
      ProjectWorkItem,
      CvCorrectionLog,
      AnalysisJob,
    ]),
    OrgContextModule,
    FeatureGatesModule,
    // `ProjectsService` injecte `AnalyticsService` sans que ce module ne le
    // fournisse : le graphe d'injection ne se résolvait plus, donc l'application
    // ne démarrait plus. Seul `module-graph.int-spec.ts` peut voir ce défaut —
    // les 1 112 tests unitaires et 156 tests e2e restaient verts.
    AnalyticsModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, CvCorrectionService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
