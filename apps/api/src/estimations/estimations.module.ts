import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstimationResult } from './entities/estimation-result.entity';
import { MaterialCatalog } from '../materials/entities/material-catalog.entity';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/users.module';
import { EstimationEngine } from './estimation-engine';
import { EstimationsService } from './estimations.service';
import { EstimationsController } from './estimations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([EstimationResult, MaterialCatalog]),
    ProjectsModule,
    UsersModule,
  ],
  controllers: [EstimationsController],
  providers: [EstimationEngine, EstimationsService],
  exports: [EstimationsService],
})
export class EstimationsModule {}
