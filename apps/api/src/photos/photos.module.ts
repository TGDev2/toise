import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/entities/project.entity';
import { AnalyticsModule } from '../analytics/analytics.module';
import { UserContextModule } from '../users/user-context.module';
import { ProjectPhoto } from './entities/project-photo.entity';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectPhoto, Project]),
    UserContextModule,
    AnalyticsModule,
    StorageModule,
  ],
  controllers: [PhotosController],
  providers: [PhotosService],
  exports: [PhotosService],
})
export class PhotosModule {}
