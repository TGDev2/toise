import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { SubscriptionTier } from '../../users/entities/user.entity';
import { OrgContextService } from '../../organizations/org-context.service';
import { FeatureGatesService } from '../../feature-gates/feature-gates.service';
import { ApiUsageService } from '../../api-keys/api-usage.service';
import { WidgetService } from '../widget.service';
import type { WidgetConfig } from '../entities/widget-config.entity';
import type { WidgetScope } from '../widget-scope';
import { WidgetOriginGuard } from './widget-origin.guard';

const ORG_ID = '00000000-0000-4000-8000-0000000000aa';
const CONFIG_ID = '00000000-0000-4000-8000-00000000000c';
const ORIGIN = 'https://exemple-bricolage.fr';

function makeConfig(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
  return {
    id: CONFIG_ID,
    organization_id: ORG_ID,
    widget_key: 'wgt_abc',
    allowed_origins: [ORIGIN],
    enabled: true,
    display_name: null,
    accent_color: null,
    ...overrides,
  } as WidgetConfig;
}

describe('WidgetOriginGuard', () => {
  let guard: WidgetOriginGuard;

  const reflector = { get: jest.fn() } as unknown as Reflector;
  const widgetService = {
    findActiveByKey: jest.fn(),
  };
  const apiUsage = { consume: jest.fn(), peek: jest.fn() };
  const orgContext = { resolveTierForOrganization: jest.fn() };
  const featureGates = {
    isFeatureAllowed: jest.fn(),
    getGateConfig: jest.fn(),
  };
  const throttlerStorage = { increment: jest.fn() };

  const request: {
    params: { widgetKey: string };
    headers: { origin?: string };
    widgetScope?: WidgetScope;
    widgetConfig?: WidgetConfig;
  } = { params: { widgetKey: 'wgt_abc' }, headers: {} };
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
    request.headers = { origin: ORIGIN };
    request.widgetScope = undefined;
    request.widgetConfig = undefined;

    widgetService.findActiveByKey.mockResolvedValue(makeConfig());
    orgContext.resolveTierForOrganization.mockResolvedValue(
      SubscriptionTier.CONTRACTOR_PREMIUM,
    );
    featureGates.isFeatureAllowed.mockResolvedValue(true);
    featureGates.getGateConfig.mockResolvedValue({
      min_tier: SubscriptionTier.CONTRACTOR_PREMIUM,
    });
    throttlerStorage.increment.mockResolvedValue({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
    apiUsage.peek.mockResolvedValue({
      period: '2026-08',
      count: 1,
      reset_at: new Date(Date.now() + 86_400_000),
    });
    (reflector.get as jest.Mock).mockReturnValue(true);

    guard = new WidgetOriginGuard(
      reflector,
      widgetService as unknown as WidgetService,
      apiUsage as unknown as ApiUsageService,
      orgContext as unknown as OrgContextService,
      featureGates as unknown as FeatureGatesService,
      throttlerStorage as unknown as ThrottlerStorage,
    );
  });

  describe('identification', () => {
    it('laisse passer une origine autorisée et pose la portée + la configuration', async () => {
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.widgetScope).toEqual({
        widgetConfigId: CONFIG_ID,
        organizationId: ORG_ID,
        effectiveTier: SubscriptionTier.CONTRACTOR_PREMIUM,
        origin: ORIGIN,
      });
      expect(request.widgetConfig).toEqual(makeConfig());
    });

    it('renvoie 404 si la clé est inconnue', async () => {
      widgetService.findActiveByKey.mockResolvedValue(null);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: { error: 'WIDGET_NOT_FOUND' },
      });
    });

    it('renvoie 404 si le widget est désactivé', async () => {
      widgetService.findActiveByKey.mockResolvedValue(
        makeConfig({ enabled: false }),
      );
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: { error: 'WIDGET_NOT_FOUND' },
      });
    });
  });

  describe('origine', () => {
    it('refuse sans en-tête Origin', async () => {
      request.headers = {};
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: { error: 'ORIGIN_REQUIRED' },
      });
    });

    it('refuse une origine absente de la liste blanche', async () => {
      request.headers = { origin: 'https://autre-site.fr' };
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: { error: 'ORIGIN_NOT_ALLOWED' },
      });
    });
  });

  describe('palier et gate', () => {
    it('éteint le widget si l’organisation a été rétrogradée', async () => {
      orgContext.resolveTierForOrganization.mockResolvedValue(
        SubscriptionTier.PRO,
      );
      featureGates.isFeatureAllowed.mockResolvedValue(false);

      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: {
          error: 'FEATURE_GATED',
          required_tier: SubscriptionTier.CONTRACTOR_PREMIUM,
          current_tier: SubscriptionTier.PRO,
        },
      });
      expect(apiUsage.peek).not.toHaveBeenCalled();
    });
  });

  describe('rafale', () => {
    it('compte par configuration de widget, jamais par IP', async () => {
      await guard.canActivate(context);
      const [key] = throttlerStorage.increment.mock.calls[0] as [string];
      expect(key).toContain(CONFIG_ID);
    });

    it('rejette en 429 avec Retry-After et ne consomme aucun quota mensuel', async () => {
      throttlerStorage.increment.mockResolvedValue({
        totalHits: 121,
        timeToExpire: 30,
        isBlocked: true,
        timeToBlockExpire: 30,
      });

      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: { error: 'RATE_LIMIT_EXCEEDED' },
      });
      expect(apiUsage.peek).not.toHaveBeenCalled();
      expect(response.setHeader).toHaveBeenCalledWith('Retry-After', 30);
    });
  });

  describe('quota mensuel', () => {
    /**
     * Le cœur du constat : la clé `wgt_…` est publique et l'`Origin` est
     * forgeable. Tant que le garde débitait, un script pouvait vider le quota
     * mensuel d'une organisation avec des corps vides — le garde s'exécute
     * avant le `ValidationPipe`, donc chaque 400 était déjà facturé. Il ne fait
     * plus que lire ; le débit est déplacé après le handler.
     */
    it('ne consomme jamais le quota, quel que soit le verdict', async () => {
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(apiUsage.consume).not.toHaveBeenCalled();
      expect(apiUsage.peek).toHaveBeenCalledWith(ORG_ID);
    });

    it('rejette en 429 un widget déjà au plafond du palier', async () => {
      apiUsage.peek.mockResolvedValue({
        period: '2026-08',
        count: 10_000,
        reset_at: new Date(Date.now() + 86_400_000),
      });

      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: { error: 'QUOTA_EXCEEDED', limit: 10_000, current: 10_000 },
      });
    });

    it('laisse passer la requête qui atteindra exactement la limite', async () => {
      apiUsage.peek.mockResolvedValue({
        period: '2026-08',
        count: 9_999,
        reset_at: new Date(Date.now() + 86_400_000),
      });
      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('ne lit rien sur une route non marquée @CountsAgainstQuota', async () => {
      (reflector.get as jest.Mock).mockReturnValue(undefined);
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(apiUsage.peek).not.toHaveBeenCalled();
      expect(apiUsage.consume).not.toHaveBeenCalled();
    });
  });
});
