import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { CvRetrainingController } from '../src/analysis/cv-retraining.controller';
import { CvRetrainingService } from '../src/analysis/cv-retraining.service';
import { PhotosService } from '../src/photos/photos.service';
import { UsersService } from '../src/users/users.service';
import { OrgContextService } from '../src/organizations/org-context.service';
import { FirebaseAuthGuard } from '../src/auth/guards/firebase-auth.guard';
import { UserRole } from '../src/users/entities/user.entity';

const emptyExport = {
  generated_at: '2026-07-24T00:00:00.000Z',
  since: null,
  next_since: null,
  job_count: 0,
  jobs: [],
};

const cvRetrainingServiceMock = {
  buildExport: jest.fn().mockResolvedValue(emptyExport),
};

const photosServiceMock = {
  findByStorageUrl: jest.fn().mockResolvedValue(null),
  getFileAbsolutePath: jest.fn(),
};

const usersServiceMock = {
  findByFirebaseUid: jest.fn(),
};

// PLAT-4 : les contrôleurs résolvent désormais la portée (organisation + auteur)
// au lieu de recharger l'utilisateur ; le guard de feature gates lit le palier
// effectif de l'organisation via ce même service.
const mockUserId = '00000000-0000-4000-8000-0000000000bb';
const mockOrgId = '00000000-0000-4000-8000-0000000000aa';
const orgContextMock = {
  resolveForFirebaseUid: jest.fn().mockResolvedValue({
    user: { id: mockUserId, subscription_tier: 'free' },
    userId: mockUserId,
    organization: { id: mockOrgId, name: 'Mon espace', is_personal: true },
    organizationId: mockOrgId,
    role: 'owner',
    effectiveTier: 'free',
  }),
  resolveForUser: jest.fn(),
  getOrCreatePersonalOrganization: jest
    .fn()
    .mockResolvedValue({ id: mockOrgId }),
  findMembership: jest.fn(),
};

// AdminGuard volontairement RÉEL (résolu via les providers) : ce spec vérifie
// le câblage complet du guard, la leçon DI UsersModule incluse.
describe('CvRetrainingController (e2e) — accès admin', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CvRetrainingController],
      providers: [
        { provide: CvRetrainingService, useValue: cvRetrainingServiceMock },
        { provide: PhotosService, useValue: photosServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: OrgContextService, useValue: orgContextMock },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext): boolean {
          const req = context.switchToHttp().getRequest<{
            firebaseUser?: { uid: string };
          }>();
          req.firebaseUser = { uid: 'firebase-uid-123' };
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

  it('GET /admin/cv-retraining/export returns 403 for a non-admin user', async () => {
    usersServiceMock.findByFirebaseUid.mockResolvedValueOnce({
      id: 'user-uuid',
      role: UserRole.USER,
    });

    await request(app.getHttpServer())
      .get('/admin/cv-retraining/export')
      .expect(403);

    expect(cvRetrainingServiceMock.buildExport).not.toHaveBeenCalled();
  });

  it('GET /admin/cv-retraining/photo returns 403 for a non-admin user', async () => {
    usersServiceMock.findByFirebaseUid.mockResolvedValueOnce({
      id: 'user-uuid',
      role: UserRole.USER,
    });

    await request(app.getHttpServer())
      .get('/admin/cv-retraining/photo')
      .query({ path: 'p/img.jpg' })
      .expect(403);
  });

  it('GET /admin/cv-retraining/export succeeds for an admin', async () => {
    usersServiceMock.findByFirebaseUid.mockResolvedValueOnce({
      id: 'admin-uuid',
      role: UserRole.ADMIN,
    });

    await request(app.getHttpServer())
      .get('/admin/cv-retraining/export')
      .query({ since: '2026-07-01T00:00:00.000Z', limit: 50 })
      .expect(200)
      .expect((res: request.Response) => {
        expect((res.body as { job_count: number }).job_count).toBe(0);
      });

    expect(cvRetrainingServiceMock.buildExport).toHaveBeenCalledWith(
      new Date('2026-07-01T00:00:00.000Z'),
      50,
    );
  });

  it('GET /admin/cv-retraining/photo returns 404 for an unknown storage_url', async () => {
    usersServiceMock.findByFirebaseUid.mockResolvedValueOnce({
      id: 'admin-uuid',
      role: UserRole.ADMIN,
    });

    await request(app.getHttpServer())
      .get('/admin/cv-retraining/photo')
      .query({ path: '../../etc/passwd' })
      .expect(404);

    // jamais de résolution de chemin sur le paramètre brut
    expect(photosServiceMock.getFileAbsolutePath).not.toHaveBeenCalled();
  });
});
