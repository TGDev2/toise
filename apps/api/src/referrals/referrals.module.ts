import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ReferralCredit } from './entities/referral-credit.entity';
import { ReferralsService } from './referrals.service';
import { ReferralsController } from './referrals.controller';

/**
 * Module à dépendances étroites (même patron que QuoteRemindersModule) :
 * les repos `User`/`Subscription` sont injectés directement plutôt que
 * d'importer `SubscriptionsModule`, pour que SubscriptionsModule puisse
 * importer ReferralsModule sans dépendance circulaire (COM-3 dépend de
 * l'infra Stripe, l'inverse n'est pas vrai).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, ReferralCredit, Subscription]),
    UsersModule,
    EmailModule,
    AnalyticsModule,
  ],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
