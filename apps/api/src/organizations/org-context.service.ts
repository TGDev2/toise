import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { SubscriptionTier, User } from '../users/entities/user.entity';
import { Organization } from './entities/organization.entity';
import {
  OrganizationMembership,
  OrganizationRole,
} from './entities/organization-membership.entity';

/**
 * Portée d'une requête authentifiée : qui agit (`userId`) et pour le compte de
 * quelle organisation (`organizationId`). Toutes les lectures et écritures des
 * modules métier se filtrent sur `organizationId` ; `userId` ne sert plus qu'à
 * horodater l'auteur.
 */
export interface OrgScope {
  user: User;
  userId: string;
  organization: Organization;
  organizationId: string;
  role: OrganizationRole;
  /** Palier du propriétaire de l'organisation — cf. tasks/todo.md §PLAT-4 D3. */
  effectiveTier: SubscriptionTier;
}

const PERSONAL_ORG_DEFAULT_NAME = 'Mon espace';

/**
 * Résolution de l'organisation active d'un utilisateur (BACKLOG PLAT-4).
 *
 * Volontairement sans dépendance vers `FeatureGatesModule` : c'est
 * `FeatureGateGuard` qui dépend de ce service pour connaître le palier effectif,
 * jamais l'inverse — sans quoi le cycle de modules serait immédiat.
 *
 * L'organisation active se résout **exclusivement côté serveur**. Aucun en-tête
 * ni paramètre client n'est lu : un identifiant d'organisation fourni par
 * l'appelant serait une surface d'IDOR sur la totalité des données métier.
 */
@Injectable()
export class OrgContextService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Organization)
    private readonly orgsRepo: Repository<Organization>,
    @InjectRepository(OrganizationMembership)
    private readonly membershipsRepo: Repository<OrganizationMembership>,
  ) {}

  async resolveForFirebaseUid(firebaseUid: string): Promise<OrgScope> {
    const user = await this.usersRepo.findOne({
      where: { firebase_uid: firebaseUid },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.resolveForUser(user);
  }

  /**
   * Ordre de résolution : organisation active explicite (si l'adhésion existe
   * toujours — un membre révoqué retombe donc sur son espace personnel plutôt
   * que de garder un accès fantôme), sinon organisation personnelle, sinon
   * création paresseuse.
   */
  async resolveForUser(user: User): Promise<OrgScope> {
    let membership: OrganizationMembership | null = null;

    if (user.active_organization_id) {
      membership = await this.membershipsRepo.findOne({
        where: {
          organization_id: user.active_organization_id,
          user_id: user.id,
        },
        relations: ['organization'],
      });
    }

    if (!membership) {
      const organization = await this.getOrCreatePersonalOrganization(user);
      return this.buildScope(user, organization, OrganizationRole.OWNER);
    }

    return this.buildScope(user, membership.organization, membership.role);
  }

  /**
   * Espace personnel de l'utilisateur, créé à la volée pour les comptes nés
   * après la migration de backfill — même patron que `getOrCreateDefaultRoom`
   * (ENG-2), ce qui évite d'avoir à câbler la création dans `AuthService` et
   * couvre au passage les comptes anonymes.
   */
  async getOrCreatePersonalOrganization(user: User): Promise<Organization> {
    const existing = await this.findPersonalOrganization(user.id);
    if (existing) return existing;

    try {
      const organization = await this.orgsRepo.save(
        this.orgsRepo.create({
          name: PERSONAL_ORG_DEFAULT_NAME,
          owner_user_id: user.id,
          is_personal: true,
        }),
      );
      await this.membershipsRepo.save(
        this.membershipsRepo.create({
          organization_id: organization.id,
          user_id: user.id,
          role: OrganizationRole.OWNER,
        }),
      );
      return organization;
    } catch (error) {
      // Deux requêtes concurrentes sur un compte neuf : l'index unique partiel
      // `UQ_organizations_personal_owner` en rejette une, qui relit la gagnante.
      if (!(error instanceof QueryFailedError)) throw error;
      const created = await this.findPersonalOrganization(user.id);
      if (!created) throw error;
      return created;
    }
  }

  /**
   * Palier porté par une organisation, **sans utilisateur appelant** — le cas
   * d'une clé d'API, qui appartient à l'organisation et non à une personne
   * (BACKLOG PLAT-5 D1). Même règle que `resolveEffectiveTier` : c'est le palier
   * du propriétaire qui fait foi. Elle vit ici, et nulle part ailleurs : la
   * réécrire dans le guard des clés la ferait diverger au premier changement.
   *
   * Fail-closed : organisation ou propriétaire introuvable ⇒ `free`, palier
   * auquel la gate `public_api` refuse l'accès.
   */
  async resolveTierForOrganization(
    organizationId: string,
  ): Promise<SubscriptionTier> {
    const row = await this.orgsRepo
      .createQueryBuilder('o')
      .innerJoin(User, 'u', 'u.id = o.owner_user_id')
      .where('o.id = :organizationId', { organizationId })
      .select('u.subscription_tier', 'subscription_tier')
      .getRawOne<{ subscription_tier: SubscriptionTier }>();

    return row?.subscription_tier ?? SubscriptionTier.FREE;
  }

  async findMembership(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMembership | null> {
    return this.membershipsRepo.findOne({
      where: { organization_id: organizationId, user_id: userId },
    });
  }

  private findPersonalOrganization(
    userId: string,
  ): Promise<Organization | null> {
    return this.orgsRepo.findOne({
      where: { owner_user_id: userId, is_personal: true },
    });
  }

  private async buildScope(
    user: User,
    organization: Organization,
    role: OrganizationRole,
  ): Promise<OrgScope> {
    return {
      user,
      userId: user.id,
      organization,
      organizationId: organization.id,
      role,
      effectiveTier: await this.resolveEffectiveTier(user, organization),
    };
  }

  /**
   * Le palier suit l'organisation : un salarié `free` invité chez un Contractor
   * Premium travaille avec les capacités Premium tant qu'il est dans cette org,
   * et retrouve son propre palier dans son espace personnel.
   */
  private async resolveEffectiveTier(
    user: User,
    organization: Organization,
  ): Promise<SubscriptionTier> {
    if (organization.owner_user_id === user.id) {
      return user.subscription_tier;
    }
    const owner = await this.usersRepo.findOne({
      where: { id: organization.owner_user_id },
      select: ['id', 'subscription_tier'],
    });
    return owner?.subscription_tier ?? SubscriptionTier.FREE;
  }
}
