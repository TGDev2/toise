import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserContextModule } from '../users/user-context.module';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';
import { ShoppingListsModule } from '../shopping-lists/shopping-lists.module';
import { QuantityValidation } from './entities/quantity-validation.entity';
import { QuantityValidationsService } from './quantity-validations.service';
import { QuantityValidationsController } from './quantity-validations.controller';

/**
 * Ne dépend pas de `QuotesModule`, et `ShoppingListsModule` ne dépend pas de
 * lui : la trace des corrections est écrite par `ShoppingListsService` au
 * travers de l'entité seule, sans service intermédiaire, précisément pour que
 * le graphe reste acyclique.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([QuantityValidation]),
    UserContextModule,
    FeatureGatesModule,
    ShoppingListsModule,
  ],
  controllers: [QuantityValidationsController],
  providers: [QuantityValidationsService],
  exports: [QuantityValidationsService],
})
export class QuantityValidationModule {}
