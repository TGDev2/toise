import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { OrgContextService } from '../../organizations/org-context.service';
import type { SubscriptionTier } from '../../users/entities/user.entity';
import { FeatureGatesService } from '../../feature-gates/feature-gates.service';
import { API_KEY_PREFIX, ApiKeysService } from '../api-keys.service';
import { ApiUsageService, monthlyQuotaFor } from '../api-usage.service';
import { COUNTS_AGAINST_QUOTA } from '../decorators/counts-against-quota.decorator';

export const PUBLIC_API_FEATURE_KEY = 'public_api';

/**
 * Rafale par clé, en complément du quota mensuel. Le throttler global du repo
 * suit l'**IP**, ce qui est faux pour un appel serveur-à-serveur : deux clients
 * hébergés derrière la même sortie (Make, n8n, un PaaS mutualisé) partageraient
 * un compteur. On garde donc le throttler global comme plancher anti-inondation
 * et on ajoute ici la limite qui a du sens métier, indexée sur la clé.
 *
 * Le stockage est le `Map` en mémoire du throttler, comme partout ailleurs dans
 * cette API : la rafale se multiplie donc par le nombre d'instances. Le quota
 * mensuel, lui, est en Postgres et ne dérive pas — cette asymétrie est voulue,
 * c'est le compteur facturable qui doit être exact.
 */
const BURST_TTL_MS = 60_000;
const BURST_LIMIT = 60;
const BURST_THROTTLER_NAME = 'api-key';

/**
 * Authentification par clé d'API (BACKLOG PLAT-5).
 *
 * Fail-closed à chaque étape, et dans cet ordre précis : identité, puis droit
 * d'accès au palier, puis rafale, puis quota. La rafale **avant** le quota est
 * délibéré — sinon une requête rejetée pour rafale aurait déjà consommé du
 * quota mensuel facturable.
 *
 * Le secret n'est jamais journalisé, en succès comme en échec.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeysService: ApiKeysService,
    private readonly apiUsageService: ApiUsageService,
    private readonly orgContext: OrgContextService,
    private readonly featureGatesService: FeatureGatesService,
    @Inject(ThrottlerStorage)
    private readonly throttlerStorage: ThrottlerStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const secret = this.extractSecret(request);
    const key = await this.apiKeysService.findBySecret(secret);

    if (!key) {
      throw new UnauthorizedException({
        message: "Clé d'API inconnue",
        error: 'INVALID_API_KEY',
      });
    }
    if (key.revoked_at) {
      throw new UnauthorizedException({
        message: "Cette clé d'API a été révoquée",
        error: 'API_KEY_REVOKED',
      });
    }
    // Empreinte de rotation : acceptée uniquement pendant la fenêtre de grâce.
    if (this.apiKeysService.matchesRotatedHash(key, secret)) {
      const graceUntil = key.previous_key_expires_at;
      if (!graceUntil || graceUntil.getTime() <= Date.now()) {
        throw new UnauthorizedException({
          message:
            'La période de grâce de rotation est terminée : utilisez la nouvelle clé',
          error: 'API_KEY_ROTATION_EXPIRED',
        });
      }
    }

    // Le palier est réévalué à chaque requête : une rétrogradation ou un impayé
    // éteint la clé sans qu'aucun traitement différé n'ait à passer.
    const effectiveTier = await this.orgContext.resolveTierForOrganization(
      key.organization_id,
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
        message: "L'API publique nécessite un abonnement Contractor Premium",
        error: 'FEATURE_GATED',
        feature_key: PUBLIC_API_FEATURE_KEY,
        required_tier: gate?.min_tier ?? 'contractor_premium',
        current_tier: effectiveTier,
      });
    }

    await this.enforceBurstLimit(key.id, response);

    if (this.countsAgainstQuota(context)) {
      await this.enforceMonthlyQuota(
        key.organization_id,
        effectiveTier,
        response,
      );
    }

    request.apiKeyScope = {
      apiKeyId: key.id,
      organizationId: key.organization_id,
      effectiveTier,
    };
    this.apiKeysService.touchLastUsed(key.id);

    return true;
  }

  // ---------------------------------------------------------------------------

  /**
   * Le préfixe `chf_` est exigé avant toute recherche : il distingue
   * immédiatement une clé d'API d'un jeton Firebase envoyé par erreur sur la
   * mauvaise surface, et rend le message d'erreur exploitable.
   */
  private extractSecret(request: Request): string {
    const authHeader = request.headers.authorization;
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        message: "En-tête d'autorisation manquant ou invalide",
        error: 'INVALID_API_KEY_FORMAT',
      });
    }
    const secret = authHeader.slice('Bearer '.length).trim();
    if (!secret.startsWith(API_KEY_PREFIX)) {
      throw new UnauthorizedException({
        message: `Une clé d'API commence par « ${API_KEY_PREFIX} »`,
        error: 'INVALID_API_KEY_FORMAT',
      });
    }
    return secret;
  }

  private countsAgainstQuota(context: ExecutionContext): boolean {
    return (
      this.reflector.get<boolean>(
        COUNTS_AGAINST_QUOTA,
        context.getHandler(),
      ) === true
    );
  }

  private async enforceBurstLimit(
    apiKeyId: string,
    response: Response,
  ): Promise<void> {
    const record = await this.throttlerStorage.increment(
      `${BURST_THROTTLER_NAME}:${apiKeyId}`,
      BURST_TTL_MS,
      BURST_LIMIT,
      BURST_TTL_MS,
      BURST_THROTTLER_NAME,
    );
    if (record.isBlocked) {
      response.setHeader('Retry-After', Math.max(1, record.timeToBlockExpire));
      throw new HttpException(
        {
          message: `Limite de ${BURST_LIMIT} requêtes par minute dépassée pour cette clé`,
          error: 'RATE_LIMIT_EXCEEDED',
          limit: BURST_LIMIT,
          retry_after_seconds: Math.max(1, record.timeToBlockExpire),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Refus en amont d'un client **déjà** au plafond : lecture seule, donc une
   * requête invalide ne consomme plus rien. La consommation atomique a lieu
   * après le handler (`QuotaConsumptionInterceptor`) — elle avait lieu ici,
   * avant le `ValidationPipe`, et facturait donc les corps rejetés en 400.
   */
  private async enforceMonthlyQuota(
    organizationId: string,
    effectiveTier: SubscriptionTier,
    response: Response,
  ): Promise<void> {
    const limit = monthlyQuotaFor(effectiveTier);
    const usage = await this.apiUsageService.peek(organizationId);

    if (usage.count >= limit) {
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
