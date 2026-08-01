import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionTier } from '../../users/entities/user.entity';
import { OrgContextService } from '../../organizations/org-context.service';
import { FeatureGatesService } from '../feature-gates.service';
import { FeatureGateGuard } from './feature-gate.guard';

describe('FeatureGateGuard', () => {
  let guard: FeatureGateGuard;
  const reflector = { get: jest.fn() } as unknown as Reflector;
  const orgContext = { resolveForFirebaseUid: jest.fn() };
  const featureGates = {
    isFeatureAllowed: jest.fn(),
    getGateConfig: jest.fn(),
  };

  const request: { firebaseUser?: { uid: string }; appUser?: unknown } = {};
  const context = {
    getHandler: () => jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    request.firebaseUser = { uid: 'fb-1' };
    request.appUser = undefined;
    guard = new FeatureGateGuard(
      reflector,
      orgContext as unknown as OrgContextService,
      featureGates as unknown as FeatureGatesService,
    );
  });

  it('laisse passer une route sans gate', async () => {
    (reflector.get as jest.Mock).mockReturnValue(undefined);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(orgContext.resolveForFirebaseUid).not.toHaveBeenCalled();
  });

  it('évalue le palier de l’organisation, pas celui de l’appelant', async () => {
    // Un salarié `free` invité chez un Contractor Premium doit franchir une
    // gate `multi_user` : c'est l'organisation qui porte le droit (PLAT-4).
    (reflector.get as jest.Mock).mockReturnValue('multi_user');
    orgContext.resolveForFirebaseUid.mockResolvedValue({
      user: { id: 'user-1', subscription_tier: SubscriptionTier.FREE },
      effectiveTier: SubscriptionTier.CONTRACTOR_PREMIUM,
    });
    featureGates.isFeatureAllowed.mockResolvedValue(true);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(featureGates.isFeatureAllowed).toHaveBeenCalledWith(
      'multi_user',
      SubscriptionTier.CONTRACTOR_PREMIUM,
    );
  });

  it('rend le palier effectif dans l’erreur FEATURE_GATED', async () => {
    (reflector.get as jest.Mock).mockReturnValue('multi_user');
    orgContext.resolveForFirebaseUid.mockResolvedValue({
      user: { id: 'user-1' },
      effectiveTier: SubscriptionTier.PRO,
    });
    featureGates.isFeatureAllowed.mockResolvedValue(false);
    featureGates.getGateConfig.mockResolvedValue({
      min_tier: SubscriptionTier.CONTRACTOR_PREMIUM,
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: {
        error: 'FEATURE_GATED',
        required_tier: SubscriptionTier.CONTRACTOR_PREMIUM,
        current_tier: SubscriptionTier.PRO,
      },
    });
  });

  it('refuse quand le contexte ne se résout pas (fail-closed)', async () => {
    (reflector.get as jest.Mock).mockReturnValue('multi_user');
    orgContext.resolveForFirebaseUid.mockRejectedValue(new Error('unknown'));

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(featureGates.isFeatureAllowed).not.toHaveBeenCalled();
  });

  it('refuse une requête non authentifiée', async () => {
    (reflector.get as jest.Mock).mockReturnValue('multi_user');
    request.firebaseUser = undefined;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
