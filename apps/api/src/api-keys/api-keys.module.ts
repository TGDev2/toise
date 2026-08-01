import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgContextModule } from '../organizations/org-context.module';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';
import { EstimationsModule } from '../estimations/estimations.module';
import { ApiKey } from './entities/api-key.entity';
import { ApiUsageCounter } from './entities/api-usage-counter.entity';
import { ApiKeysService } from './api-keys.service';
import { ApiUsageService } from './api-usage.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeysController } from './api-keys.controller';
import { PartnerApiController } from './partner-api.controller';

/**
 * API publique, clés et quotas (BACKLOG PLAT-5).
 *
 * `EstimationsModule` n'est importé que pour son `EstimationsService` exporté :
 * l'encapsulation Nest fait qu'aucun de ses providers internes
 * (`ProjectsService`, `EmailService`, `AnalyticsService`) n'entre dans le graphe
 * de ce module. Aucun cycle non plus — `EstimationsModule` n'importe pas celui-ci.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey, ApiUsageCounter]),
    OrgContextModule,
    FeatureGatesModule,
    EstimationsModule,
  ],
  controllers: [ApiKeysController, PartnerApiController],
  providers: [ApiKeysService, ApiUsageService, ApiKeyGuard],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
