import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Organization } from './entities/organization.entity';
import { OrganizationMembership } from './entities/organization-membership.entity';
import { OrgContextService } from './org-context.service';

/**
 * Module volontairement minimal et sans dépendance applicative : il est importé
 * par `FeatureGatesModule` et par tous les modules métier. Y ajouter une
 * dépendance (notamment vers les feature gates) recréerait un cycle.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization, OrganizationMembership]),
  ],
  providers: [OrgContextService],
  exports: [OrgContextService],
})
export class OrgContextModule {}
