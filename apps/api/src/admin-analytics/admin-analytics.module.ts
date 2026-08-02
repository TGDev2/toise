import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AnalyticsEvent } from '../analytics/entities/analytics-event.entity';
import { ProjectPhoto } from '../photos/entities/project-photo.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AnalyticsEvent,
      Subscription,
      User,
      // Dénominateur du taux de rejet qualité : une photo rejetée n'étant jamais
      // stockée, le nombre de lignes sur la fenêtre est exactement le nombre
      // d'acceptations — pas besoin d'un événement de succès dédié.
      ProjectPhoto,
    ]),
    // AdminGuard (AuthModule, @Global()) dépend de UsersService — comme
    // materials.module.ts/community.module.ts, doit être importé ici pour
    // que la résolution DI du guard aboutisse dans ce module.
    UsersModule,
  ],
  controllers: [AdminAnalyticsController],
  providers: [AdminAnalyticsService],
})
export class AdminAnalyticsModule {}
