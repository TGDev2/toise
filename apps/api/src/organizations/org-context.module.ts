import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Organization } from './entities/organization.entity';
import { OrganizationMembership } from './entities/organization-membership.entity';
import { EnterpriseAgreement } from '../enterprise/entities/enterprise-agreement.entity';
import { OrgContextService } from './org-context.service';

/**
 * Module volontairement minimal et sans dépendance applicative : il est importé
 * par `FeatureGatesModule` et par tous les modules métier. Y ajouter une
 * dépendance (notamment vers les feature gates) recréerait un cycle.
 *
 * `EnterpriseAgreement` n'entre ici que comme **entité** (PLAT-6 D1) : le palier
 * `enterprise` se résout depuis le contrat de l'organisation, et cette règle doit
 * vivre au même endroit que les autres. Importer `EnterpriseModule` aurait, lui,
 * recréé le cycle que ce module existe pour éviter.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Organization,
      OrganizationMembership,
      EnterpriseAgreement,
    ]),
  ],
  providers: [OrgContextService],
  exports: [OrgContextService],
})
export class OrgContextModule {}
