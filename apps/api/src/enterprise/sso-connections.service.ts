import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { IsNull, Not, QueryFailedError, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { SsoSessionService } from '../auth/sso-session.service';
import { OrganizationRole } from '../organizations/entities/organization-membership.entity';
import type { OrgScope } from '../organizations/org-context.service';
import {
  SsoConnection,
  SsoConnectionStatus,
  SsoProtocol,
} from './entities/sso-connection.entity';
import { SsoDomain } from './entities/sso-domain.entity';
import { CreateSsoConnectionDto } from './dto/create-sso-connection.dto';
import { UpdateSsoConnectionDto } from './dto/update-sso-connection.dto';
import { AddSsoDomainDto } from './dto/add-sso-domain.dto';
import { DomainVerifier, DOMAIN_VERIFICATION_PREFIX } from './domain-verifier';
import {
  SsoProviderProvisioner,
  type SsoProviderSettings,
} from './sso-provider-provisioner';
import { isPublicEmailDomain, normalizeDomain } from './public-email-domains';

export const ENTERPRISE_SSO_FEATURE_KEY = 'enterprise_sso';

export interface SsoDomainView {
  id: string;
  domain: string;
  verified: boolean;
  verified_at: Date | null;
  /** Enregistrement TXT attendu, rendu tant que le domaine n'est pas prouvé. */
  expected_dns_record: string | null;
}

export interface SsoConnectionView {
  id: string;
  provider_id: string;
  protocol: SsoProtocol;
  display_name: string;
  status: SsoConnectionStatus;
  enforced: boolean;
  default_role: OrganizationRole;
  provisioning_error: string | null;
  domains: SsoDomainView[];
  created_at: Date;
}

/**
 * Connexions SSO et domaines de découverte (BACKLOG PLAT-6).
 *
 * Deux invariants tiennent tout le reste :
 *
 * - **le rattachement se fait par `provider_id`, jamais par domaine.** C'est nous
 *   qui émettons cet identifiant en créant le fournisseur chez GCIP : un jeton
 *   qui le porte prouve que l'assertion vient de l'IdP de cette organisation-là.
 *   Un IdP ne parle que pour lui-même — sans cette règle, celui d'un client
 *   pourrait affirmer `ceo@concurrent.fr` et entrer chez un autre client (D3) ;
 * - **aucun secret d'IdP n'est persisté.** Certificat, `client_secret` et URL de
 *   SSO traversent le provisionneur vers GCIP puis sont oubliés (D5).
 */
@Injectable()
export class SsoConnectionsService {
  private readonly logger = new Logger(SsoConnectionsService.name);

  constructor(
    @InjectRepository(SsoConnection)
    private readonly connectionsRepo: Repository<SsoConnection>,
    @InjectRepository(SsoDomain)
    private readonly domainsRepo: Repository<SsoDomain>,
    private readonly provisioner: SsoProviderProvisioner,
    private readonly domainVerifier: DomainVerifier,
    private readonly config: ConfigService,
    private readonly ssoSession: SsoSessionService,
  ) {}

  // ── Administration plateforme ─────────────────────────────────────────────

  /**
   * La ligne est écrite en `pending`, **puis** le fournisseur est créé chez GCIP,
   * puis la ligne passe `active` — ou `failed` avec le motif. L'orphelin possible
   * est donc « une ligne sans fournisseur », inoffensive puisque personne ne peut
   * s'authentifier avec ; l'ordre inverse aurait laissé « un fournisseur sans
   * ligne », c'est-à-dire un IdP vivant que le rattachement JIT ne reconnaît pas
   * (PLAT-6 D12).
   */
  async createConnection(
    dto: CreateSsoConnectionDto,
    createdByUserId: string,
  ): Promise<SsoConnectionView> {
    const providerId = this.generateProviderId(dto.protocol);

    let connection: SsoConnection;
    try {
      connection = await this.connectionsRepo.save(
        this.connectionsRepo.create({
          organization_id: dto.organization_id,
          provider_id: providerId,
          protocol: dto.protocol,
          display_name: dto.display_name.trim(),
          status: SsoConnectionStatus.PENDING,
          default_role: dto.default_role ?? OrganizationRole.MEMBER,
          created_by_user_id: createdByUserId,
        }),
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        error.message.includes('UQ_sso_connections_organization')
      ) {
        throw new ConflictException({
          message:
            'Cette organisation a déjà une connexion SSO. Supprimez-la avant d’en créer une autre.',
          error: 'SSO_CONNECTION_EXISTS',
        });
      }
      throw error;
    }

    try {
      await this.provisioner.create(
        providerId,
        dto.protocol,
        connection.display_name,
        this.buildProviderSettings(dto),
      );
      connection.status = SsoConnectionStatus.ACTIVE;
      connection.provisioning_error = null;
    } catch (error) {
      // Le motif est conservé et rendu : sans lui, l'administrateur ne peut pas
      // distinguer un certificat invalide d'un projet Firebase resté hors GCIP.
      connection.status = SsoConnectionStatus.FAILED;
      connection.provisioning_error = this.describeError(error).slice(0, 500);
      this.logger.error(
        `Provisioning GCIP échoué pour ${providerId}: ${connection.provisioning_error}`,
      );
    }

    const saved = await this.connectionsRepo.save(connection);
    return this.toView(saved, []);
  }

  async listConnections(): Promise<SsoConnectionView[]> {
    const connections = await this.connectionsRepo.find({
      order: { created_at: 'DESC' },
    });
    return Promise.all(
      connections.map(async (connection) =>
        this.toView(connection, await this.domainsOf(connection.id)),
      ),
    );
  }

  /**
   * Le fournisseur est supprimé chez GCIP **avant** la ligne : si l'appel échoue,
   * la ligne est conservée et l'erreur remonte, plutôt que de perdre la trace
   * d'un fournisseur encore vivant (PLAT-6 D12).
   */
  async deleteConnection(id: string): Promise<void> {
    const connection = await this.connectionsRepo.findOne({ where: { id } });
    if (!connection) {
      throw new NotFoundException('Connexion SSO introuvable');
    }

    if (connection.status === SsoConnectionStatus.ACTIVE) {
      try {
        await this.provisioner.delete(connection.provider_id);
      } catch (error) {
        throw new ConflictException({
          message: `Suppression du fournisseur d'identité impossible : ${this.describeError(error)}`,
          error: 'SSO_PROVIDER_DELETION_FAILED',
        });
      }
    }

    await this.connectionsRepo.delete({ id });
    this.ssoSession.invalidateEnforcementCache();
    this.logger.log(`Connexion SSO ${id} supprimée`);
  }

  // ── Surface de l'organisation ─────────────────────────────────────────────

  async findForOrganization(
    organizationId: string,
  ): Promise<SsoConnectionView> {
    const connection = await this.requireConnection(organizationId);
    return this.toView(connection, await this.domainsOf(connection.id));
  }

  /**
   * L'enforcement se bascule par l'organisation, pas par la plateforme : c'est sa
   * politique de sécurité. Le propriétaire en reste exempté à l'exécution — bris
   * de glace contre un IdP mal configuré (PLAT-6 D9).
   */
  async updateForOrganization(
    scope: OrgScope,
    dto: UpdateSsoConnectionDto,
  ): Promise<SsoConnectionView> {
    this.assertCanManageSso(scope);
    const connection = await this.requireConnection(scope.organizationId);

    if (dto.enforced === true) {
      if (connection.status !== SsoConnectionStatus.ACTIVE) {
        throw new ConflictException({
          message:
            "L'enforcement exige une connexion SSO opérationnelle : la connexion n'est pas active.",
          error: 'SSO_CONNECTION_NOT_ACTIVE',
        });
      }
    }
    if (dto.enforced !== undefined) connection.enforced = dto.enforced;

    const saved = await this.connectionsRepo.save(connection);
    // Le chemin rapide du guard mémorise « aucune organisation n'est en
    // enforcement » : sans cette invalidation, la bascule mettrait jusqu'à 60 s
    // à prendre effet sur cette instance.
    this.ssoSession.invalidateEnforcementCache();
    this.logger.log(
      `Enforcement SSO ${saved.enforced ? 'activé' : 'désactivé'} sur l'organisation ${scope.organizationId}`,
    );
    return this.toView(saved, await this.domainsOf(saved.id));
  }

  async addDomain(
    scope: OrgScope,
    dto: AddSsoDomainDto,
  ): Promise<SsoDomainView> {
    this.assertCanManageSso(scope);
    const connection = await this.requireConnection(scope.organizationId);

    const domain = normalizeDomain(dto.domain);
    if (!domain) {
      throw new BadRequestException('Domaine invalide');
    }
    if (isPublicEmailDomain(domain)) {
      throw new BadRequestException({
        message:
          'Les domaines de messagerie grand public ne peuvent pas être rattachés à une connexion SSO.',
        error: 'PUBLIC_EMAIL_DOMAIN_REFUSED',
      });
    }

    // Un domaine déjà prouvé ailleurs est refusé tôt, pour rendre le motif
    // lisible ; l'index partiel `UQ_sso_domains_verified` reste l'arbitre en cas
    // de course entre deux vérifications simultanées.
    const claimedElsewhere = await this.domainsRepo.findOne({
      where: {
        domain,
        verified_at: Not(IsNull()),
        sso_connection_id: Not(connection.id),
      },
    });
    if (claimedElsewhere) {
      throw new ConflictException({
        message: 'Ce domaine est déjà vérifié par une autre organisation.',
        error: 'DOMAIN_ALREADY_VERIFIED',
      });
    }

    const existing = await this.domainsRepo.findOne({
      where: { sso_connection_id: connection.id, domain },
    });
    if (existing) {
      return this.toDomainView(existing);
    }

    const saved = await this.domainsRepo.save(
      this.domainsRepo.create({
        sso_connection_id: connection.id,
        domain,
        verification_token: randomBytes(16).toString('hex'),
      }),
    );
    return this.toDomainView(saved);
  }

  /**
   * La vérification est **rejouable** : un enregistrement DNS met du temps à se
   * propager, et un premier essai infructueux ne doit pas obliger à repartir d'un
   * nouveau jeton.
   */
  async verifyDomain(
    scope: OrgScope,
    domainId: string,
  ): Promise<SsoDomainView> {
    this.assertCanManageSso(scope);
    const connection = await this.requireConnection(scope.organizationId);

    // Le filtre par connexion est la barrière anti-IDOR : sans lui, un `id`
    // deviné suffirait à agir sur le domaine d'un autre client.
    const domain = await this.domainsRepo.findOne({
      where: { id: domainId, sso_connection_id: connection.id },
    });
    if (!domain) {
      throw new NotFoundException('Domaine introuvable');
    }
    if (domain.verified_at) {
      return this.toDomainView(domain);
    }

    const proven = await this.domainVerifier.hasVerificationRecord(
      domain.domain,
      domain.verification_token,
    );
    if (!proven) {
      throw new BadRequestException({
        message: `Enregistrement TXT introuvable. Publiez « ${DOMAIN_VERIFICATION_PREFIX}${domain.verification_token} » sur _chiffreo.${domain.domain}, puis réessayez.`,
        error: 'SSO_DOMAIN_NOT_VERIFIED',
      });
    }

    domain.verified_at = new Date();
    try {
      const saved = await this.domainsRepo.save(domain);
      this.logger.log(
        `Domaine ${saved.domain} vérifié pour l'organisation ${scope.organizationId}`,
      );
      return this.toDomainView(saved);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        error.message.includes('UQ_sso_domains_verified')
      ) {
        throw new ConflictException({
          message: 'Ce domaine est déjà vérifié par une autre organisation.',
          error: 'DOMAIN_ALREADY_VERIFIED',
        });
      }
      throw error;
    }
  }

  async removeDomain(scope: OrgScope, domainId: string): Promise<void> {
    this.assertCanManageSso(scope);
    const connection = await this.requireConnection(scope.organizationId);
    const result = await this.domainsRepo.delete({
      id: domainId,
      sso_connection_id: connection.id,
    });
    if (!result.affected) {
      throw new NotFoundException('Domaine introuvable');
    }
  }

  // ── Découverte ────────────────────────────────────────────────────────────

  /**
   * Résolution « adresse e-mail → fournisseur », pour le flux SP-initiated. Ne
   * renvoie que ce qui est nécessaire à lancer la redirection : ni nom
   * d'organisation, ni état de contrat (PLAT-6 D13). Seuls les domaines
   * **vérifiés** et les connexions **actives** répondent.
   */
  async discoverByDomain(
    domain: string,
  ): Promise<{ provider_id: string; protocol: SsoProtocol } | null> {
    const row = await this.domainsRepo
      .createQueryBuilder('d')
      .innerJoin(SsoConnection, 'c', 'c.id = d.sso_connection_id')
      .where('d.domain = :domain', { domain })
      .andWhere('d.verified_at IS NOT NULL')
      .andWhere('c.status = :status', { status: SsoConnectionStatus.ACTIVE })
      .select('c.provider_id', 'provider_id')
      .addSelect('c.protocol', 'protocol')
      .getRawOne<{ provider_id: string; protocol: SsoProtocol }>();

    return row ?? null;
  }

  // ---------------------------------------------------------------------------

  /**
   * `saml.` / `oidc.` est un préfixe imposé par Identity Platform. Le suffixe
   * aléatoire évite qu'un identifiant soit devinable à partir du nom du client :
   * il n'est pas un secret, mais rien n'oblige à en faire un annuaire.
   */
  private generateProviderId(protocol: SsoProtocol): string {
    return `${protocol}.${randomBytes(8).toString('hex')}`;
  }

  private buildProviderSettings(
    dto: CreateSsoConnectionDto,
  ): SsoProviderSettings {
    if (dto.protocol === SsoProtocol.SAML) {
      // Ces deux valeurs décrivent **notre** service auprès de l'IdP, pas le
      // client : elles se déduisent du projet Firebase, qui héberge le
      // gestionnaire de redirection. Les faire saisir n'apporterait qu'une
      // occasion de se tromper.
      const authDomain = `${this.config.get<string>('firebase.projectId') ?? 'chiffreo'}.firebaseapp.com`;
      return {
        idp_entity_id: dto.idp_entity_id!,
        sso_url: dto.sso_url!,
        x509_certificate: dto.x509_certificate!,
        rp_entity_id: authDomain,
        callback_url: `https://${authDomain}/__/auth/handler`,
      };
    }
    return {
      issuer: dto.issuer!,
      client_id: dto.client_id!,
      client_secret: dto.client_secret!,
    };
  }

  private async requireConnection(
    organizationId: string,
  ): Promise<SsoConnection> {
    const connection = await this.connectionsRepo.findOne({
      where: { organization_id: organizationId },
    });
    if (!connection) {
      throw new NotFoundException(
        'Aucune connexion SSO pour cette organisation',
      );
    }
    return connection;
  }

  private domainsOf(connectionId: string): Promise<SsoDomain[]> {
    return this.domainsRepo.find({
      where: { sso_connection_id: connectionId },
      order: { created_at: 'ASC' },
    });
  }

  private toView(
    connection: SsoConnection,
    domains: SsoDomain[],
  ): SsoConnectionView {
    return {
      id: connection.id,
      provider_id: connection.provider_id,
      protocol: connection.protocol,
      display_name: connection.display_name,
      status: connection.status,
      enforced: connection.enforced,
      default_role: connection.default_role,
      provisioning_error: connection.provisioning_error,
      domains: domains.map((d) => this.toDomainView(d)),
      created_at: connection.created_at,
    };
  }

  private toDomainView(domain: SsoDomain): SsoDomainView {
    return {
      id: domain.id,
      domain: domain.domain,
      // Truthiness plutôt que `!== null` : une entité tout juste construite par
      // `create()` n'a pas encore la colonne, et `undefined !== null` aurait
      // annoncé « vérifié » un domaine qui ne l'est pas.
      verified: Boolean(domain.verified_at),
      verified_at: domain.verified_at ?? null,
      expected_dns_record: domain.verified_at
        ? null
        : `${DOMAIN_VERIFICATION_PREFIX}${domain.verification_token}`,
    };
  }

  /**
   * Configurer le SSO, c'est décider qui entre dans l'organisation : même
   * exigence que la gestion des membres (PLAT-4) et des clés d'API (PLAT-5).
   */
  private assertCanManageSso(scope: OrgScope): void {
    if (
      scope.role !== OrganizationRole.OWNER &&
      scope.role !== OrganizationRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Seuls le propriétaire et les administrateurs configurent le SSO',
      );
    }
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
