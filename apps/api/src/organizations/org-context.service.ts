import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, QueryFailedError, Repository } from 'typeorm';
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
   * Précondition de suppression d'un compte : renvoie les organisations qui
   * peuvent disparaître avec leur propriétaire, ou refuse l'opération.
   *
   * `FK_organizations_owner` était en `ON DELETE CASCADE` (migration
   * 1711468800061) : supprimer un propriétaire effaçait son organisation, et
   * avec elle — par les `FK_<table>_organization`, elles aussi en cascade — les
   * projets, clients, devis, factures et le profil d'entreprise de **tous** ses
   * membres. Une décision individuelle détruisait donc des données collectives,
   * sans que rien ne l'annonce ni ne le trace.
   *
   * La règle retenue : une organisation ne se supprime avec son propriétaire
   * que si elle ne concerne que lui. Dès qu'un autre membre existe, la
   * suppression est refusée et l'utilisateur doit d'abord transférer la
   * propriété ou retirer les membres — un geste explicite, réversible, et qui
   * ne fait rien perdre à personne.
   */
  async collectOrganizationsRemovableWithOwner(
    userId: string,
  ): Promise<string[]> {
    const owned = await this.orgsRepo.find({
      where: { owner_user_id: userId },
    });

    const removable: string[] = [];
    for (const organization of owned) {
      const otherMembers = await this.membershipsRepo.count({
        where: {
          organization_id: organization.id,
          user_id: Not(userId),
        },
      });
      if (otherMembers > 0) {
        throw new ConflictException(
          `Vous êtes propriétaire de l'organisation « ${organization.name} », qui compte ` +
            `encore ${otherMembers} autre(s) membre(s). Transférez la propriété ou retirez ` +
            `ces membres avant de supprimer votre compte.`,
        );
      }
      removable.push(organization.id);
    }

    return removable;
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
