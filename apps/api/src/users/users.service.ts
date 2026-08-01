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

  async deleteUser(id: string): Promise<void> {
    await this.usersRepo.delete(id);
  }
}
