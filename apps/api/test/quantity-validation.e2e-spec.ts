import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { QuantityValidationsController } from '../src/quantity-validation/quantity-validations.controller';
import { QuantityValidationsService } from '../src/quantity-validation/quantity-validations.service';
import { OrgContextService } from '../src/organizations/org-context.service';
import { FeatureGatesService } from '../src/feature-gates/feature-gates.service';
import { FirebaseAuthGuard } from '../src/auth/guards/firebase-auth.guard';
import { SubscriptionTier } from '../src/users/entities/user.entity';

const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockProjectId = '223e4567-e89b-12d3-a456-426614174000';
const mockOrgId = '00000000-0000-4000-8000-0000000000aa';
const mockFirebaseUid = 'firebase-uid-123';

const FINGERPRINT = 'a'.repeat(64);

const mockState = {
  fingerprint: FINGERPRINT,
  lines: [
    {
      material_id: 'mat-paint',
      material_name: 'Peinture acrylique mate',
      work_type_code: 'wall_painting',
      work_type_label: 'Peinture murale',
      packaging_label: 'Pot 10 L',
      units_needed: 2,
    },
  ],
  validated_at: null,
  validated_by: null,
};

const serviceMock = {
  getState: jest.fn(),
  validate: jest.fn(),
  assertValidated: jest.fn(),
};

const orgContextMock = {
  resolveForFirebaseUid: jest.fn().mockResolvedValue({
    user: { id: mockUserId, email: 'artisan@chiffreo.test' },
    userId: mockUserId,
    organization: { id: mockOrgId, name: 'Mon espace', is_personal: true },
    organizationId: mockOrgId,
    role: 'owner',
    effectiveTier: SubscriptionTier.CONTRACTOR_ESSENTIEL,
  }),
};

const featureGatesServiceMock = {
  isFeatureAllowed: jest.fn(),
  getGateConfig: jest.fn(),
};

describe('QuantityValidationsController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    jest.clearAllMocks();
    serviceMock.getState.mockResolvedValue(mockState);
    serviceMock.validate.mockResolvedValue({
      ...mockState,
      validated_at: '2026-08-08T12:00:00.000Z',
      validated_by: 'artisan@chiffreo.test',
    });
    featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(true);
    featureGatesServiceMock.getGateConfig.mockResolvedValue({
      feature_key: 'export_devis',
      min_tier: 'contractor_essentiel',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [QuantityValidationsController],
      providers: [
        { provide: QuantityValidationsService, useValue: serviceMock },
        { provide: OrgContextService, useValue: orgContextMock },
        { provide: FeatureGatesService, useValue: featureGatesServiceMock },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext): boolean {
          const req = context.switchToHttp().getRequest<{
            firebaseUser?: { uid: string; email?: string };
          }>();
          req.firebaseUser = { uid: mockFirebaseUid };
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

  it('GET rend les quantités à valider et leur empreinte', async () => {
    const res = await request(app.getHttpServer())
      .get(`/projects/${mockProjectId}/quantity-validation`)
      .expect(200);

    expect(res.body).toMatchObject({
      fingerprint: FINGERPRINT,
      validated_at: null,
    });
    expect(serviceMock.getState).toHaveBeenCalledWith(
      mockProjectId,
      mockOrgId,
      mockUserId,
    );
  });

  it("POST enregistre l'acte et transmet la portée résolue", async () => {
    const res = await request(app.getHttpServer())
      .post(`/projects/${mockProjectId}/quantity-validation`)
      .send({ fingerprint: FINGERPRINT })
      .expect(201);

    const body = res.body as { validated_at: string };
    expect(body.validated_at).toBe('2026-08-08T12:00:00.000Z');
    expect(serviceMock.validate).toHaveBeenCalledWith(
      mockProjectId,
      expect.objectContaining({ organizationId: mockOrgId }),
      { fingerprint: FINGERPRINT },
    );
  });

  /**
   * L'empreinte est un `sha256` hexadécimal, jamais une chaîne libre : sans ce
   * format, `findOne` chercherait sur une valeur arbitraire et le refus
   * ressemblerait à « pas encore validé » au lieu d'une requête malformée.
   */
  it("POST refuse une empreinte qui n'est pas un sha256 hexadécimal", async () => {
    await request(app.getHttpServer())
      .post(`/projects/${mockProjectId}/quantity-validation`)
      .send({ fingerprint: 'pas-une-empreinte' })
      .expect(400);

    expect(serviceMock.validate).not.toHaveBeenCalled();
  });

  it('POST refuse un corps sans empreinte', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${mockProjectId}/quantity-validation`)
      .send({})
      .expect(400);
  });

  it("refuse un identifiant de projet qui n'est pas un UUID", async () => {
    await request(app.getHttpServer())
      .get('/projects/not-a-uuid/quantity-validation')
      .expect(400);
  });

  /**
   * La gate porte la même règle que le devis : valider des quantités n'a de
   * sens que pour qui peut en émettre un.
   */
  it('est fermée aux paliers qui ne peuvent pas émettre de devis', async () => {
    featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(false);

    await request(app.getHttpServer())
      .post(`/projects/${mockProjectId}/quantity-validation`)
      .send({ fingerprint: FINGERPRINT })
      .expect(403);

    expect(serviceMock.validate).not.toHaveBeenCalled();
  });
});
