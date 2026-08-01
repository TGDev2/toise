import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';
import { ProjectsModule } from '../projects/projects.module';
import { RoomLogEntry } from './entities/room-log-entry.entity';
import { LogbookService } from './logbook.service';
import { LogbookController } from './logbook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([RoomLogEntry]),
    UsersModule,
    FeatureGatesModule,
    ProjectsModule,
  ],
  controllers: [LogbookController],
  providers: [LogbookService],
  exports: [LogbookService],
})
export class LogbookModule {}
