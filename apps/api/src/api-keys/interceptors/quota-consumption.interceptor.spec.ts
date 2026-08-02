import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import { SubscriptionTier } from '../../users/entities/user.entity';
import { ApiUsageService } from '../api-usage.service';
import { QuotaConsumptionInterceptor } from './quota-consumption.interceptor';

const ORG_ID = '00000000-0000-4000-8000-0000000000aa';

describe('QuotaConsumptionInterceptor', () => {
  let interceptor: QuotaConsumptionInterceptor;

  const reflector = { get: jest.fn() } as unknown as Reflector;
  const apiUsage = { consume: jest.fn(), peek: jest.fn() };

  const request: {
    widgetScope?: { organizationId: string; effectiveTier: SubscriptionTier };
    apiKeyScope?: { organizationId: string; effectiveTier: SubscriptionTier };
  } = {};
  const response = { setHeader: jest.fn() };
  const context = {
    getHandler: () => jest.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    request.widgetScope = undefined;
    request.apiKeyScope = {
      organizationId: ORG_ID,
      effectiveTier: SubscriptionTier.CONTRACTOR_PREMIUM,
    };
    apiUsage.consume.mockResolvedValue({
      period: '2026-08',
      count: 1,
      reset_at: new Date(Date.now() + 86_400_000),
    });
    (reflector.get as jest.Mock).mockReturnValue(true);

    interceptor = new QuotaConsumptionInterceptor(
      reflector,
      apiUsage as unknown as ApiUsageService,
    );
  });

  const handlerReturning = (payload: unknown) => ({
    handle: () => of(payload),
  });
  const handlerThrowing = (error: Error) => ({
    handle: () => throwError(() => error),
  });

  it('consomme une unité quand le handler a produit un résultat', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(context, handlerReturning({ total: 3 })),
    );

    expect(result).toEqual({ total: 3 });
    expect(apiUsage.consume).toHaveBeenCalledWith(ORG_ID);
  });

  /**
   * Le constat 2.9 en un test : un corps invalide est rejeté par le
   * `ValidationPipe`, qui s'exécute **après** les gardes. Tant que le garde
   * débitait, chaque 400 coûtait une unité de quota — 10 000 requêtes vides
   * suffisaient à couper le widget jusqu'au mois suivant. L'erreur remonte ici
   * par le chemin d'erreur de l'observable, qui ne débite rien.
   */
  it('ne consomme rien quand la validation du corps a échoué', async () => {
    const validationError = new BadRequestException([
      'work_type_code manquant',
    ]);

    await expect(
      firstValueFrom(
        interceptor.intercept(context, handlerThrowing(validationError)),
      ),
    ).rejects.toBe(validationError);

    expect(apiUsage.consume).not.toHaveBeenCalled();
  });

  it('ne consomme rien quand le moteur a échoué', async () => {
    const engineError = new Error('estimation engine failed');

    await expect(
      firstValueFrom(
        interceptor.intercept(context, handlerThrowing(engineError)),
      ),
    ).rejects.toBe(engineError);

    expect(apiUsage.consume).not.toHaveBeenCalled();
  });

  it('ne consomme rien sur une route non marquée @CountsAgainstQuota', async () => {
    (reflector.get as jest.Mock).mockReturnValue(undefined);

    await firstValueFrom(
      interceptor.intercept(context, handlerReturning({ total: 1 })),
    );

    expect(apiUsage.consume).not.toHaveBeenCalled();
  });

  it('facture la portée widget quand c’est elle qui est posée', async () => {
    request.apiKeyScope = undefined;
    request.widgetScope = {
      organizationId: ORG_ID,
      effectiveTier: SubscriptionTier.CONTRACTOR_PREMIUM,
    };

    await firstValueFrom(
      interceptor.intercept(context, handlerReturning({ total: 1 })),
    );

    expect(apiUsage.consume).toHaveBeenCalledWith(ORG_ID);
  });

  /**
   * `consume()` reste l'incrément-et-décision atomique : deux appels simultanés
   * ne peuvent pas franchir la limite ensemble. Constaté ici après coup, le
   * dépassement ne sert pas le résultat.
   */
  it('rend 429 avec Retry-After quand la consommation franchit le plafond', async () => {
    apiUsage.consume.mockResolvedValue({
      period: '2026-08',
      count: 10_001,
      reset_at: new Date(Date.now() + 86_400_000),
    });

    await expect(
      firstValueFrom(
        interceptor.intercept(context, handlerReturning({ total: 1 })),
      ),
    ).rejects.toMatchObject({
      response: { error: 'QUOTA_EXCEEDED', limit: 10_000, current: 10_001 },
    });
    expect(response.setHeader).toHaveBeenCalledWith(
      'Retry-After',
      expect.any(Number),
    );
  });

  it('refuse de servir une route facturée qu’aucune garde n’a cadrée', async () => {
    request.apiKeyScope = undefined;

    await expect(
      firstValueFrom(
        interceptor.intercept(context, handlerReturning({ total: 1 })),
      ),
    ).rejects.toMatchObject({ status: 500 });
    expect(apiUsage.consume).not.toHaveBeenCalled();
  });
});
