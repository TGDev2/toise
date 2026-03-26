import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, AuthProvider } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
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

  transferProjects(fromUserId: string, toUserId: string): Promise<void> {
    void fromUserId;
    void toUserId;
    // Will be implemented when the projects module exists.
    // For now this is a placeholder for the guest merge flow.
    // await this.projectsRepo.update({ user_id: fromUserId }, { user_id: toUserId });
    return Promise.resolve();
  }

  async deleteUser(id: string): Promise<void> {
    await this.usersRepo.delete(id);
  }
}
