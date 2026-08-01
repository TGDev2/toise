import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgContextModule } from '../organizations/org-context.module';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';
import { EnterpriseAgreement } from './entities/enterprise-agreement.entity';
import { SsoConnection } from './entities/sso-connection.entity';
import { SsoDomain } from './entities/sso-domain.entity';
import { EnterpriseAgreementsService } from './enterprise-agreements.service';
import { SsoConnectionsService } from './sso-connections.service';
import { SsoProviderProvisioner } from './sso-provider-provisioner';
import { DomainVerifier } from './domain-verifier';
import { EnterpriseController } from './enterprise.controller';
import { AdminEnterpriseController } from './admin-enterprise.controller';
import { SsoDiscoveryController } from './sso-discovery.controller';

/**
 * Offre Enterprise : SSO, contrat annuel, SLA (BACKLOG PLAT-6).
 *
 * Ce module **administre** les enregistrements ; ce qui arrive à une session au
 * moment de la connexion vit dans `auth/sso-session.service.ts`. Le graphe reste
 * à sens unique : ce module dépend d'`AuthModule` (global) pour ses guards et
 * pour invalider le cache d'enforcement, et `AuthModule` ne dépend en retour que
 * des **entités** déclarées ici — jamais de ce module.
 *
 * `SsoProviderProvisioner` (GCIP) et `DomainVerifier` (DNS) sont isolés parce
 * qu'ils portent les deux seuls effets de bord externes : ils doivent être
 * remplaçables en test.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([EnterpriseAgreement, SsoConnection, SsoDomain]),
    OrgContextModule,
    FeatureGatesModule,
  ],
  controllers: [
    EnterpriseController,
    AdminEnterpriseController,
    SsoDiscoveryController,
  ],
  providers: [
    EnterpriseAgreementsService,
    SsoConnectionsService,
    SsoProviderProvisioner,
    DomainVerifier,
  ],
  exports: [EnterpriseAgreementsService, SsoConnectionsService],
})
export class EnterpriseModule {}
