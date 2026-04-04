import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
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
    @Body() body?: { price_id?: string },
  ): Promise<{ url: string }> {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) {
      throw new Error('User not found');
    }
    return this.subscriptionsService.createCheckoutSession(
      user,
      body?.price_id,
    );
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
        stripe_price_id: subscription.stripe_price_id,
        current_period_end: subscription.current_period_end,
        trial_end: subscription.trial_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
    };
  }

  @Get('plans')
  getPlans() {
    return {
      plans: [
        {
          key: 'pro',
          label: 'Pro',
          price: 9.99,
          currency: 'EUR',
          interval: 'month',
          trial_days: 7,
        },
        {
          key: 'contractor_essentiel',
          label: 'Contractor Essentiel',
          price: 50,
          currency: 'EUR',
          interval: 'month',
          trial_days: 0,
        },
        {
          key: 'contractor_standard',
          label: 'Contractor Standard',
          price: 100,
          currency: 'EUR',
          interval: 'month',
          trial_days: 0,
        },
        {
          key: 'contractor_premium',
          label: 'Contractor Premium',
          price: 200,
          currency: 'EUR',
          interval: 'month',
          trial_days: 0,
        },
      ],
    };
  }
}
