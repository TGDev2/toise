import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { SupplierPriceCache } from './entities/supplier-price-cache.entity';
import { SupplierMaterialMatch } from './entities/supplier-material-match.entity';
import { MaterialCatalog } from '../materials/entities/material-catalog.entity';
import { PriceComparisonService } from './price-comparison.service';
import { PriceComparisonController } from './price-comparison.controller';
import { SupplierRegistry } from './adapters/supplier-registry';
import { ManoManoAdapter } from './adapters/manomano/manomano.adapter';
import { ManoManoFeedClient } from './adapters/manomano/manomano-feed.client';
import { ManoManoFeedSyncService } from './adapters/manomano/manomano-feed-sync.service';
import { ShoppingListsModule } from '../shopping-lists/shopping-lists.module';
import { UsersModule } from '../users/users.module';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SupplierPriceCache,
      SupplierMaterialMatch,
      MaterialCatalog,
    ]),
    HttpModule,
    ShoppingListsModule,
    UsersModule,
    FeatureGatesModule,
  ],
  controllers: [PriceComparisonController],
  providers: [
    PriceComparisonService,
    SupplierRegistry,
    ManoManoAdapter,
    ManoManoFeedClient,
    ManoManoFeedSyncService,
  ],
})
export class PriceComparisonModule {}
