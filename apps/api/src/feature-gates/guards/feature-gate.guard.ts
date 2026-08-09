import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserContextService } from '../../users/user-context.service';
import type { UserScope } from '../../users/user-context.service';
import { FeatureGatesService } from '../feature-gates.service';
import { SubscriptionTier } from '../../users/entities/user.entity';
import { FEATURE_KEY } from '../decorators/require-feature.decorator';
import type { Request } from 'express';

/**
 * Le palier évalué est celui du compte appelant.
 *
 * PLAT-4 l'avait déplacé sur l'organisation active — donc sur son propriétaire —
 * pour qu'un salarié `free` invité chez un abonné travaille avec les capacités
 * de ce dernier. E4-1 ayant supprimé les organisations, il n'existe plus
 * qu'un seul palier à évaluer : celui du compte.
 */
@Injectable()
export class FeatureGateGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userContext: UserContextService,
    private readonly featureGatesService: FeatureGatesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.get<string>(
      FEATURE_KEY,
      context.getHandler(),
    );
    if (!featureKey) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const firebaseUser = request.firebaseUser;

    if (!firebaseUser) {
      throw new ForbiddenException('Authentication required');
    }

    let scope: UserScope;
    try {
      scope = await this.userContext.resolveForFirebaseUid(firebaseUser.uid);
    } catch {
      throw new ForbiddenException('User not found');
    }
    request.appUser = scope.user;

    const allowed = await this.featureGatesService.isFeatureAllowed(
      featureKey,
      scope.effectiveTier,
    );

    if (!allowed) {
      const gate = await this.featureGatesService.getGateConfig(featureKey);
      throw new ForbiddenException({
        // Le message nommait « un abonnement Pro », un palier supprimé de
        // l'offre en E3-1. Il ne nomme plus de palier : `required_tier` le
        // porte déjà, et c'est la seule des deux valeurs que le client lit
        // pour décider quoi proposer.
        message: 'Cette fonctionnalité nécessite un abonnement',
        error: 'FEATURE_GATED',
        feature_key: featureKey,
        required_tier: gate?.min_tier ?? SubscriptionTier.CONTRACTOR_ESSENTIEL,
        current_tier: scope.effectiveTier,
      });
    }

    return true;
  }
}
