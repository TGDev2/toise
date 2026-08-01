import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { User } from '../users/entities/user.entity';
import { OrganizationMembership } from '../organizations/entities/organization-membership.entity';
import {
  SsoConnection,
  SsoConnectionStatus,
} from '../enterprise/entities/sso-connection.entity';

/** Préfixes imposés par Identity Platform aux fournisseurs fédérés. */
const SSO_PROVIDER_PREFIXES = ['saml.', 'oidc.'];

/**
 * Même TTL que `FeatureGatesService` : le cache ne porte que sur « existe-t-il au
 * moins une connexion en enforcement ? », jamais sur la décision elle-même.
 */
const ENFORCEMENT_CACHE_TTL_MS = 60_000;

/**
 * Ce qui arrive à une session **au moment de la connexion** (BACKLOG PLAT-6).
 *
 * Deux responsabilités, toutes deux propres à l'authentification — d'où leur
 * place dans `auth/` plutôt que dans `enterprise/`, qui n'administre que les
 * enregistrements :
 *
 * - **le rattachement JIT** : une première connexion via l'IdP d'une organisation
 *   crée l'adhésion correspondante et y place l'utilisateur ;
 * - **l'enforcement** : quand une organisation l'exige, une session qui ne vient
 *   pas de son IdP ne peut pas travailler pour elle.
 *
 * Le rattachement se fait par `provider_id` — l'identifiant que **nous** avons
 * émis en créant le fournisseur chez GCIP — et jamais par le domaine de l'adresse
 * affirmée : un IdP ne parle que pour lui-même (PLAT-6 D3).
 */
@Injectable()
export class SsoSessionService {
  private readonly logger = new Logger(SsoSessionService.name);
  private enforcementCached = false;
  private enforcementCacheExpiry = 0;

  constructor(
    @InjectRepository(SsoConnection)
    private readonly connectionsRepo: Repository<SsoConnection>,
    @InjectRepository(OrganizationMembership)
    private readonly membershipsRepo: Repository<OrganizationMembership>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  /** `saml.acme-1a2b` / `oidc.acme-1a2b`, tels que GCIP les rend dans le jeton. */
  static isSsoProvider(signInProvider: string | undefined): boolean {
    return (
      signInProvider !== undefined &&
      SSO_PROVIDER_PREFIXES.some((prefix) => signInProvider.startsWith(prefix))
    );
  }

  /**
   * Rattachement à la connexion d'où vient la session. Idempotent, et **jamais
   * dégradant** : une adhésion existante n'est pas touchée, sans quoi le
   * propriétaire de l'organisation serait rétrogradé en `member` à sa propre
   * connexion SSO — et perdrait au passage le bris de glace de D9 (PLAT-6 D6).
   *
   * Un `provider_id` inconnu ou une connexion non active ne rattachent rien :
   * l'utilisateur reste dans son espace personnel (fail-closed, invariant I1).
   */
  async provisionFromSsoLogin(
    user: User,
    signInProvider: string,
  ): Promise<void> {
    const connection = await this.connectionsRepo.findOne({
      where: {
        provider_id: signInProvider,
        status: SsoConnectionStatus.ACTIVE,
      },
    });
    if (!connection) {
      this.logger.warn(
        `Connexion SSO inconnue ou inactive pour le fournisseur ${signInProvider}`,
      );
      return;
    }

    const existing = await this.membershipsRepo.findOne({
      where: {
        organization_id: connection.organization_id,
        user_id: user.id,
      },
    });

    if (!existing) {
      try {
        await this.membershipsRepo.save(
          this.membershipsRepo.create({
            organization_id: connection.organization_id,
            user_id: user.id,
            role: connection.default_role,
          }),
        );
        this.logger.log(
          `Adhésion créée au vol pour ${user.id} dans l'organisation ${connection.organization_id}`,
        );
      } catch (error) {
        // Deux connexions simultanées sur un compte neuf : `UQ_organization_memberships`
        // en rejette une, dont l'adhésion existe alors déjà. Rien à rattraper.
        if (!(error instanceof QueryFailedError)) throw error;
      }
    }

    if (user.active_organization_id !== connection.organization_id) {
      await this.usersRepo.update(user.id, {
        active_organization_id: connection.organization_id,
      });
      user.active_organization_id = connection.organization_id;
    }
  }

  /**
   * Refuse une session qui ne vient pas de l'IdP exigé par l'organisation active.
   *
   * Appelée par `FirebaseAuthGuard`, donc sur **toute** requête authentifiée :
   * c'est ce qui la rend impossible à oublier sur un nouveau contrôleur. Le coût
   * est nul tant qu'aucune organisation n'est en enforcement — le booléen mis en
   * cache court-circuite avant toute requête SQL (PLAT-6 D8, invariant I3).
   */
  async assertSessionAllowed(token: DecodedIdToken): Promise<void> {
    if (!(await this.anyEnforcedConnection())) return;

    const user = await this.usersRepo.findOne({
      where: { firebase_uid: token.uid },
      select: ['id', 'active_organization_id'],
    });
    // Compte pas encore synchronisé, ou espace personnel : rien à faire
    // respecter. L'espace personnel appartient à la personne, pas à l'entreprise.
    if (!user?.active_organization_id) return;

    const connection = await this.connectionsRepo.findOne({
      where: {
        organization_id: user.active_organization_id,
        enforced: true,
        status: SsoConnectionStatus.ACTIVE,
      },
      relations: ['organization'],
    });
    if (!connection) return;

    // Une adhésion révoquée fait déjà retomber `OrgContextService` sur l'espace
    // personnel : refuser ici enfermerait l'utilisateur au nom d'une organisation
    // qu'il a quittée.
    const membership = await this.membershipsRepo.findOne({
      where: { organization_id: connection.organization_id, user_id: user.id },
    });
    if (!membership) return;

    // Bris de glace : un certificat expiré rendrait sinon l'organisation
    // totalement inaccessible sans intervention du support (PLAT-6 D9).
    if (connection.organization.owner_user_id === user.id) return;

    if (token.firebase?.sign_in_provider === connection.provider_id) return;

    throw new ForbiddenException({
      message: `${connection.organization.name} impose la connexion via ${connection.display_name}.`,
      error: 'SSO_REQUIRED',
      provider_id: connection.provider_id,
      protocol: connection.protocol,
    });
  }

  /**
   * Invalidée explicitement par `SsoConnectionsService` à chaque bascule
   * d'enforcement. Le TTL reste le filet en déploiement multi-instances, où
   * l'invalidation d'un process ne touche pas ses voisins — même compromis que
   * le cache de `FeatureGatesService`.
   */
  invalidateEnforcementCache(): void {
    this.enforcementCacheExpiry = 0;
  }

  private async anyEnforcedConnection(): Promise<boolean> {
    if (Date.now() < this.enforcementCacheExpiry) return this.enforcementCached;

    const count = await this.connectionsRepo.count({
      where: { enforced: true, status: SsoConnectionStatus.ACTIVE },
    });
    this.enforcementCached = count > 0;
    this.enforcementCacheExpiry = Date.now() + ENFORCEMENT_CACHE_TTL_MS;
    return this.enforcementCached;
  }
}
