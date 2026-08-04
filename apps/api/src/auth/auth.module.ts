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
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { OptionalAuthGuard } from './guards/optional-auth.guard';
import { AdminGuard } from './guards/admin.guard';

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
    TypeOrmModule.forFeature([User, OrganizationMembership]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    FirebaseConfig,
    FirebaseAuthGuard,
    OptionalAuthGuard,
    AdminGuard,
  ],
  exports: [
    FirebaseConfig,
    FirebaseAuthGuard,
    OptionalAuthGuard,
    AdminGuard,
    // `AdminGuard` dépend de `UsersService`, et un guard appliqué par
    // `@UseGuards` est instancié dans l'injecteur du module **appelant**, pas
    // dans celui qui le fournit. Chaque module protégeant une route admin devait
    // donc importer `UsersModule` en plus des guards — trois le faisaient avec le
    // commentaire qui va bien, les autres non, et l'application entière refusait
    // de démarrer sur le premier oubli. Ce module étant `@Global`, le ré-export
    // rend la dépendance disponible partout et l'oubli sans conséquence.
    UsersModule,
  ],
})
export class AuthModule {}
