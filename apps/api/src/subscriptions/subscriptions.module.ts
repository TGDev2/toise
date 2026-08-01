import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { Subscription } from './entities/subscription.entity';
import { StripeEvent } from './entities/stripe-event.entity';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsWebhookController } from './subscriptions.webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, StripeEvent]),
    UsersModule,
    AnalyticsModule,
    ReferralsModule,
  ],
  controllers: [SubscriptionsController, SubscriptionsWebhookController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
