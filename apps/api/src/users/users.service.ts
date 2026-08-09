import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User, AuthProvider, SubscriptionTier } from './entities/user.entity';
import { Project } from '../projects/entities/project.entity';

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
  ): Promise<{
    user: User;
    isNewAccount: boolean;
    /**
     * Marche « session invité démarrée » du funnel de revenu (BACKLOG_V1) :
     * vrai uniquement à la toute première ligne d'un compte anonyme. Un
     * invité qui revient n'en démarre pas une nouvelle.
     */
    isNewGuestSession: boolean;
  }> {
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
        isNewGuestSession: false,
      };
    }

    user = this.usersRepo.create({
      firebase_uid: firebaseUid,
      email,
      auth_provider: provider,
      email_verified: emailVerified,
    });
    const saved = await this.usersRepo.save(user);
    return {
      user: saved,
      isNewAccount: provider !== AuthProvider.ANONYMOUS,
      isNewGuestSession: provider === AuthProvider.ANONYMOUS,
    };
  }

  /**
   * Fusion invité → compte réel : les projets vivants changent de propriétaire.
   */
  async transferProjects(fromUserId: string, toUserId: string): Promise<void> {
    await this.projectsRepo.update(
      { user_id: fromUserId, deleted_at: IsNull() },
      { user_id: toUserId },
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
   * Efface un compte et, par cascade, tout ce qui lui appartient.
   *
   * Une seule instruction depuis E4-1 : la propriété est revenue sur `user_id`
   * et les `FK_<table>_user` des cinq tables métier sont en
   * `ON DELETE CASCADE`, donc `DELETE FROM users` suffit. L'étape préalable de
   * suppression des organisations possédées — rendue nécessaire par le
   * `ON DELETE RESTRICT` de `FK_organizations_owner` (migration
   * 1711468800061) — n'a plus d'objet : il n'y a plus d'organisation.
   *
   * La transaction est conservée : le contrat de la méthode reste « le compte
   * et ses données partent ensemble ou pas du tout ».
   */
  async deleteAccountData(userId: string): Promise<void> {
    await this.usersRepo.manager.transaction(async (manager) => {
      await manager.delete(User, userId);
    });
  }
}
