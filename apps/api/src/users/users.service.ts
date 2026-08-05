import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User, AuthProvider, SubscriptionTier } from './entities/user.entity';
import { Project } from '../projects/entities/project.entity';
import { Organization } from '../organizations/entities/organization.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
  ) {}

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { firebase_uid: firebaseUid } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async upsertFromFirebase(
    firebaseUid: string,
    email: string | null,
    provider: AuthProvider,
    emailVerified: boolean,
  ): Promise<{ user: User; isNewAccount: boolean }> {
    let user = await this.findByFirebaseUid(firebaseUid);

    if (user) {
      const wasAnonymous = user.auth_provider === AuthProvider.ANONYMOUS;
      user.email = email ?? user.email;
      user.auth_provider = wasAnonymous ? provider : user.auth_provider;
      user.email_verified = emailVerified || user.email_verified;
      const saved = await this.usersRepo.save(user);
      return {
        user: saved,
        isNewAccount: wasAnonymous && provider !== AuthProvider.ANONYMOUS,
      };
    }

    user = this.usersRepo.create({
      firebase_uid: firebaseUid,
      email,
      auth_provider: provider,
      email_verified: emailVerified,
    });
    const saved = await this.usersRepo.save(user);
    return { user: saved, isNewAccount: provider !== AuthProvider.ANONYMOUS };
  }

  /**
   * Fusion invité → compte réel. Depuis PLAT-4 la propriété est portée par
   * l'organisation : repointer `user_id` seul laisserait le projet dans l'org
   * de l'invité, donc hors de portée du compte cible.
   */
  async transferProjects(
    fromUserId: string,
    toUserId: string,
    toOrganizationId: string,
  ): Promise<void> {
    await this.projectsRepo.update(
      { user_id: fromUserId, deleted_at: IsNull() },
      { user_id: toUserId, organization_id: toOrganizationId },
    );
  }

  async updateSubscriptionTier(
    userId: string,
    tier: SubscriptionTier,
  ): Promise<void> {
    await this.usersRepo.update(userId, { subscription_tier: tier });
  }

  /**
   * Retombe sur le palier gratuit, mais seulement s'il ne l'est pas déjà.
   *
   * Le test et l'écriture sont **une seule instruction SQL**, donc sous le
   * verrou de ligne de PostgreSQL. C'est ce qui rend le balayage horaire du
   * délai de grâce (`sweepExpiredGracePeriods`) idempotent : il repasse sur les
   * mêmes lignes `past_due` toutes les heures, et seul le premier passage
   * touche quelque chose. Un `SELECT` suivi d'un `UPDATE` donnerait le même
   * résultat en séquentiel et compterait deux fois sous deux instances.
   *
   * @returns `true` si le palier a effectivement changé — l'appelant n'émet son
   * événement analytique que dans ce cas, sans quoi le funnel verrait une
   * expiration par heure et par abonné.
   */
  async downgradeToFreeIfNeeded(userId: string): Promise<boolean> {
    const result = await this.usersRepo
      .createQueryBuilder()
      .update(User)
      .set({ subscription_tier: SubscriptionTier.FREE })
      .where('id = :id', { id: userId })
      .andWhere('subscription_tier <> :free', {
        free: SubscriptionTier.FREE,
      })
      .execute();

    return (result.affected ?? 0) > 0;
  }

  /**
   * Efface un compte et les seules organisations qui ne concernaient que lui,
   * en une transaction.
   *
   * L'atomicité est ici la propriété qui compte : `FK_organizations_owner` est
   * passée en `ON DELETE RESTRICT` (migration 1711468800061), donc une
   * organisation encore possédée bloque la suppression de son propriétaire. En
   * deux instructions séparées, un échec entre les deux laisserait soit des
   * organisations sans compte, soit un compte dont on a déjà détruit l'espace
   * de travail. La liste est calculée en amont par
   * `OrgContextService.collectOrganizationsRemovableWithOwner`, qui refuse le
   * cas d'une organisation partagée.
   *
   * Les adhésions de l'utilisateur aux organisations **des autres** partent
   * avec lui (`FK_organization_memberships_user ON DELETE CASCADE`) : il les
   * quitte, il ne les emporte pas.
   */
  async deleteAccountData(
    userId: string,
    ownedOrganizationIds: string[],
  ): Promise<void> {
    await this.usersRepo.manager.transaction(async (manager) => {
      if (ownedOrganizationIds.length > 0) {
        await manager.delete(Organization, ownedOrganizationIds);
      }
      await manager.delete(User, userId);
    });
  }
}
