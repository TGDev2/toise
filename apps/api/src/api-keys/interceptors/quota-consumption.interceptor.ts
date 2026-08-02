import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { ApiUsageService, monthlyQuotaFor } from '../api-usage.service';
import { COUNTS_AGAINST_QUOTA } from '../decorators/counts-against-quota.decorator';

/**
 * Consomme le quota mensuel **après** que la requête a produit un résultat.
 *
 * Les gardes s'en chargeaient, et une garde s'exécute avant le `ValidationPipe` :
 * un corps invalide était facturé puis rejeté en 400. Sur la surface widget la
 * conséquence est directe — la clé `wgt_…` est publique et l'`Origin` est
 * forgeable, donc n'importe qui pouvait vider le quota mensuel d'une
 * organisation avec des corps vides, et couper le widget jusqu'au mois suivant.
 * Un intercepteur enveloppe l'exécution : son chemin de retour ne s'ouvre
 * qu'après les pipes **et** le handler, donc ni un 400 de validation ni une
 * panne du moteur ne consomment plus rien.
 *
 * Le quota reste consommé par `consume()`, incrément et décision dans la même
 * instruction : deux appels simultanés ne peuvent pas franchir la limite
 * ensemble. Détecté ici, le dépassement rend 429 — le calcul a bien eu lieu,
 * mais il n'est pas servi. Les gardes gardent une lecture seule (`peek`) en
 * amont, qui épargne au moteur le travail d'un client déjà au plafond.
 */
@Injectable()
export class QuotaConsumptionInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiUsageService: ApiUsageService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const countsAgainstQuota =
      this.reflector.get<boolean>(
        COUNTS_AGAINST_QUOTA,
        context.getHandler(),
      ) === true;

    if (!countsAgainstQuota) {
      return next.handle();
    }

    return next
      .handle()
      .pipe(concatMap((payload) => this.consumeThen(context, payload)));
  }

  private async consumeThen(
    context: ExecutionContext,
    payload: unknown,
  ): Promise<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const scope = request.widgetScope ?? request.apiKeyScope;

    // Fail-closed : une route facturée dont aucune garde n'a posé la portée est
    // une erreur de câblage. Servir gratuitement la ferait passer inaperçue.
    if (!scope) {
      throw new InternalServerErrorException(
        'Route facturée au quota sans portée organisation',
      );
    }

    const limit = monthlyQuotaFor(scope.effectiveTier);
    const usage = await this.apiUsageService.consume(scope.organizationId);

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

    return payload;
  }
}
