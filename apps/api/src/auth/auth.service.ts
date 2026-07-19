import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseConfig } from '../config/firebase.config';
import { UsersService } from '../users/users.service';
import { CompanyProfilesService } from '../company-profiles/company-profiles.service';
import { AuthProvider, User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly firebase: FirebaseConfig,
    private readonly usersService: UsersService,
    private readonly companyProfilesService: CompanyProfilesService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: User; message: string }> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const auth = this.firebase.getAuth();
    let firebaseUser: { uid: string } | null = null;

    try {
      firebaseUser = await auth.createUser({
        email: dto.email,
        password: dto.password,
        displayName: dto.display_name,
        emailVerified: false,
      });

      const { user, isNewAccount } = await this.usersService.upsertFromFirebase(
        firebaseUser.uid,
        dto.email,
        AuthProvider.EMAIL,
        false,
      );

      if (dto.company_profile) {
        await this.companyProfilesService.create(user.id, dto.company_profile);
      }

      if (isNewAccount) {
        this.analyticsService.track(
          AnalyticsEventName.ACCOUNT_CREATED,
          user.id,
          {
            auth_provider: user.auth_provider,
          },
        );
      }

      return { user, message: 'Verification email sent' };
    } catch (error) {
      if (firebaseUser) {
        await auth.deleteUser(firebaseUser.uid).catch(() => {
          this.logger.warn(
            `Failed to roll back Firebase user ${firebaseUser?.uid} after registration error`,
          );
        });
      }

      throw error;
    }
  }

  async syncUser(decodedToken: DecodedIdToken): Promise<User> {
    const provider = this.resolveProvider(decodedToken);
    const { user, isNewAccount } = await this.usersService.upsertFromFirebase(
      decodedToken.uid,
      decodedToken.email ?? null,
      provider,
      decodedToken.email_verified ?? false,
    );

    if (isNewAccount) {
      this.analyticsService.track(AnalyticsEventName.ACCOUNT_CREATED, user.id, {
        auth_provider: user.auth_provider,
      });
    }

    return user;
  }

  async forgotPassword(email: string): Promise<void> {
    try {
      await this.firebase.getAuth().generatePasswordResetLink(email);
      this.logger.log(`Password reset link generated for ${email}`);
    } catch {
      // Don't reveal whether email exists
      this.logger.log(`Password reset requested for unknown email: ${email}`);
    }
  }

  async getProfile(firebaseUid: string): Promise<User> {
    const user = await this.usersService.findByFirebaseUid(firebaseUid);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async deleteAccount(firebaseUid: string): Promise<void> {
    const user = await this.usersService.findByFirebaseUid(firebaseUid);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.firebase.getAuth().deleteUser(firebaseUid);
    await this.usersService.deleteUser(user.id);
    this.logger.log(`Account deleted for user ${user.id}`);
  }

  async mergeGuestAccount(
    targetFirebaseUid: string,
    anonymousFirebaseUid: string,
  ): Promise<User> {
    const targetUser =
      await this.usersService.findByFirebaseUid(targetFirebaseUid);
    const anonymousUser =
      await this.usersService.findByFirebaseUid(anonymousFirebaseUid);

    if (!targetUser || !anonymousUser) {
      throw new NotFoundException('User not found');
    }
    if (targetUser.auth_provider === AuthProvider.ANONYMOUS) {
      throw new ConflictException('Target account must be a registered user');
    }
    if (anonymousUser.auth_provider !== AuthProvider.ANONYMOUS) {
      throw new ConflictException('Only anonymous accounts can be merged');
    }
    if (targetUser.id === anonymousUser.id) {
      throw new ConflictException('Cannot merge an account into itself');
    }

    await this.usersService.transferProjects(anonymousUser.id, targetUser.id);

    // Delete the anonymous user from Firebase and DB
    try {
      await this.firebase.getAuth().deleteUser(anonymousFirebaseUid);
    } catch {
      this.logger.warn(
        `Failed to delete anonymous Firebase user ${anonymousFirebaseUid}`,
      );
    }
    await this.usersService.deleteUser(anonymousUser.id);

    return targetUser;
  }

  private resolveProvider(token: DecodedIdToken): AuthProvider {
    if (token.firebase?.sign_in_provider === 'anonymous') {
      return AuthProvider.ANONYMOUS;
    }
    if (token.firebase?.sign_in_provider === 'google.com') {
      return AuthProvider.GOOGLE;
    }
    if (token.firebase?.sign_in_provider === 'apple.com') {
      return AuthProvider.APPLE;
    }
    return AuthProvider.EMAIL;
  }
}
