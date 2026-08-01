import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { FirebaseAuthGuard } from '../src/auth/guards/firebase-auth.guard';
import { CompanyProfilesService } from '../src/company-profiles/company-profiles.service';
import { OrgContextService } from '../src/organizations/org-context.service';
import {
  AuthProvider,
  SubscriptionTier,
  User,
  UserRole,
} from '../src/users/entities/user.entity';

const mockUser: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  auth_provider: AuthProvider.EMAIL,
  subscription_tier: SubscriptionTier.FREE,
  role: UserRole.USER,
  email_verified: true,
  firebase_uid: 'firebase-uid-123',
  referral_code: null,
  referred_by_user_id: null,
  referral_converted_at: null,
  active_organization_id: null,
  created_at: new Date('2026-03-26T00:00:00.000Z'),
  updated_at: new Date('2026-03-26T00:00:00.000Z'),
};

const authServiceMock = {
  register: jest.fn(),
  syncUser: jest.fn(),
  forgotPassword: jest.fn(),
  getProfile: jest.fn(),
  deleteAccount: jest.fn(),
  mergeGuestAccount: jest.fn(),
};

const orgContextMock = {
  resolveForUser: jest
    .fn()
    .mockResolvedValue({ organizationId: 'org-uuid', role: 'owner' }),
};

const companyProfilesServiceMock = {
  findByOrganizationId: jest.fn(),
};

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    jest.clearAllMocks();

    authServiceMock.register.mockResolvedValue({
      user: mockUser,
      message: 'Verification email sent',
    });
    authServiceMock.syncUser.mockResolvedValue(mockUser);
    authServiceMock.forgotPassword.mockResolvedValue(undefined);
    authServiceMock.getProfile.mockResolvedValue(mockUser);
    authServiceMock.deleteAccount.mockResolvedValue(undefined);
    authServiceMock.mergeGuestAccount.mockResolvedValue(mockUser);
    companyProfilesServiceMock.findByOrganizationId.mockResolvedValue(null);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
        {
          provide: CompanyProfilesService,
          useValue: companyProfilesServiceMock,
        },
        {
          provide: OrgContextService,
          useValue: orgContextMock,
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext): boolean {
          const request = context.switchToHttp().getRequest<{
            firebaseUser?: { uid: string; email?: string };
          }>();
          request.firebaseUser = {
            uid: mockUser.firebase_uid,
            email: mockUser.email ?? undefined,
          };
          return true;
        },
      } satisfies CanActivate)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('registers a new user', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'securepass123',
      })
      .expect(201)
      .expect({
        user_id: mockUser.id,
        message: 'Verification email sent',
      });

    expect(authServiceMock.register).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'securepass123',
    });
  });

  it('rejects invalid registration payloads', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'not-an-email',
        password: 'short',
      })
      .expect(400);
  });

  it('accepts forgot password requests with a generic response', async () => {
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'test@example.com' })
      .expect(200)
      .expect({
        message: 'If the email exists, a reset link has been sent',
      });

    expect(authServiceMock.forgotPassword).toHaveBeenCalledWith(
      'test@example.com',
    );
  });

  it('syncs an authenticated Firebase user', async () => {
    await request(app.getHttpServer()).post('/auth/sync').expect(201).expect({
      id: mockUser.id,
      email: mockUser.email,
      auth_provider: mockUser.auth_provider,
      subscription_tier: mockUser.subscription_tier,
      role: mockUser.role,
      email_verified: mockUser.email_verified,
      created_at: mockUser.created_at.toISOString(),
      has_company_profile: false,
    });

    expect(authServiceMock.syncUser).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: mockUser.firebase_uid,
      }),
    );
  });

  it('returns the authenticated profile', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(200).expect({
      id: mockUser.id,
      email: mockUser.email,
      auth_provider: mockUser.auth_provider,
      subscription_tier: mockUser.subscription_tier,
      role: mockUser.role,
      email_verified: mockUser.email_verified,
      created_at: mockUser.created_at.toISOString(),
      has_company_profile: false,
    });

    expect(authServiceMock.getProfile).toHaveBeenCalledWith(
      mockUser.firebase_uid,
    );
  });

  it('deletes the authenticated account', async () => {
    await request(app.getHttpServer()).delete('/auth/me').expect(204);

    expect(authServiceMock.deleteAccount).toHaveBeenCalledWith(
      mockUser.firebase_uid,
    );
  });

  it('merges an anonymous guest account into the authenticated account', async () => {
    await request(app.getHttpServer())
      .post('/auth/merge-guest')
      .send({
        anonymous_firebase_uid: 'anon-firebase-uid',
      })
      .expect(201)
      .expect({
        id: mockUser.id,
        email: mockUser.email,
        auth_provider: mockUser.auth_provider,
        message: 'Guest account merged successfully',
      });

    expect(authServiceMock.mergeGuestAccount).toHaveBeenCalledWith(
      mockUser.firebase_uid,
      'anon-firebase-uid',
    );
  });
});
