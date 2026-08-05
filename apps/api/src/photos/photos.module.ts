import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/entities/project.entity';
import { AnalyticsModule } from '../analytics/analytics.module';
import { OrgContextModule } from '../organizations/org-context.module';
import { ProjectPhoto } from './entities/project-photo.entity';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectPhoto, Project]),
    OrgContextModule,
    AnalyticsModule,
    StorageModule,
  ],
  controllers: [PhotosController],
  providers: [PhotosService],
  exports: [PhotosService],
})
export class PhotosModule {}
