import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';
import { ProjectsModule } from '../projects/projects.module';
import { SiteMilestone } from './entities/site-milestone.entity';
import { SiteTrackingService } from './site-tracking.service';
import { SiteTrackingController } from './site-tracking.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SiteMilestone]),
    UsersModule,
    FeatureGatesModule,
    ProjectsModule,
  ],
  controllers: [SiteTrackingController],
  providers: [SiteTrackingService],
})
export class SiteTrackingModule {}
