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
import { ApiEstimateRequestDto } from '../estimations/dto/api-estimate-request.dto';
import { CountsAgainstQuota } from '../api-keys/decorators/counts-against-quota.decorator';
import { QuotaConsumptionInterceptor } from '../api-keys/interceptors/quota-consumption.interceptor';
import { CurrentWidgetConfig } from './decorators/current-widget-config.decorator';
import type { WidgetConfig } from './entities/widget-config.entity';
import { WidgetOriginGuard } from './guards/widget-origin.guard';
import { WidgetService } from './widget.service';

/**
 * Surface embarquée du widget (BACKLOG PLAT-7), authentifiée par une clé
 * **non secrète** (`wgt_...`) restreinte par origine plutôt que par
 * confidentialité — cf. doc-comment de `WidgetConfig`. Distincte à la fois de
 * `public/*` (aucune authentification) et de `partner/*` (clé secrète
 * serveur-à-serveur, PLAT-5) : un troisième modèle d'accès, pas une variante.
 *
 * Le `@Throttle` de classe relève le plafond global (100/min) : cette surface est
 * appelée par les visiteurs d'un site tiers, dont beaucoup peuvent partager une
 * IP de sortie. La limite qui a du sens métier reste celle par clé, dans
 * `WidgetOriginGuard`.
 */
@Controller('widget/:widgetKey')
@UseGuards(WidgetOriginGuard)
@UseInterceptors(QuotaConsumptionInterceptor)
@Throttle({ default: { ttl: 60000, limit: 120 } })
export class WidgetPublicController {
  constructor(private readonly widgetService: WidgetService) {}

  @Get('branding')
  branding(@CurrentWidgetConfig() config: WidgetConfig) {
    return this.widgetService.publicConfig(config);
  }

  @Get('work-types')
  async workTypes() {
    const workTypes = await this.widgetService.listWorkTypes();
    return workTypes.map((wt) => ({
      code: wt.code,
      label_fr: wt.label_fr,
      category: wt.category,
      surface_target: wt.surface_target,
      contextual_questions: wt.contextual_questions,
    }));
  }

  /** Seule route facturée au quota : c'est la seule qui fasse travailler le moteur. */
  @Post('estimate')
  @CountsAgainstQuota()
  @HttpCode(HttpStatus.OK)
  async estimate(@Body() dto: ApiEstimateRequestDto) {
    return this.widgetService.estimate(dto);
  }
}
