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
  ): Promise<User> {
    let user = await this.findByFirebaseUid(firebaseUid);

    if (user) {
      user.email = email ?? user.email;
      user.auth_provider =
        user.auth_provider === AuthProvider.ANONYMOUS
          ? provider
          : user.auth_provider;
      user.email_verified = emailVerified || user.email_verified;
      return this.usersRepo.save(user);
    }

    user = this.usersRepo.create({
      firebase_uid: firebaseUid,
      email,
      auth_provider: provider,
      email_verified: emailVerified,
    });
    return this.usersRepo.save(user);
  }

  async transferProjects(
    fromUserId: string,
    toUserId: string,
  ): Promise<void> {
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

  async deleteUser(id: string): Promise<void> {
    await this.usersRepo.delete(id);
  }
}
