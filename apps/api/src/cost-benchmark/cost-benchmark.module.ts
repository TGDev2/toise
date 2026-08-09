import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { UserContextModule } from '../users/user-context.module';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';
import { ShoppingList } from '../shopping-lists/entities/shopping-list.entity';
import { EstimationResult } from '../estimations/entities/estimation-result.entity';
import { Project } from '../projects/entities/project.entity';
import { CostBenchmark } from './entities/cost-benchmark.entity';
import { CostBenchmarkController } from './cost-benchmark.controller';
import { AdminCostBenchmarkController } from './admin-cost-benchmark.controller';
import { CostBenchmarkService } from './cost-benchmark.service';

/**
 * BACKLOG DATA-4. Comme `WasteLearningModule`, n'importe que des entités et
 * jamais les services des modules source : le benchmark lit des données déjà
 * écrites (listes finalisées, estimations) et n'a besoin d'aucun de leurs
 * comportements — l'y coupler créerait un cycle avec `ShoppingListsModule`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShoppingList,
      EstimationResult,
      Project,
      CostBenchmark,
    ]),
    // AdminGuard (AuthModule, @Global()) dépend de UsersService — même raison
    // que dans waste-learning.module.ts.
    UsersModule,
    UserContextModule,
    FeatureGatesModule,
  ],
  controllers: [CostBenchmarkController, AdminCostBenchmarkController],
  providers: [CostBenchmarkService],
})
export class CostBenchmarkModule {}
