import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { OrgContextService } from '../../organizations/org-context.service';
import type { SubscriptionTier } from '../../users/entities/user.entity';
import { FeatureGatesService } from '../../feature-gates/feature-gates.service';
import { PUBLIC_API_FEATURE_KEY } from '../../api-keys/guards/api-key.guard';
import {
  ApiUsageService,
  monthlyQuotaFor,
} from '../../api-keys/api-usage.service';
import { COUNTS_AGAINST_QUOTA } from '../../api-keys/decorators/counts-against-quota.decorator';
import { WidgetService } from '../widget.service';

/**
 * Rafale par clé de widget (BACKLOG PLAT-7), plus haute que celle des clés
 * d'API (60/min, `ApiKeyGuard`) : une clé de widget est appelée par de
 * nombreux visiteurs indépendants d'un même site embarquant le widget, pas
 * par une seule intégration serveur-à-serveur. Plafonner au même niveau
 * qu'une clé d'API produirait des faux positifs sur exactement le cas d'usage
 * visé par ce ticket (un média à fort trafic).
 */
const BURST_TTL_MS = 60_000;
const BURST_LIMIT = 120;
const BURST_THROTTLER_NAME = 'widget-key';

/**
 * Authentification du widget par clé non secrète + origine (BACKLOG PLAT-7).
 *
 * Le quota mensuel est le **même compteur** que celui de l'API partenaire
 * (PLAT-5, `ApiUsageService`) : un widget très fréquenté et des appels directs
 * à `/partner` consomment un seul budget par organisation — pas de second
 * système de quota pour ce canal. Cf. tasks/todo.md §PLAT-7.
 *
 * `Origin` n'est vérifié qu'au sens du navigateur : un appelant scripté qui
 * détient déjà la clé peut forger cet en-tête. Acceptable ici parce que
 * l'endpoint ne fait que du calcul de quantités, sans persistance ni prix —
 * le pire cas est une consommation de quota, pas une fuite de données.
 */
@Injectable()
export class WidgetOriginGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly widgetService: WidgetService,
    private readonly apiUsageService: ApiUsageService,
    private readonly orgContext: OrgContextService,
    private readonly featureGatesService: FeatureGatesService,
    @Inject(ThrottlerStorage)
    private readonly throttlerStorage: ThrottlerStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Toujours une string simple en pratique : la route ne déclare pas de
    // segment `:widgetKey*`, seul cas où Express en ferait un tableau.
    const widgetKey = request.params.widgetKey as string;
    const config = await this.widgetService.findActiveByKey(widgetKey);
    if (!config || !config.enabled) {
      throw new NotFoundException({
        message: 'Widget introuvable',
        error: 'WIDGET_NOT_FOUND',
      });
    }

    const origin = request.headers.origin;
    if (!origin) {
      throw new ForbiddenException({
        message: 'En-tête Origin requis',
        error: 'ORIGIN_REQUIRED',
      });
    }
    if (!config.allowed_origins.includes(origin)) {
      throw new ForbiddenException({
        message: "Cette origine n'est pas autorisée pour ce widget",
        error: 'ORIGIN_NOT_ALLOWED',
      });
    }

    const effectiveTier = await this.orgContext.resolveTierForOrganization(
      config.organization_id,
    );
    const allowed = await this.featureGatesService.isFeatureAllowed(
      PUBLIC_API_FEATURE_KEY,
      effectiveTier,
    );
    if (!allowed) {
      const gate = await this.featureGatesService.getGateConfig(
        PUBLIC_API_FEATURE_KEY,
      );
      throw new ForbiddenException({
        message: 'Le widget nécessite un abonnement Contractor Premium',
        error: 'FEATURE_GATED',
        feature_key: PUBLIC_API_FEATURE_KEY,
        required_tier: gate?.min_tier ?? 'contractor_premium',
        current_tier: effectiveTier,
      });
    }

    await this.enforceBurstLimit(config.id, response);

    if (this.countsAgainstQuota(context)) {
      await this.enforceMonthlyQuota(
        config.organization_id,
        effectiveTier,
        response,
      );
    }

    request.widgetScope = {
      widgetConfigId: config.id,
      organizationId: config.organization_id,
      effectiveTier,
      origin,
    };
    request.widgetConfig = config;

    return true;
  }

  // ---------------------------------------------------------------------------

  private countsAgainstQuota(context: ExecutionContext): boolean {
    return (
      this.reflector.get<boolean>(
        COUNTS_AGAINST_QUOTA,
        context.getHandler(),
      ) === true
    );
  }

  private async enforceBurstLimit(
    widgetConfigId: string,
    response: Response,
  ): Promise<void> {
    const record = await this.throttlerStorage.increment(
      `${BURST_THROTTLER_NAME}:${widgetConfigId}`,
      BURST_TTL_MS,
      BURST_LIMIT,
      BURST_TTL_MS,
      BURST_THROTTLER_NAME,
    );
    if (record.isBlocked) {
      response.setHeader('Retry-After', Math.max(1, record.timeToBlockExpire));
      throw new HttpException(
        {
          message: `Limite de ${BURST_LIMIT} requêtes par minute dépassée pour ce widget`,
          error: 'RATE_LIMIT_EXCEEDED',
          limit: BURST_LIMIT,
          retry_after_seconds: Math.max(1, record.timeToBlockExpire),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async enforceMonthlyQuota(
    organizationId: string,
    effectiveTier: SubscriptionTier,
    response: Response,
  ): Promise<void> {
    const limit = monthlyQuotaFor(effectiveTier);
    const usage = await this.apiUsageService.consume(organizationId);

    if (usage.count > limit) {
      const retryAfter = Math.max(
        1,
        Math.ceil((usage.reset_at.getTime() - Date.now()) / 1000),
      );
      response.setHeader('Retry-After', retryAfter);
      throw new HttpException(
        {
          message: `Quota mensuel de ${limit} requêtes atteint`,
          error: 'QUOTA_EXCEEDED',
          limit,
          current: usage.count,
          period: usage.period,
          reset_at: usage.reset_at,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
