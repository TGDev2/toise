import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ShoppingListExportController } from '../src/shopping-lists/shopping-list-export.controller';
import { ShoppingListsService } from '../src/shopping-lists/shopping-lists.service';
import { ShoppingListExportService } from '../src/shopping-lists/shopping-list-export.service';
import { EstimationsController } from '../src/estimations/estimations.controller';
import { EstimationsService } from '../src/estimations/estimations.service';
import { ProjectsService } from '../src/projects/projects.service';
import { OrgContextService } from '../src/organizations/org-context.service';
import { FirebaseAuthGuard } from '../src/auth/guards/firebase-auth.guard';
import { SubscriptionTier } from '../src/users/entities/user.entity';

/**
 * Contrat HTTP de la surface ouverte à un compte invité (E2-1).
 *
 * L'invité va jusqu'à sa liste d'achat — c'est l'objet du lot — mais l'emporter
 * (PDF) ou la publier (lien de partage) demande un compte. Ces suites montent
 * les contrôleurs réels avec le **garde réel** `RegisteredAccountGuard` ; seul
 * `FirebaseAuthGuard` est surchargé, pour choisir le type de jeton présenté.
 */
const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockProjectId = '223e4567-e89b-12d3-a456-426614174000';
const mockOrgId = '00000000-0000-4000-8000-0000000000aa';

type TokenKind = 'guest' | 'registered' | 'converting';

const TOKENS: Record<TokenKind, Record<string, unknown>> = {
  guest: {
    uid: 'firebase-guest',
    firebase: { sign_in_provider: 'anonymous', identities: {} },
  },
  registered: {
    uid: 'firebase-user',
    email: 'user@example.com',
    firebase: { sign_in_provider: 'password', identities: {} },
  },
  // Jeton encore marqué `anonymous` juste après `linkWithCredential`, mais
  // porteur de l'e-mail du fournisseur lié : un converti, pas un invité.
  converting: {
    uid: 'firebase-guest',
    email: 'converti@example.com',
    firebase: { sign_in_provider: 'anonymous', identities: {} },
  },
};

let currentToken: TokenKind = 'registered';

const orgScope = {
  user: { id: mockUserId, subscription_tier: SubscriptionTier.FREE },
  userId: mockUserId,
  organization: { id: mockOrgId, name: 'Mon espace', is_personal: true },
  organizationId: mockOrgId,
  role: 'owner',
  effectiveTier: SubscriptionTier.FREE,
};

const orgContextMock = {
  resolveForFirebaseUid: jest.fn().mockResolvedValue(orgScope),
};

const shoppingListsServiceMock = {
  getOrGenerate: jest.fn().mockResolvedValue({
    shoppingList: {
      items_json: { material_items: [], complementary_items: [] },
    },
    latestEstimationId: null,
  }),
  generateShareToken: jest.fn().mockResolvedValue({
    share_token: 'tok-1',
    expires_at: '2026-11-02T00:00:00.000Z',
  }),
  revokeShareToken: jest.fn().mockResolvedValue(undefined),
};

const exportServiceMock = {
  generatePdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4')),
};

const projectsServiceMock = {
  findOneForOrg: jest.fn().mockResolvedValue({ name: 'Salon' }),
};

const estimationsServiceMock = {
  estimate: jest.fn().mockResolvedValue({
    id: 'est-1',
    project_id: mockProjectId,
    skill_level: 'intermediate',
    items_json: [],
    aggregated_json: [],
    total_items: 0,
    created_at: new Date('2026-08-04T00:00:00.000Z'),
  }),
};

const configServiceMock = {
  get: jest.fn().mockReturnValue('https://chiffreo.test'),
};

const firebaseAuthGuardStub = {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ firebaseUser?: Record<string, unknown> }>();
    req.firebaseUser = TOKENS[currentToken];
    return true;
  },
} satisfies CanActivate;

