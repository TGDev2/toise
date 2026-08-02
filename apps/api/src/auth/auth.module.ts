import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseConfig } from '../config/firebase.config';
import { UsersModule } from '../users/users.module';
import { OrgContextModule } from '../organizations/org-context.module';
import { CompanyProfilesModule } from '../company-profiles/company-profiles.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { User } from '../users/entities/user.entity';
import { OrganizationMembership } from '../organizations/entities/organization-membership.entity';
import { SsoConnection } from '../enterprise/entities/sso-connection.entity';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { OptionalAuthGuard } from './guards/optional-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { SsoSessionService } from './sso-session.service';

/**
 * Les entités de PLAT-6 entrent ici en `forFeature`, pas via un import de
 * `EnterpriseModule` : `SsoSessionService` porte ce qui arrive à une session **au
 * moment de la connexion**, tandis qu'`EnterpriseModule` administre les
 * enregistrements et dépend, lui, de ce module global. Le graphe reste donc
 * strictement à sens unique.
 */
@Global()
@Module({
  imports: [
    UsersModule,
    OrgContextModule,
    CompanyProfilesModule,
    AnalyticsModule,
    // La suppression d'un compte doit résilier l'abonnement Stripe avant
    // d'effacer quoi que ce soit — cf. `AuthService.deleteAccount`. Le graphe
    // reste à sens unique : `SubscriptionsModule` n'importe pas `AuthModule`
    // (global) et se contente de ses guards.
    SubscriptionsModule,
    TypeOrmModule.forFeature([User, OrganizationMembership, SsoConnection]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    FirebaseConfig,
    FirebaseAuthGuard,
    OptionalAuthGuard,
    AdminGuard,
    SsoSessionService,
  ],
  exports: [
    FirebaseConfig,
    FirebaseAuthGuard,
    OptionalAuthGuard,
    AdminGuard,
    SsoSessionService,
  ],
})
export class AuthModule {}
