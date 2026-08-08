import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShoppingList } from './entities/shopping-list.entity';
import { ComplementaryMaterial } from './entities/complementary-material.entity';
import { WorkType } from '../projects/entities/work-type.entity';
import { MaterialCatalog } from '../materials/entities/material-catalog.entity';
import { MaterialEcoEquivalence } from '../materials/entities/material-eco-equivalence.entity';
import { QuantityCorrection } from '../quantity-validation/entities/quantity-correction.entity';
import { ProjectsModule } from '../projects/projects.module';
import { EstimationsModule } from '../estimations/estimations.module';
import { OrgContextModule } from '../organizations/org-context.module';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { LogbookModule } from '../logbook/logbook.module';
import { CompanyProfilesModule } from '../company-profiles/company-profiles.module';
import { ShoppingListsService } from './shopping-lists.service';
import { ShoppingListsController } from './shopping-lists.controller';
import { ShoppingListExportService } from './shopping-list-export.service';
import { ShoppingListExportController } from './shopping-list-export.controller';
import { ShoppingListSharedController } from './shopping-list-shared.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShoppingList,
      ComplementaryMaterial,
      WorkType,
      MaterialCatalog,
      MaterialEcoEquivalence,
      // E2-4 : écrite dans la transaction de `applyUpdateLocked`, via
      // l'`EntityManager` — d'où l'enregistrement ici, à l'endroit de l'écriture.
      QuantityCorrection,
    ]),
    ProjectsModule,
    EstimationsModule,
    OrgContextModule,
    FeatureGatesModule,
    AnalyticsModule,
    LogbookModule,
    CompanyProfilesModule,
  ],
  controllers: [
    ShoppingListsController,
    ShoppingListExportController,
    ShoppingListSharedController,
  ],
  providers: [ShoppingListsService, ShoppingListExportService],
  exports: [ShoppingListsService],
})
export class ShoppingListsModule {}
