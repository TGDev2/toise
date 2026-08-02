import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgContextModule } from '../organizations/org-context.module';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';
import { EstimationsModule } from '../estimations/estimations.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { WidgetConfig } from './entities/widget-config.entity';
import { WidgetService } from './widget.service';
import { WidgetOriginGuard } from './guards/widget-origin.guard';
import { WidgetConfigController } from './widget-config.controller';
import { WidgetPublicController } from './widget-public.controller';

/**
 * Widget marque blanche (BACKLOG PLAT-7). `ApiKeysModule` n'est importé que
 * pour son `ApiUsageService` exporté : le widget partage le même compteur de
 * quota mensuel que l'API partenaire (PLAT-5), pas un second système — cf.
 * doc-comment de `WidgetOriginGuard`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([WidgetConfig]),
    OrgContextModule,
    FeatureGatesModule,
    EstimationsModule,
    ApiKeysModule,
  ],
  controllers: [WidgetConfigController, WidgetPublicController],
  providers: [WidgetService, WidgetOriginGuard],
  exports: [WidgetService],
})
export class WidgetModule {}
