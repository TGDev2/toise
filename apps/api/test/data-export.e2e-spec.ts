import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DataExportController } from '../src/data-export/data-export.controller';
import { DataExportService } from '../src/data-export/data-export.service';
import { DataExportStatus } from '../src/data-export/entities/data-export-request.entity';
import { FirebaseAuthGuard } from '../src/auth/guards/firebase-auth.guard';
import { UsersService } from '../src/users/users.service';
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
  created_at: new Date('2026-03-26T00:00:00.000Z'),
  updated_at: new Date('2026-03-26T00:00:00.000Z'),
};

const usersServiceMock = { findByFirebaseUid: jest.fn() };
const dataExportServiceMock = {
  requestExport: jest.fn(),
  getForUser: jest.fn(),
  getAbsolutePath: jest.fn(),
};

describe('DataExportController (e2e)', () => {
  let app: INestApplication<App>;
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'toise-export-e2e-'));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    usersServiceMock.findByFirebaseUid.mockResolvedValue(mockUser);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DataExportController],
      providers: [
        { provide: UsersService, useValue: usersServiceMock },
        { provide: DataExportService, useValue: dataExportServiceMock },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext): boolean {
          const req = context.switchToHttp().getRequest<{
            firebaseUser?: { uid: string; email?: string };
          }>();
          req.firebaseUser = {
            uid: mockUser.firebase_uid,
            email: mockUser.email ?? undefined,
          };
          return true;
        },
      } satisfies CanActivate)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it("crée une demande d'export et répond 202", async () => {
    dataExportServiceMock.requestExport.mockResolvedValue({
      id: 'req-1',
      status: DataExportStatus.PENDING,
      requested_at: new Date('2026-08-05T10:00:00.000Z'),
      completed_at: null,
      expires_at: null,
      file_size_bytes: null,
      error_message: null,
    });

    await request(app.getHttpServer())
      .post('/auth/me/export')
      .expect(202)
      .expect({
        id: 'req-1',
        status: DataExportStatus.PENDING,
        requested_at: '2026-08-05T10:00:00.000Z',
        completed_at: null,
        expires_at: null,
        file_size_bytes: null,
        error_message: null,
      });

    expect(dataExportServiceMock.requestExport).toHaveBeenCalledWith(
      mockUser.id,
    );
  });

  it("renvoie le statut d'une demande du compte appelant", async () => {
    dataExportServiceMock.getForUser.mockResolvedValue({
      id: 'req-1',
      status: DataExportStatus.READY,
      requested_at: new Date('2026-08-05T10:00:00.000Z'),
      completed_at: new Date('2026-08-05T10:01:00.000Z'),
      expires_at: new Date('2026-08-07T10:01:00.000Z'),
      file_size_bytes: '4096',
      error_message: null,
    });

    const res = await request(app.getHttpServer())
      .get('/auth/me/export/req-1')
      .expect(200);
    const body = res.body as { status: DataExportStatus };

    expect(body.status).toBe(DataExportStatus.READY);
    expect(dataExportServiceMock.getForUser).toHaveBeenCalledWith(
      mockUser.id,
      'req-1',
    );
  });

  it("renvoie 404 sur une demande d'un autre compte, sans révéler son existence", async () => {
    dataExportServiceMock.getForUser.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/auth/me/export/not-mine')
      .expect(404);
  });

  it('exige un compte authentifié pour créer une demande', async () => {
    // Guard réel (pas de override) pour ce test précis, en remontant un module dédié.
    const unauthModule: TestingModule = await Test.createTestingModule({
      controllers: [DataExportController],
      providers: [
        { provide: UsersService, useValue: usersServiceMock },
        { provide: DataExportService, useValue: dataExportServiceMock },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate(): boolean {
          return false;
        },
      } satisfies CanActivate)
      .compile();
    const unauthApp: INestApplication<App> =
      unauthModule.createNestApplication();
    await unauthApp.init();

    await request(unauthApp.getHttpServer())
      .post('/auth/me/export')
      .expect(403);

    await unauthApp.close();
  });

  describe('téléchargement', () => {
    it("streame l'archive quand elle est prête", async () => {
      const filePath = join(tmpDir, 'export.zip');
      writeFileSync(filePath, 'contenu-zip-test');
      dataExportServiceMock.getForUser.mockResolvedValue({
        id: 'req-1',
        status: DataExportStatus.READY,
        file_path: 'exports/user/req-1.zip',
        expires_at: new Date(Date.now() + 3_600_000),
      });
      dataExportServiceMock.getAbsolutePath.mockReturnValue(filePath);

      const res = await request(app.getHttpServer())
        .get('/auth/me/export/req-1/download')
        .expect(200);

      expect(res.headers['content-type']).toBe('application/zip');
      expect(res.text).toBe('contenu-zip-test');
    });

    it("refuse le téléchargement d'une archive pas encore prête", async () => {
      dataExportServiceMock.getForUser.mockResolvedValue({
        id: 'req-1',
        status: DataExportStatus.PROCESSING,
        file_path: null,
        expires_at: null,
      });

      await request(app.getHttpServer())
        .get('/auth/me/export/req-1/download')
        .expect(404);
    });

    it("refuse le téléchargement d'une archive expirée", async () => {
      dataExportServiceMock.getForUser.mockResolvedValue({
        id: 'req-1',
        status: DataExportStatus.READY,
        file_path: 'exports/user/req-1.zip',
        expires_at: new Date(Date.now() - 1000),
      });

      await request(app.getHttpServer())
        .get('/auth/me/export/req-1/download')
        .expect(404);
    });
  });
});
