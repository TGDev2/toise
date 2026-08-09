import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseConfig } from '../config/firebase.config';
import { UsersModule } from '../users/users.module';
import { UserContextModule } from '../users/user-context.module';
import { CompanyProfilesModule } from '../company-profiles/company-profiles.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { DataRetentionModule } from '../data-retention/data-retention.module';
import { StorageModule } from '../photos/storage/storage.module';
import { User } from '../users/entities/user.entity';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { OptionalAuthGuard } from './guards/optional-auth.guard';
import { AdminGuard } from './guards/admin.guard';

@Global()
@Module({
  imports: [
    UsersModule,
    UserContextModule,
    CompanyProfilesModule,
    AnalyticsModule,
    // La suppression d'un compte doit résilier l'abonnement Stripe avant
    // d'effacer quoi que ce soit — cf. `AuthService.deleteAccount`. Le graphe
    // reste à sens unique : `SubscriptionsModule` n'importe pas `AuthModule`
    // (global) et se contente de ses guards.
    SubscriptionsModule,
    // Les fichiers du volume `uploads` doivent partir avant les lignes qui les
    // désignent — cf. `AuthService.deleteAccount`. Le graphe reste à sens
    // unique : `DataRetentionModule` ne connaît que le stockage et deux entités.
    DataRetentionModule,
    // E6-2 : la suppression de compte doit aussi purger `exports/<user_id>/`,
    // le préfixe où vivent les archives RGPD générées pour ce compte — même
    // volume que les photos, deuxième porte à fermer par le même geste.
    StorageModule,
    TypeOrmModule.forFeature([User]),
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
