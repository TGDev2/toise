import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsersService } from '../../users/users.service';
import { FeatureGatesService } from '../feature-gates.service';
import { FEATURE_KEY } from '../decorators/require-feature.decorator';
import type { Request } from 'express';

@Injectable()
export class FeatureGateGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
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

    let user = request.appUser;
    if (!user) {
      user =
        (await this.usersService.findByFirebaseUid(firebaseUser.uid)) ??
        undefined;
      request.appUser = user;
    }

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    const allowed = await this.featureGatesService.isFeatureAllowed(
      featureKey,
      user.subscription_tier,
    );

    if (!allowed) {
      const gate = await this.featureGatesService.getGateConfig(featureKey);
      throw new ForbiddenException({
        message: 'Cette fonctionnalité nécessite un abonnement Pro',
        error: 'FEATURE_GATED',
        feature_key: featureKey,
        required_tier: gate?.min_tier ?? 'pro',
        current_tier: user.subscription_tier,
      });
    }

    return true;
  }
}
