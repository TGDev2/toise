import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/entities/project.entity';
import { CommunityProject } from '../community/entities/community-project.entity';
import { StorageModule } from '../photos/storage/storage.module';
import { DataRetentionService } from './data-retention.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, CommunityProject]),
    StorageModule,
  ],
  providers: [DataRetentionService],
  exports: [DataRetentionService],
})
export class DataRetentionModule {}
