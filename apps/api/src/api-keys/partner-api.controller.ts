import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EstimationsService } from '../estimations/estimations.service';
import { ApiEstimateRequestDto } from '../estimations/dto/api-estimate-request.dto';
import { ApiKeyGuard } from './guards/api-key.guard';
import { QuotaConsumptionInterceptor } from './interceptors/quota-consumption.interceptor';
import { CountsAgainstQuota } from './decorators/counts-against-quota.decorator';
import { CurrentApiKey } from './decorators/current-api-key.decorator';
import type { ApiKeyScope } from './api-key-scope';
import { ApiUsageService, monthlyQuotaFor } from './api-usage.service';

/**
 * API publique de Chiffréo (BACKLOG PLAT-5), authentifiée par clé.
 *
 * Le préfixe `partner` plutôt que `public` : `public/` désigne déjà, dans cette
 * base, les routes **sans aucune authentification** (`public/calculators`,
 * `public/analytics`). Les confondre rendrait illisible, en lecture de code,
 * la frontière entre ce qui exige un credential et ce qui n'en exige aucun.
 *
 * Périmètre volontairement étroit : calculer, savoir quoi calculer, connaître sa
 * consommation. Aucune lecture des projets, devis ou factures de
 * l'organisation — ce serait une seconde surface d'autorisation à auditer, pour
 * une valeur que le ticket ne demande pas.
 *
 * Le `@Throttle` de classe reste un plancher anti-inondation **par IP**, qui
 * protège la recherche de clé elle-même contre un flot de secrets invalides ;
 * la limite qui a du sens métier est celle par clé, appliquée dans `ApiKeyGuard`.
 * Relevé au-dessus du plafond global (100/min) : plusieurs intégrations d'un même
 * partenaire peuvent sortir par une seule IP.
 */
@Controller('partner')
@UseGuards(ApiKeyGuard)
@UseInterceptors(QuotaConsumptionInterceptor)
@Throttle({ default: { ttl: 60000, limit: 300 } })
export class PartnerApiController {
  constructor(
    private readonly estimationsService: EstimationsService,
    private readonly apiUsageService: ApiUsageService,
  ) {}

  /** Seule route facturée au quota : c'est la seule qui fasse travailler le moteur. */
  @Post('estimate')
  @CountsAgainstQuota()
  // 200 et non 201 : l'appel calcule, il ne crée aucune ressource (D7).
  @HttpCode(HttpStatus.OK)
  async estimate(@Body() dto: ApiEstimateRequestDto) {
    return this.estimationsService.estimatePublicMulti(dto);
  }

  @Get('work-types')
  async workTypes() {
    const workTypes = await this.estimationsService.listWorkTypes();
    return workTypes.map((wt) => ({
      code: wt.code,
      label_fr: wt.label_fr,
      category: wt.category,
      surface_target: wt.surface_target,
      contextual_questions: wt.contextual_questions,
    }));
  }

  @Get('usage')
  async usage(@CurrentApiKey() scope: ApiKeyScope) {
    const usage = await this.apiUsageService.peek(scope.organizationId);
    return { ...usage, limit: monthlyQuotaFor(scope.effectiveTier) };
  }
}
