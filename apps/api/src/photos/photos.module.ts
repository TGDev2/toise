import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/entities/project.entity';
import { AnalyticsModule } from '../analytics/analytics.module';
import { OrgContextModule } from '../organizations/org-context.module';
import { ProjectPhoto } from './entities/project-photo.entity';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { STORAGE_PROVIDER } from './storage/storage.interface';
import { LocalStorageService } from './storage/local-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectPhoto, Project]),
    OrgContextModule,
    AnalyticsModule,
  ],
  controllers: [PhotosController],
  providers: [
    PhotosService,
    {
      provide: STORAGE_PROVIDER,
      useClass: LocalStorageService,
    },
  ],
  exports: [PhotosService],
})
export class PhotosModule {}
