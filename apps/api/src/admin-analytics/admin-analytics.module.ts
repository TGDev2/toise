import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AnalyticsEvent } from '../analytics/entities/analytics-event.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalyticsEvent, Subscription, User]),
    // AdminGuard (AuthModule, @Global()) dépend de UsersService — comme
    // materials.module.ts/community.module.ts, doit être importé ici pour
    // que la résolution DI du guard aboutisse dans ce module.
    UsersModule,
  ],
  controllers: [AdminAnalyticsController],
  providers: [AdminAnalyticsService],
})
export class AdminAnalyticsModule {}
