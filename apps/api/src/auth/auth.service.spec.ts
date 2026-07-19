import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { AuthService } from './auth.service';
import { FirebaseConfig } from '../config/firebase.config';
import { UsersService } from '../users/users.service';
import { CompanyProfilesService } from '../company-profiles/company-profiles.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';
import {
  AuthProvider,
  SubscriptionTier,
  User,
  UserRole,
} from '../users/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;

  const mockFirebaseAuth = {
    createUser: jest.fn(),
    generatePasswordResetLink: jest.fn(),
    deleteUser: jest.fn(),
    verifyIdToken: jest.fn(),
  };

  const usersServiceMock = {
    findByEmail: jest.fn(),
    findByFirebaseUid: jest.fn(),
    upsertFromFirebase: jest.fn(),
    transferProjects: jest.fn(),
    deleteUser: jest.fn(),
  };

  const firebaseConfigMock = {
    getAuth: jest.fn(() => mockFirebaseAuth),
  };

  const companyProfilesServiceMock = {
    create: jest.fn(),
    findByUserId: jest.fn(),
    update: jest.fn(),
  };

  const analyticsServiceMock = {
    track: jest.fn(),
  };

  let usersService: typeof usersServiceMock;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    auth_provider: AuthProvider.EMAIL,
    subscription_tier: SubscriptionTier.FREE,
    role: UserRole.USER,
    email_verified: false,
    firebase_uid: 'firebase-uid-123',
    created_at: new Date(),
    updated_at: new Date(),
  };

  type DecodedTokenOverrides = Omit<
    Partial<DecodedIdToken>,
    'firebase' | 'uid'
  > &
    Pick<DecodedIdToken, 'uid'> & {
      firebase?: Partial<DecodedIdToken['firebase']>;
    };

  const createDecodedToken = (
    overrides: DecodedTokenOverrides,
  ): DecodedIdToken => {
    const { firebase, uid, ...tokenOverrides } = overrides;

    return {
      aud: 'chiffreo-test',
      auth_time: 0,
      exp: 0,
      iat: 0,
      iss: 'https://securetoken.google.com/chiffreo-test',
      uid,
      sub: uid,
      firebase: {
        identities: {},
        sign_in_provider: 'password',
        ...firebase,
      },
      ...tokenOverrides,
    } as DecodedIdToken;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
        {
          provide: FirebaseConfig,
          useValue: firebaseConfigMock,
        },
        {
          provide: CompanyProfilesService,
          useValue: companyProfilesServiceMock,
        },
        {
          provide: AnalyticsService,
          useValue: analyticsServiceMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<typeof usersServiceMock>(UsersService);
  });

  describe('register', () => {
    it('should create a new user and return it', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      mockFirebaseAuth.createUser.mockResolvedValue({ uid: 'new-uid' });
      usersService.upsertFromFirebase.mockResolvedValue({
        user: mockUser,
        isNewAccount: true,
      });

      const result = await service.register({
        email: 'test@example.com',
        password: 'securepass123',
      });

      expect(result.user).toEqual(mockUser);
      expect(result.message).toBe('Verification email sent');
      expect(mockFirebaseAuth.createUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'securepass123',
        displayName: undefined,
        emailVerified: false,
      });
    });

    it('should track account_created for a newly registered user', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      mockFirebaseAuth.createUser.mockResolvedValue({ uid: 'new-uid' });
      usersService.upsertFromFirebase.mockResolvedValue({
        user: mockUser,
        isNewAccount: true,
      });

      await service.register({
        email: 'test@example.com',
        password: 'securepass123',
      });

      expect(analyticsServiceMock.track).toHaveBeenCalledWith(
        AnalyticsEventName.ACCOUNT_CREATED,
        mockUser.id,
        { auth_provider: mockUser.auth_provider },
      );
    });

    it('should roll back the Firebase user if database sync fails', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      mockFirebaseAuth.createUser.mockResolvedValue({ uid: 'new-uid' });
      usersService.upsertFromFirebase.mockRejectedValue(new Error('db failed'));
      mockFirebaseAuth.deleteUser.mockResolvedValue(undefined);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'securepass123',
        }),
      ).rejects.toThrow('db failed');

      expect(mockFirebaseAuth.deleteUser).toHaveBeenCalledWith('new-uid');
    });

    it('should throw ConflictException if email already exists', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'securepass123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('syncUser', () => {
    it('should upsert user from Firebase token', async () => {
      usersService.upsertFromFirebase.mockResolvedValue({
        user: mockUser,
        isNewAccount: false,
      });

      const decodedToken = createDecodedToken({
        uid: 'firebase-uid-123',
        email: 'test@example.com',
        email_verified: true,
        firebase: { sign_in_provider: 'password' },
      });

      const result = await service.syncUser(decodedToken);
      expect(result).toEqual(mockUser);
      expect(usersService.upsertFromFirebase).toHaveBeenCalledWith(
        'firebase-uid-123',
        'test@example.com',
        AuthProvider.EMAIL,
        true,
      );
    });

    it('should resolve Google provider correctly', async () => {
      usersService.upsertFromFirebase.mockResolvedValue({
        user: mockUser,
        isNewAccount: false,
      });

      const decodedToken = createDecodedToken({
        uid: 'firebase-uid-123',
        email: 'test@gmail.com',
        email_verified: true,
        firebase: { sign_in_provider: 'google.com' },
      });

      await service.syncUser(decodedToken);
      expect(usersService.upsertFromFirebase).toHaveBeenCalledWith(
        'firebase-uid-123',
        'test@gmail.com',
        AuthProvider.GOOGLE,
        true,
      );
    });

    it('should resolve anonymous provider correctly', async () => {
      usersService.upsertFromFirebase.mockResolvedValue({
        user: mockUser,
        isNewAccount: false,
      });

      const decodedToken = createDecodedToken({
        uid: 'anon-uid',
        email: undefined,
        email_verified: false,
        firebase: { sign_in_provider: 'anonymous' },
      });

      await service.syncUser(decodedToken);
      expect(usersService.upsertFromFirebase).toHaveBeenCalledWith(
        'anon-uid',
        null,
        AuthProvider.ANONYMOUS,
        false,
      );
    });

    it('should track account_created when a new account is created (social signup or guest conversion)', async () => {
      usersService.upsertFromFirebase.mockResolvedValue({
        user: mockUser,
        isNewAccount: true,
      });

      const decodedToken = createDecodedToken({
        uid: 'firebase-uid-123',
        email: 'test@gmail.com',
        email_verified: true,
        firebase: { sign_in_provider: 'google.com' },
      });

      await service.syncUser(decodedToken);

      expect(analyticsServiceMock.track).toHaveBeenCalledWith(
        AnalyticsEventName.ACCOUNT_CREATED,
        mockUser.id,
        { auth_provider: mockUser.auth_provider },
      );
    });

    it('should not track account_created on an ordinary re-login/token refresh', async () => {
      usersService.upsertFromFirebase.mockResolvedValue({
        user: mockUser,
        isNewAccount: false,
      });

      const decodedToken = createDecodedToken({
        uid: 'firebase-uid-123',
        email: 'test@example.com',
        email_verified: true,
        firebase: { sign_in_provider: 'password' },
      });

      await service.syncUser(decodedToken);

      expect(analyticsServiceMock.track).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('should not throw even if email does not exist', async () => {
      mockFirebaseAuth.generatePasswordResetLink.mockRejectedValue(
        new Error('User not found'),
      );

      await expect(
        service.forgotPassword('unknown@example.com'),
      ).resolves.toBeUndefined();
    });

    it('should generate reset link for existing email', async () => {
      mockFirebaseAuth.generatePasswordResetLink.mockResolvedValue(
        'https://reset.link',
      );

      await service.forgotPassword('test@example.com');
      expect(mockFirebaseAuth.generatePasswordResetLink).toHaveBeenCalledWith(
        'test@example.com',
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      usersService.findByFirebaseUid.mockResolvedValue(mockUser);

      const result = await service.getProfile('firebase-uid-123');
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      usersService.findByFirebaseUid.mockResolvedValue(null);

      await expect(service.getProfile('unknown-uid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteAccount', () => {
    it('should delete user from Firebase and database', async () => {
      usersService.findByFirebaseUid.mockResolvedValue(mockUser);
      mockFirebaseAuth.deleteUser.mockResolvedValue(undefined);
      usersService.deleteUser.mockResolvedValue(undefined);

      await service.deleteAccount('firebase-uid-123');

      expect(mockFirebaseAuth.deleteUser).toHaveBeenCalledWith(
        'firebase-uid-123',
      );
      expect(usersService.deleteUser).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw NotFoundException if user not found', async () => {
      usersService.findByFirebaseUid.mockResolvedValue(null);

      await expect(service.deleteAccount('unknown-uid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('mergeGuestAccount', () => {
    const anonymousUser: User = {
      ...mockUser,
      id: 'anon-db-id',
      firebase_uid: 'anon-firebase-uid',
      auth_provider: AuthProvider.ANONYMOUS,
      email: null,
    };

    it('should transfer projects and delete anonymous user', async () => {
      usersService.findByFirebaseUid
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(anonymousUser);
      usersService.transferProjects.mockResolvedValue(undefined);
      mockFirebaseAuth.deleteUser.mockResolvedValue(undefined);
      usersService.deleteUser.mockResolvedValue(undefined);

      const result = await service.mergeGuestAccount(
        'firebase-uid-123',
        'anon-firebase-uid',
      );

      expect(result).toEqual(mockUser);
      expect(usersService.transferProjects).toHaveBeenCalledWith(
        'anon-db-id',
        mockUser.id,
      );
      expect(usersService.deleteUser).toHaveBeenCalledWith('anon-db-id');
    });

    it('should throw NotFoundException if target user not found', async () => {
      usersService.findByFirebaseUid
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(anonymousUser);

      await expect(
        service.mergeGuestAccount('unknown-uid', 'anon-firebase-uid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject merges into another anonymous account', async () => {
      usersService.findByFirebaseUid
        .mockResolvedValueOnce(anonymousUser)
        .mockResolvedValueOnce(anonymousUser);

      await expect(
        service.mergeGuestAccount('anon-firebase-uid', 'anon-firebase-uid'),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject merges when the source account is not anonymous', async () => {
      usersService.findByFirebaseUid
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockUser);

      await expect(
        service.mergeGuestAccount('firebase-uid-123', 'firebase-uid-456'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
