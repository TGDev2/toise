import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { SupplierPriceCache } from './entities/supplier-price-cache.entity';
import { PriceComparisonService } from './price-comparison.service';
import { PriceComparisonController } from './price-comparison.controller';
import { SupplierRegistry } from './adapters/supplier-registry';
import { ShoppingListsModule } from '../shopping-lists/shopping-lists.module';
import { UsersModule } from '../users/users.module';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SupplierPriceCache]),
    HttpModule,
    ShoppingListsModule,
    UsersModule,
    FeatureGatesModule,
  ],
  controllers: [PriceComparisonController],
  providers: [PriceComparisonService, SupplierRegistry],
})
export class PriceComparisonModule {}
