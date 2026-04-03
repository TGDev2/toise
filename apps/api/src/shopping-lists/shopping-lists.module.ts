import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShoppingList } from './entities/shopping-list.entity';
import { ComplementaryMaterial } from './entities/complementary-material.entity';
import { WorkType } from '../projects/entities/work-type.entity';
import { ProjectsModule } from '../projects/projects.module';
import { EstimationsModule } from '../estimations/estimations.module';
import { UsersModule } from '../users/users.module';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ShoppingListsService } from './shopping-lists.service';
import { ShoppingListsController } from './shopping-lists.controller';
import { ShoppingListExportService } from './shopping-list-export.service';
import { ShoppingListExportController } from './shopping-list-export.controller';
import { ShoppingListSharedController } from './shopping-list-shared.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShoppingList, ComplementaryMaterial, WorkType]),
    ProjectsModule,
    EstimationsModule,
    UsersModule,
    FeatureGatesModule,
    AnalyticsModule,
  ],
  controllers: [
    ShoppingListsController,
    ShoppingListExportController,
    ShoppingListSharedController,
  ],
  providers: [ShoppingListsService, ShoppingListExportService],
})
export class ShoppingListsModule {}
