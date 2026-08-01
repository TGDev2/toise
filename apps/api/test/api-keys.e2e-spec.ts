import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ApiKeysController } from '../src/api-keys/api-keys.controller';
import { PartnerApiController } from '../src/api-keys/partner-api.controller';
import { ApiKeysService } from '../src/api-keys/api-keys.service';
import { ApiUsageService } from '../src/api-keys/api-usage.service';
import { ApiKeyGuard } from '../src/api-keys/guards/api-key.guard';
import { EstimationsService } from '../src/estimations/estimations.service';
import { OrgContextService } from '../src/organizations/org-context.service';
import { FeatureGatesService } from '../src/feature-gates/feature-gates.service';
import { FirebaseAuthGuard } from '../src/auth/guards/firebase-auth.guard';
import { SubscriptionTier } from '../src/users/entities/user.entity';
import { OrganizationRole } from '../src/organizations/entities/organization-membership.entity';

const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockFirebaseUid = 'firebase-uid-123';
const mockOrgId = '00000000-0000-4000-8000-0000000000aa';
const mockKeyId = '00000000-0000-4000-8000-00000000000c';
const validSecret = `chf_${'a'.repeat(64)}`;

const validEstimateBody = {
  rooms: [
    {
      name: 'Salon',
      length_cm: 500,
      width_cm: 400,
      height_cm: 250,
      openings: [{ width_cm: 90, height_cm: 210, count: 1 }],
      work_items: [{ work_type_code: 'wall_painting' }],
    },
  ],
};

const estimationsServiceMock = {
  estimatePublicMulti: jest.fn(),
  listWorkTypes: jest.fn(),
};

const apiKeysServiceMock = {
  list: jest.fn(),
  create: jest.fn(),
  rotate: jest.fn(),
  revoke: jest.fn(),
  findBySecret: jest.fn(),
  matchesRotatedHash: jest.fn(),
  touchLastUsed: jest.fn(),
};

const apiUsageServiceMock = { consume: jest.fn(), peek: jest.fn() };

const orgContextMock = {
  resolveForFirebaseUid: jest.fn(),
  resolveTierForOrganization: jest.fn(),
};

const featureGatesServiceMock = {
  isFeatureAllowed: jest.fn(),
  getGateConfig: jest.fn(),
};

const throttlerStorageMock = { increment: jest.fn() };

