import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgContextService } from '../../organizations/org-context.service';
import type { OrgScope } from '../../organizations/org-context.service';
import { FeatureGatesService } from '../feature-gates.service';
import { SubscriptionTier } from '../../users/entities/user.entity';
import { FEATURE_KEY } from '../decorators/require-feature.decorator';
import type { Request } from 'express';

/**
 * Le palier évalué est celui de l'**organisation active** (PLAT-4), c'est-à-dire
 * celui de son propriétaire — et non plus celui de l'utilisateur qui appelle.
 * C'est ce qui donne à un salarié `free` les capacités du Contractor Premium
 * qui l'a invité, tant qu'il travaille dans l'organisation de ce dernier.
 */
@Injectable()
export class FeatureGateGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly orgContext: OrgContextService,
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

    let scope: OrgScope;
    try {
      scope = await this.orgContext.resolveForFirebaseUid(firebaseUser.uid);
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
