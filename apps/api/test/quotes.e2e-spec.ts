import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { QuotesController } from '../src/quotes/quotes.controller';
import { QuotesService } from '../src/quotes/quotes.service';
import { QuotePdfService } from '../src/quotes/quote-pdf.service';
import { QuoteStatus } from '../src/quotes/entities/quote.entity';
import { OrgContextService } from '../src/organizations/org-context.service';
import { FeatureGatesService } from '../src/feature-gates/feature-gates.service';
import { CompanyProfilesService } from '../src/company-profiles/company-profiles.service';
import { ClientsService } from '../src/clients/clients.service';
import { FirebaseAuthGuard } from '../src/auth/guards/firebase-auth.guard';
import { SubscriptionTier } from '../src/users/entities/user.entity';

const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockProjectId = '223e4567-e89b-12d3-a456-426614174000';
const mockEstimationId = '323e4567-e89b-12d3-a456-426614174000';
const mockQuoteId = '423e4567-e89b-12d3-a456-426614174000';
const mockFirebaseUid = 'firebase-uid-123';

const mockQuote = {
  id: mockQuoteId,
  project_id: mockProjectId,
  estimation_id: mockEstimationId,
  quote_number: 'D-2026-001',
  status: QuoteStatus.DRAFT,
  labor_items_json: [],
  material_margin_percent: '10.00',
  discount_percent: '0.00',
  items_json: [],
  subtotal_materials_ht: '0.00',
  subtotal_labor_ht: '0.00',
  total_ht: '0.00',
  tva_rate: '20.00',
  total_ttc: '0.00',
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
};

const mockLaborProposal = [
  {
    work_item_id: 'wi-1',
    work_type_code: 'wall_painting',
    label: 'Peinture murale',
    room_name: 'Salon',
    kind: 'hourly',
    surface_m2: 25,
    quantity: 5,
    unit_price_ht: 45,
    line_total_ht: 225,
  },
];

const quotesServiceMock = {
  create: jest.fn(),
  findAllForOrg: jest.fn(),
  findOneForOrg: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
  remove: jest.fn(),
  proposeLaborLines: jest.fn(),
};

const quotePdfServiceMock = { generatePdf: jest.fn() };
const companyProfilesServiceMock = { findByOrganizationId: jest.fn() };
const clientsServiceMock = { findOneForOrg: jest.fn() };

const mockOrgId = '00000000-0000-4000-8000-0000000000aa';
const orgContextMock = {
  resolveForFirebaseUid: jest.fn().mockResolvedValue({
    user: { id: mockUserId, subscription_tier: SubscriptionTier.FREE },
    userId: mockUserId,
    organization: { id: mockOrgId, name: 'Mon espace', is_personal: true },
    organizationId: mockOrgId,
    role: 'owner',
    effectiveTier: SubscriptionTier.FREE,
  }),
  resolveForUser: jest.fn(),
  getOrCreatePersonalOrganization: jest
    .fn()
    .mockResolvedValue({ id: mockOrgId }),
  findMembership: jest.fn(),
};

const featureGatesServiceMock = {
  isFeatureAllowed: jest.fn(),
  getGateConfig: jest.fn(),
};

