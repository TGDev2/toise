import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserContextService } from './user-context.service';

/**
 * Module volontairement minimal et sans dépendance applicative : il est importé
 * par `FeatureGatesModule` et par tous les modules métier. Y ajouter une
 * dépendance (notamment vers les feature gates) recréerait un cycle.
 *
 * Successeur d'`OrgContextModule`, supprimé avec les organisations (E4-1).
 */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UserContextService],
  exports: [UserContextService],
})
export class UserContextModule {}
