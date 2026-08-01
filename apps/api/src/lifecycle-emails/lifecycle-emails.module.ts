import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Project } from '../projects/entities/project.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { EmailModule } from '../email/email.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { LifecycleEmailSend } from './entities/lifecycle-email-send.entity';
import { LifecycleEmailsService } from './lifecycle-emails.service';

/**
 * Module à dépendances étroites (même patron que QuoteRemindersModule /
 * ReferralsModule) : les repos `User`/`Project`/`Subscription` sont injectés
 * directement plutôt que d'importer `UsersModule`/`ProjectsModule`/
 * `SubscriptionsModule` en entier — pas de risque de cycle ici (rien
 * n'importe ce module en retour), mais importer ces modules complets
 * entraînerait leurs controllers et dépendances propres pour un simple
 * besoin de lecture.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Project, Subscription, LifecycleEmailSend]),
    EmailModule,
    AnalyticsModule,
  ],
  providers: [LifecycleEmailsService],
})
export class LifecycleEmailsModule {}