describe('QuotesController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    jest.clearAllMocks();
    quotesServiceMock.create.mockResolvedValue(mockQuote);
    quotesServiceMock.findAllForOrg.mockResolvedValue([mockQuote]);
    quotesServiceMock.findOneForOrg.mockResolvedValue(mockQuote);
    quotesServiceMock.update.mockResolvedValue(mockQuote);
    quotesServiceMock.proposeLaborLines.mockResolvedValue(mockLaborProposal);
    featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(true);
    featureGatesServiceMock.getGateConfig.mockResolvedValue({
      feature_key: 'export_devis',
      min_tier: 'contractor_essentiel',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [QuotesController],
      providers: [
        { provide: QuotesService, useValue: quotesServiceMock },
        { provide: QuotePdfService, useValue: quotePdfServiceMock },
        { provide: OrgContextService, useValue: orgContextMock },
        { provide: FeatureGatesService, useValue: featureGatesServiceMock },
        {
          provide: CompanyProfilesService,
          useValue: companyProfilesServiceMock,
        },
        { provide: ClientsService, useValue: clientsServiceMock },
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
    if (app) {
      await app.close();
    }
  });

  describe('GET /quotes/labor-proposal', () => {
    it("n'est pas masquée par la route GET /quotes/:id", async () => {
      await request(app.getHttpServer())
        .get(
          `/quotes/labor-proposal?project_id=${mockProjectId}&estimation_id=${mockEstimationId}`,
        )
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body).toEqual(mockLaborProposal);
        });

      expect(quotesServiceMock.proposeLaborLines).toHaveBeenCalledWith(
        mockOrgId,
        mockProjectId,
        mockEstimationId,
      );
    });

    it("rejette un project_id qui n'est pas un UUID", async () => {
      await request(app.getHttpServer())
        .get(
          `/quotes/labor-proposal?project_id=nope&estimation_id=${mockEstimationId}`,
        )
        .expect(400);

      expect(quotesServiceMock.proposeLaborLines).not.toHaveBeenCalled();
    });
  });

  describe('POST /quotes — validation du tableau labor_items', () => {
    function post(body: Record<string, unknown>) {
      return request(app.getHttpServer())
        .post('/quotes')
        .send({
          project_id: mockProjectId,
          estimation_id: mockEstimationId,
          material_margin_percent: 10,
          ...body,
        });
    }

    function lastCreateDto(): { labor_items?: { label: string }[] } {
      const calls = quotesServiceMock.create.mock.calls as unknown[][];
      return calls[calls.length - 1][2] as {
        labor_items?: { label: string }[];
      };
    }

    it('accepte un devis sans labor_items', async () => {
      await post({}).expect(201);
      expect(quotesServiceMock.create).toHaveBeenCalledTimes(1);
      expect(lastCreateDto().labor_items).toBeUndefined();
    });

    it('accepte deux lignes de MO bien formees', async () => {
      await post({
        labor_items: [
          {
            label: 'Peinture murale',
            kind: 'hourly',
            quantity: 5,
            unit_price_ht: 45,
          },
          {
            label: 'Peinture plafond',
            kind: 'hourly',
            quantity: 3,
            unit_price_ht: 45,
          },
        ],
      }).expect(201);

      const labels = (lastCreateDto().labor_items ?? []).map((l) => l.label);
      expect(labels).toEqual(['Peinture murale', 'Peinture plafond']);
    });

    it('rejette un kind inconnu', async () => {
      await post({
        labor_items: [
          { label: 'x', kind: 'daily', quantity: 1, unit_price_ht: 1 },
        ],
      }).expect(400);
      expect(quotesServiceMock.create).not.toHaveBeenCalled();
    });

    it('rejette une quantite negative', async () => {
      await post({
        labor_items: [
          { label: 'x', kind: 'hourly', quantity: -1, unit_price_ht: 1 },
        ],
      }).expect(400);
    });

    it('rejette une ligne sans unit_price_ht', async () => {
      await post({
        labor_items: [{ label: 'x', kind: 'hourly', quantity: 1 }],
      }).expect(400);
    });

    it("rejette une propriete non declaree a l'interieur d'une ligne", async () => {
      await post({
        labor_items: [
          {
            label: 'x',
            kind: 'hourly',
            quantity: 1,
            unit_price_ht: 1,
            invented_field: true,
          },
        ],
      }).expect(400);
    });

    it('accepte line_total_ht envoye par le client (ignore, jamais rejete)', async () => {
      await post({
        labor_items: [
          {
            label: 'x',
            kind: 'hourly',
            quantity: 1,
            unit_price_ht: 1,
            line_total_ht: 999,
          },
        ],
      }).expect(201);
    });

    it('rejette plus de 50 lignes', async () => {
      const labor_items = Array.from({ length: 51 }, (_, i) => ({
        label: `Ligne ${i}`,
        kind: 'hourly',
        quantity: 1,
        unit_price_ht: 1,
      }));
      await post({ labor_items }).expect(400);
    });
  });

  describe('PATCH /quotes/:id', () => {
    it('transmet labor_items, y compris un tableau vide', async () => {
      await request(app.getHttpServer())
        .patch(`/quotes/${mockQuoteId}`)
        .send({ labor_items: [] })
        .expect(200);

      expect(quotesServiceMock.update).toHaveBeenCalledWith(
        mockQuoteId,
        mockOrgId,
        expect.objectContaining({ labor_items: [] }),
      );
    });
  });
});