describe('Surface accessible à un compte invité (E2-1)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    jest.clearAllMocks();
    currentToken = 'registered';
    orgContextMock.resolveForFirebaseUid.mockResolvedValue(orgScope);
    exportServiceMock.generatePdf.mockResolvedValue(Buffer.from('%PDF-1.4'));
    shoppingListsServiceMock.getOrGenerate.mockResolvedValue({
      shoppingList: {
        items_json: { material_items: [], complementary_items: [] },
      },
      latestEstimationId: null,
    });
    shoppingListsServiceMock.generateShareToken.mockResolvedValue({
      share_token: 'tok-1',
      expires_at: '2026-11-02T00:00:00.000Z',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ShoppingListExportController, EstimationsController],
      providers: [
        { provide: ShoppingListsService, useValue: shoppingListsServiceMock },
        {
          provide: ShoppingListExportService,
          useValue: exportServiceMock,
        },
        { provide: ProjectsService, useValue: projectsServiceMock },
        { provide: EstimationsService, useValue: estimationsServiceMock },
        { provide: OrgContextService, useValue: orgContextMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue(firebaseAuthGuardStub)
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

  describe('export PDF', () => {
    it('refuse un invité avec ACCOUNT_REQUIRED', async () => {
      currentToken = 'guest';

      const res = await request(app.getHttpServer())
        .get(`/projects/${mockProjectId}/shopping-list/export/pdf`)
        .expect(403);

      expect((res.body as { error: string }).error).toBe('ACCOUNT_REQUIRED');
      // Le refus intervient avant tout travail : ni liste chargée, ni PDF rendu.
      expect(shoppingListsServiceMock.getOrGenerate).not.toHaveBeenCalled();
      expect(exportServiceMock.generatePdf).not.toHaveBeenCalled();
    });

    it('sert un compte inscrit', async () => {
      currentToken = 'registered';

      await request(app.getHttpServer())
        .get(`/projects/${mockProjectId}/shopping-list/export/pdf`)
        .expect(200)
        .expect('Content-Type', 'application/pdf');
    });

    it("sert un jeton anonyme périmé porteur d'un e-mail (conversion)", async () => {
      currentToken = 'converting';

      await request(app.getHttpServer())
        .get(`/projects/${mockProjectId}/shopping-list/export/pdf`)
        .expect(200);
    });
  });

  describe('lien de partage', () => {
    it('refuse la création à un invité', async () => {
      currentToken = 'guest';

      const res = await request(app.getHttpServer())
        .post(`/projects/${mockProjectId}/shopping-list/share`)
        .expect(403);

      expect((res.body as { error: string }).error).toBe('ACCOUNT_REQUIRED');
      expect(
        shoppingListsServiceMock.generateShareToken,
      ).not.toHaveBeenCalled();
    });

    it('refuse la révocation à un invité', async () => {
      currentToken = 'guest';

      await request(app.getHttpServer())
        .delete(`/projects/${mockProjectId}/shopping-list/share`)
        .expect(403);
    });

    it('sert un compte inscrit', async () => {
      currentToken = 'registered';

      const res = await request(app.getHttpServer())
        .post(`/projects/${mockProjectId}/shopping-list/share`)
        .expect(201);

      expect((res.body as { share_url: string }).share_url).toContain(
        '/shared/shopping-list/tok-1',
      );
    });
  });

  describe('estimation — ouverte, mais pas anonyme au regard du service', () => {
    it("reste accessible à l'invité : c'est l'objet du lot", async () => {
      currentToken = 'guest';

      await request(app.getHttpServer())
        .post(`/projects/${mockProjectId}/estimate`)
        .send({})
        .expect(201);
    });

    /**
     * Le plafond par compte vit dans le service ; encore faut-il qu'il sache à
     * qui il a affaire. Sans ce contrat, `GUEST_ESTIMATION_LIMIT` serait un test
     * unitaire qui ne protège rien en production.
     */
    it("transmet la qualité d'invité au service", async () => {
      currentToken = 'guest';
      await request(app.getHttpServer())
        .post(`/projects/${mockProjectId}/estimate`)
        .send({})
        .expect(201);

      expect(estimationsServiceMock.estimate).toHaveBeenLastCalledWith(
        mockProjectId,
        mockOrgId,
        mockUserId,
        undefined,
        true,
      );

      currentToken = 'registered';
      await request(app.getHttpServer())
        .post(`/projects/${mockProjectId}/estimate`)
        .send({})
        .expect(201);

      expect(estimationsServiceMock.estimate).toHaveBeenLastCalledWith(
        mockProjectId,
        mockOrgId,
        mockUserId,
        undefined,
        false,
      );
    });
  });
});
