import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { SubscriptionTier } from '../../users/entities/user.entity';
import { OrgContextService } from '../../organizations/org-context.service';
import { FeatureGatesService } from '../../feature-gates/feature-gates.service';
import { ApiKeysService } from '../api-keys.service';
import { ApiUsageService } from '../api-usage.service';
import type { ApiKey } from '../entities/api-key.entity';
import type { ApiKeyScope } from '../api-key-scope';
import { ApiKeyGuard } from './api-key.guard';

const ORG_ID = '00000000-0000-4000-8000-0000000000aa';
const KEY_ID = '00000000-0000-4000-8000-00000000000c';
const SECRET = `chf_${'a'.repeat(64)}`;

function makeKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: KEY_ID,
    organization_id: ORG_ID,
    revoked_at: null,
    previous_key_hash: null,
    previous_key_expires_at: null,
    ...overrides,
  } as ApiKey;
}

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;

  const reflector = { get: jest.fn() } as unknown as Reflector;
  const apiKeys = {
    findBySecret: jest.fn(),
    matchesRotatedHash: jest.fn(),
    touchLastUsed: jest.fn(),
  };
  const apiUsage = { consume: jest.fn(), peek: jest.fn() };
  const orgContext = { resolveTierForOrganization: jest.fn() };
  const featureGates = {
    isFeatureAllowed: jest.fn(),
    getGateConfig: jest.fn(),
  };
  const throttlerStorage = { increment: jest.fn() };

  const request: {
    headers: { authorization?: string };
    apiKeyScope?: ApiKeyScope;
  } = { headers: {} };
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
    request.headers = { authorization: `Bearer ${SECRET}` };
    request.apiKeyScope = undefined;

    apiKeys.findBySecret.mockResolvedValue(makeKey());
    apiKeys.matchesRotatedHash.mockReturnValue(false);
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

    guard = new ApiKeyGuard(
      reflector,
      apiKeys as unknown as ApiKeysService,
      apiUsage as unknown as ApiUsageService,
      orgContext as unknown as OrgContextService,
      featureGates as unknown as FeatureGatesService,
      throttlerStorage as unknown as ThrottlerStorage,
    );
  });

  describe('identification', () => {
    it('laisse passer une clé valide et pose la portée', async () => {
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.apiKeyScope).toEqual({
        apiKeyId: KEY_ID,
        organizationId: ORG_ID,
        effectiveTier: SubscriptionTier.CONTRACTOR_PREMIUM,
      });
      expect(apiKeys.touchLastUsed).toHaveBeenCalledWith(KEY_ID);
    });

    it('refuse sans en-tête Authorization', async () => {
      request.headers = {};
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: { error: 'INVALID_API_KEY_FORMAT' },
      });
      expect(apiKeys.findBySecret).not.toHaveBeenCalled();
    });

    it('refuse un jeton Firebase envoyé sur la mauvaise surface, sans requête en base', async () => {
      request.headers = {
        authorization: 'Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6',
      };
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: { error: 'INVALID_API_KEY_FORMAT' },
      });
      expect(apiKeys.findBySecret).not.toHaveBeenCalled();
    });

    it('refuse une clé inconnue', async () => {
      apiKeys.findBySecret.mockResolvedValue(null);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: { error: 'INVALID_API_KEY' },
      });
    });

    it('refuse une clé révoquée', async () => {
      apiKeys.findBySecret.mockResolvedValue(
        makeKey({ revoked_at: new Date() }),
      );
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: { error: 'API_KEY_REVOKED' },
      });
      expect(apiUsage.consume).not.toHaveBeenCalled();
    });
  });

  describe('rotation', () => {
    it('accepte l’ancien secret pendant la fenêtre de grâce', async () => {
      apiKeys.matchesRotatedHash.mockReturnValue(true);
      apiKeys.findBySecret.mockResolvedValue(
        makeKey({
          previous_key_hash: 'ancien',
          previous_key_expires_at: new Date(Date.now() + 3_600_000),
        }),
      );
      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('refuse l’ancien secret une fois la grâce expirée', async () => {
      apiKeys.matchesRotatedHash.mockReturnValue(true);
      apiKeys.findBySecret.mockResolvedValue(
        makeKey({
          previous_key_hash: 'ancien',
          previous_key_expires_at: new Date(Date.now() - 1_000),
        }),
      );
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: { error: 'API_KEY_ROTATION_EXPIRED' },
      });
    });
  });

  describe('palier et gate', () => {
    it('évalue le palier de l’organisation porteuse de la clé, à chaque requête', async () => {
      await guard.canActivate(context);
      expect(orgContext.resolveTierForOrganization).toHaveBeenCalledWith(
        ORG_ID,
      );
      expect(featureGates.isFeatureAllowed).toHaveBeenCalledWith(
        'public_api',
        SubscriptionTier.CONTRACTOR_PREMIUM,
      );
    });

    it('éteint la clé si l’organisation a été rétrogradée', async () => {
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
      expect(apiUsage.consume).not.toHaveBeenCalled();
    });

    it('refuse quand le propriétaire est introuvable (fail-closed sur free)', async () => {
      orgContext.resolveTierForOrganization.mockResolvedValue(
        SubscriptionTier.FREE,
      );
      featureGates.isFeatureAllowed.mockResolvedValue(false);
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('rafale', () => {
    it('compte par clé, jamais par IP', async () => {
      await guard.canActivate(context);
      const [key] = throttlerStorage.increment.mock.calls[0] as [string];
      expect(key).toContain(KEY_ID);
    });

    it('rejette en 429 avec Retry-After et ne consomme aucun quota mensuel', async () => {
      throttlerStorage.increment.mockResolvedValue({
        totalHits: 61,
        timeToExpire: 30,
        isBlocked: true,
        timeToBlockExpire: 30,
      });

      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: { error: 'RATE_LIMIT_EXCEEDED' },
      });
      // La rafale est vérifiée AVANT le quota : sinon une requête rejetée pour
      // rafale aurait déjà interrogé le compteur facturable.
      expect(apiUsage.peek).not.toHaveBeenCalled();
      expect(response.setHeader).toHaveBeenCalledWith('Retry-After', 30);
    });
  });

  describe('quota mensuel', () => {
    /**
     * Le garde ne fait plus que **lire** : il s'exécute avant le
     * `ValidationPipe`, donc tout ce qu'il débiterait serait facturé y compris
     * aux corps rejetés en 400. Le débit a lieu après le handler
     * (`QuotaConsumptionInterceptor`).
     */
    it('ne consomme jamais le quota, quel que soit le verdict', async () => {
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(apiUsage.consume).not.toHaveBeenCalled();
      expect(apiUsage.peek).toHaveBeenCalledWith(ORG_ID);
    });

    it('rejette en 429 un appelant déjà au plafond du palier', async () => {
      apiUsage.peek.mockResolvedValue({
        period: '2026-08',
        count: 10_000,
        reset_at: new Date(Date.now() + 86_400_000),
      });

      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: {
          error: 'QUOTA_EXCEEDED',
          limit: 10_000,
          current: 10_000,
          period: '2026-08',
        },
      });
      expect(response.setHeader).toHaveBeenCalledWith(
        'Retry-After',
        expect.any(Number),
      );
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