describe('API publique et clés (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    jest.clearAllMocks();

    estimationsServiceMock.estimatePublicMulti.mockResolvedValue({
      rooms_count: 1,
      total_items: 2,
      items: [],
      aggregated: [],
    });
    estimationsServiceMock.listWorkTypes.mockResolvedValue([
      {
        code: 'wall_painting',
        label_fr: 'Peinture murale',
        category: 'painting',
        surface_target: 'walls',
        contextual_questions: [],
        display_order: 1,
      },
    ]);

    apiKeysServiceMock.findBySecret.mockResolvedValue({
      id: mockKeyId,
      organization_id: mockOrgId,
      revoked_at: null,
      previous_key_hash: null,
      previous_key_expires_at: null,
    });
    apiKeysServiceMock.matchesRotatedHash.mockReturnValue(false);
    apiKeysServiceMock.list.mockResolvedValue([]);
    apiKeysServiceMock.create.mockResolvedValue({
      secret: validSecret,
      key: { id: mockKeyId, name: 'ERP', key_prefix: 'chf_aaaaaaaa' },
    });
    apiKeysServiceMock.rotate.mockResolvedValue({
      secret: validSecret,
      key: { id: mockKeyId, name: 'ERP', key_prefix: 'chf_bbbbbbbb' },
    });
    apiKeysServiceMock.revoke.mockResolvedValue(undefined);

    apiUsageServiceMock.consume.mockResolvedValue({
      period: '2026-08',
      count: 1,
      reset_at: new Date(Date.now() + 86_400_000),
    });
    apiUsageServiceMock.peek.mockResolvedValue({
      period: '2026-08',
      count: 12,
      reset_at: new Date(Date.now() + 86_400_000),
    });

    orgContextMock.resolveForFirebaseUid.mockResolvedValue({
      user: {
        id: mockUserId,
        subscription_tier: SubscriptionTier.CONTRACTOR_PREMIUM,
      },
      userId: mockUserId,
      organization: {
        id: mockOrgId,
        name: 'Peinture Dupont',
        is_personal: false,
      },
      organizationId: mockOrgId,
      role: OrganizationRole.OWNER,
      effectiveTier: SubscriptionTier.CONTRACTOR_PREMIUM,
    });
    orgContextMock.resolveTierForOrganization.mockResolvedValue(
      SubscriptionTier.CONTRACTOR_PREMIUM,
    );

    featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(true);
    featureGatesServiceMock.getGateConfig.mockResolvedValue({
      feature_key: 'public_api',
      min_tier: SubscriptionTier.CONTRACTOR_PREMIUM,
    });

    throttlerStorageMock.increment.mockResolvedValue({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeysController, PartnerApiController],
      providers: [
        // ApiKeyGuard est laissé RÉEL : c'est la pièce que ce ticket doit
        // prouver. Seules ses dépendances sont doublées.
        ApiKeyGuard,
        { provide: ApiKeysService, useValue: apiKeysServiceMock },
        { provide: ApiUsageService, useValue: apiUsageServiceMock },
        { provide: EstimationsService, useValue: estimationsServiceMock },
        { provide: OrgContextService, useValue: orgContextMock },
        { provide: FeatureGatesService, useValue: featureGatesServiceMock },
        { provide: ThrottlerStorage, useValue: throttlerStorageMock },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext): boolean {
          const req = context.switchToHttp().getRequest<{
            firebaseUser?: { uid: string; email?: string };
          }>();
          req.firebaseUser = {
            uid: mockFirebaseUid,
            email: 'test@example.com',
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
    if (app) await app.close();
  });

  // ---------------------------------------------------------------------------
  // Surface publique — authentification par clé
  // ---------------------------------------------------------------------------

  describe('POST /partner/estimate', () => {
    it('estime sans persistance avec une clé valide', async () => {
      await request(app.getHttpServer())
        .post('/partner/estimate')
        .set('Authorization', `Bearer ${validSecret}`)
        .send(validEstimateBody)
        .expect(200)
        .expect((res: request.Response) => {
          expect((res.body as { rooms_count: number }).rooms_count).toBe(1);
        });

      expect(estimationsServiceMock.estimatePublicMulti).toHaveBeenCalled();
      expect(apiUsageServiceMock.consume).toHaveBeenCalledWith(mockOrgId);
    });

    it('refuse sans en-tête Authorization', async () => {
      await request(app.getHttpServer())
        .post('/partner/estimate')
        .send(validEstimateBody)
        .expect(401)
        .expect((res: request.Response) => {
          expect((res.body as { error: string }).error).toBe(
            'INVALID_API_KEY_FORMAT',
          );
        });
      expect(estimationsServiceMock.estimatePublicMulti).not.toHaveBeenCalled();
    });

    it('refuse un jeton Firebase présenté à la place d’une clé', async () => {
      await request(app.getHttpServer())
        .post('/partner/estimate')
        .set('Authorization', 'Bearer eyJhbGciOiJSUzI1NiJ9.payload.signature')
        .send(validEstimateBody)
        .expect(401);
      expect(apiKeysServiceMock.findBySecret).not.toHaveBeenCalled();
    });

    it('refuse une clé révoquée', async () => {
      apiKeysServiceMock.findBySecret.mockResolvedValue({
        id: mockKeyId,
        organization_id: mockOrgId,
        revoked_at: new Date(),
        previous_key_hash: null,
        previous_key_expires_at: null,
      });

      await request(app.getHttpServer())
        .post('/partner/estimate')
        .set('Authorization', `Bearer ${validSecret}`)
        .send(validEstimateBody)
        .expect(401)
        .expect((res: request.Response) => {
          expect((res.body as { error: string }).error).toBe('API_KEY_REVOKED');
        });
    });

    it('refuse en 403 quand l’organisation a été rétrogradée', async () => {
      orgContextMock.resolveTierForOrganization.mockResolvedValue(
        SubscriptionTier.PRO,
      );
      featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(false);

      await request(app.getHttpServer())
        .post('/partner/estimate')
        .set('Authorization', `Bearer ${validSecret}`)
        .send(validEstimateBody)
        .expect(403)
        .expect((res: request.Response) => {
          expect((res.body as { error: string }).error).toBe('FEATURE_GATED');
          expect((res.body as { feature_key: string }).feature_key).toBe(
            'public_api',
          );
        });
      expect(apiUsageServiceMock.consume).not.toHaveBeenCalled();
    });

    it('refuse en 429 quand le quota mensuel est dépassé', async () => {
      apiUsageServiceMock.consume.mockResolvedValue({
        period: '2026-08',
        count: 10_001,
        reset_at: new Date(Date.now() + 86_400_000),
      });

      await request(app.getHttpServer())
        .post('/partner/estimate')
        .set('Authorization', `Bearer ${validSecret}`)
        .send(validEstimateBody)
        .expect(429)
        .expect((res: request.Response) => {
          expect((res.body as { error: string }).error).toBe('QUOTA_EXCEEDED');
          expect((res.body as { limit: number }).limit).toBe(10_000);
          expect(res.headers['retry-after']).toBeDefined();
        });
      expect(estimationsServiceMock.estimatePublicMulti).not.toHaveBeenCalled();
    });

    it('refuse en 429 sur dépassement de rafale, sans consommer de quota', async () => {
      throttlerStorageMock.increment.mockResolvedValue({
        totalHits: 61,
        timeToExpire: 30,
        isBlocked: true,
        timeToBlockExpire: 30,
      });

      await request(app.getHttpServer())
        .post('/partner/estimate')
        .set('Authorization', `Bearer ${validSecret}`)
        .send(validEstimateBody)
        .expect(429)
        .expect((res: request.Response) => {
          expect((res.body as { error: string }).error).toBe(
            'RATE_LIMIT_EXCEEDED',
          );
        });
      expect(apiUsageServiceMock.consume).not.toHaveBeenCalled();
    });

    it('rejette un corps hors bornes (anti-DoS CPU)', async () => {
      const tooManyRooms = {
        rooms: Array.from({ length: 21 }, () => validEstimateBody.rooms[0]),
      };
      await request(app.getHttpServer())
        .post('/partner/estimate')
        .set('Authorization', `Bearer ${validSecret}`)
        .send(tooManyRooms)
        .expect(400);
    });

    it('rejette une pièce sans ouvrage', async () => {
      await request(app.getHttpServer())
        .post('/partner/estimate')
        .set('Authorization', `Bearer ${validSecret}`)
        .send({
          rooms: [
            { length_cm: 500, width_cm: 400, height_cm: 250, work_items: [] },
          ],
        })
        .expect(400);
    });

    it('rejette une propriété inconnue', async () => {
      await request(app.getHttpServer())
        .post('/partner/estimate')
        .set('Authorization', `Bearer ${validSecret}`)
        .send({ ...validEstimateBody, budget_max: 5000 })
        .expect(400);
    });
  });

  describe('GET /partner/work-types', () => {
    it('rend les données de référence sans consommer de quota', async () => {
      await request(app.getHttpServer())
        .get('/partner/work-types')
        .set('Authorization', `Bearer ${validSecret}`)
        .expect(200)
        .expect((res: request.Response) => {
          expect((res.body as { code: string }[])[0].code).toBe(
            'wall_painting',
          );
        });

      // Lire le catalogue ne fait pas travailler le moteur : le facturer
      // reviendrait à faire payer la documentation.
      expect(apiUsageServiceMock.consume).not.toHaveBeenCalled();
    });
  });

  describe('GET /partner/usage', () => {
    it('rend la consommation sans la faire augmenter', async () => {
      await request(app.getHttpServer())
        .get('/partner/usage')
        .set('Authorization', `Bearer ${validSecret}`)
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body).toMatchObject({
            period: '2026-08',
            count: 12,
            limit: 10_000,
          });
        });

      // Sinon un client au quota ne pourrait plus consulter son quota.
      expect(apiUsageServiceMock.consume).not.toHaveBeenCalled();
      expect(apiUsageServiceMock.peek).toHaveBeenCalledWith(mockOrgId);
    });
  });

  // ---------------------------------------------------------------------------
  // Surface de gestion — authentification Firebase
  // ---------------------------------------------------------------------------

  describe('POST /api-keys', () => {
    it('rend le secret en clair une seule fois', async () => {
      await request(app.getHttpServer())
        .post('/api-keys')
        .send({ name: 'Intégration ERP' })
        .expect(201)
        .expect((res: request.Response) => {
          expect((res.body as { secret: string }).secret).toBe(validSecret);
        });
    });

    it('résout l’organisation côté serveur et ne la lit jamais du client', async () => {
      await request(app.getHttpServer())
        .post('/api-keys')
        .send({ name: 'ERP', organization_id: 'org-usurpée' })
        // `forbidNonWhitelisted` rejette la tentative d'injecter une organisation.
        .expect(400);
      expect(apiKeysServiceMock.create).not.toHaveBeenCalled();
    });

    it('refuse un nom vide', async () => {
      await request(app.getHttpServer())
        .post('/api-keys')
        .send({ name: '' })
        .expect(400);
    });
  });

  describe('GET /api-keys', () => {
    it('passe au service la portée résolue côté serveur', async () => {
      await request(app.getHttpServer()).get('/api-keys').expect(200);

      const [scope] = apiKeysServiceMock.list.mock.calls[0] as [
        { organizationId: string },
      ];
      expect(scope.organizationId).toBe(mockOrgId);
    });

    it('refuse en 403 si la gate public_api est éteinte', async () => {
      featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(false);

      await request(app.getHttpServer())
        .get('/api-keys')
        .expect(403)
        .expect((res: request.Response) => {
          expect((res.body as { error: string }).error).toBe('FEATURE_GATED');
        });
      expect(apiKeysServiceMock.list).not.toHaveBeenCalled();
    });
  });

  describe('POST /api-keys/:id/rotate', () => {
    it('rend un nouveau secret pour la même clé', async () => {
      await request(app.getHttpServer())
        .post(`/api-keys/${mockKeyId}/rotate`)
        .expect(200)
        .expect((res: request.Response) => {
          expect((res.body as { secret: string }).secret).toBe(validSecret);
        });

      const [scope, id] = apiKeysServiceMock.rotate.mock.calls[0] as [
        { organizationId: string },
        string,
      ];
      expect(scope.organizationId).toBe(mockOrgId);
      expect(id).toBe(mockKeyId);
    });

    it('rejette un identifiant non-UUID', async () => {
      await request(app.getHttpServer())
        .post('/api-keys/pas-un-uuid/rotate')
        .expect(400);
      expect(apiKeysServiceMock.rotate).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api-keys/:id', () => {
    it('révoque et répond 204', async () => {
      await request(app.getHttpServer())
        .delete(`/api-keys/${mockKeyId}`)
        .expect(204);

      const [scope] = apiKeysServiceMock.revoke.mock.calls[0] as [
        { organizationId: string },
      ];
      // Le contrôleur ne transmet jamais qu'un id : la portée vient du serveur,
      // c'est elle qui empêche d'agir sur la clé d'une autre organisation.
      expect(scope.organizationId).toBe(mockOrgId);
    });
  });
});
