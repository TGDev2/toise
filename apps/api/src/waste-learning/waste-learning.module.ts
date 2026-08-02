import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { ShoppingList } from '../shopping-lists/entities/shopping-list.entity';
import { EstimationResult } from '../estimations/entities/estimation-result.entity';
import { Project } from '../projects/entities/project.entity';
import { WasteFactor } from '../materials/entities/waste-factor.entity';
import { LearnedWasteFactor } from '../materials/entities/learned-waste-factor.entity';
import { WasteLearningController } from './waste-learning.controller';
import { WasteLearningService } from './waste-learning.service';

/**
 * BACKLOG DATA-3. N'importe que des entités, jamais les services des modules
 * source : l'apprentissage lit des données déjà écrites (listes finalisées,
 * estimations) et n'a besoin d'aucun de leurs comportements — l'y coupler
 * créerait un cycle avec `ShoppingListsModule` sans rien apporter.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShoppingList,
      EstimationResult,
      Project,
      WasteFactor,
      LearnedWasteFactor,
    ]),
    // AdminGuard (AuthModule, @Global()) dépend de UsersService — même raison
    // que dans admin-analytics.module.ts.
    UsersModule,
  ],
  controllers: [WasteLearningController],
  providers: [WasteLearningService],
})
export class WasteLearningModule {}
