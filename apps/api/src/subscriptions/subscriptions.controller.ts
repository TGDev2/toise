import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from './subscriptions.service';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Controller('subscriptions')
@UseGuards(FirebaseAuthGuard)
@SkipThrottle()
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly usersService: UsersService,
  ) {}

  @Post('checkout')
  async createCheckout(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
  ): Promise<{ url: string }> {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) {
      throw new Error('User not found');
    }
    return this.subscriptionsService.createCheckoutSession(user);
  }

  @Post('portal')
  async createPortal(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
  ): Promise<{ url: string }> {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) {
      throw new Error('User not found');
    }
    return this.subscriptionsService.createPortalSession(user.id);
  }

  @Get('current')
  async getCurrent(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
  ) {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) {
      throw new Error('User not found');
    }

    const subscription = await this.subscriptionsService.getSubscription(
      user.id,
    );

    if (!subscription) {
      return { subscription: null };
    }

    return {
      subscription: {
        status: subscription.status,
        current_period_end: subscription.current_period_end,
        trial_end: subscription.trial_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
    };
  }
}
