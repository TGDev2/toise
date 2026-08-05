import {
  BadRequestException,
  CanActivate,
  ConflictException,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { InvoicesController } from '../src/invoices/invoices.controller';
import { InvoicesService } from '../src/invoices/invoices.service';
import { InvoicePdfService } from '../src/invoices/invoice-pdf.service';
import {
  InvoiceStatus,
  InvoiceType,
  OperationCategory,
} from '../src/invoices/entities/invoice.entity';
import { UsersService } from '../src/users/users.service';
import { OrgContextService } from '../src/organizations/org-context.service';
import { FeatureGatesService } from '../src/feature-gates/feature-gates.service';
import { FirebaseAuthGuard } from '../src/auth/guards/firebase-auth.guard';
import { SubscriptionTier } from '../src/users/entities/user.entity';

const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockQuoteId = '223e4567-e89b-12d3-a456-426614174000';
const mockInvoiceId = '323e4567-e89b-12d3-a456-426614174000';
const mockFirebaseUid = 'firebase-uid-123';

const mockInvoice = {
  id: mockInvoiceId,
  user_id: mockUserId,
  quote_id: mockQuoteId,
  invoice_number: 'F-2026-0001',
  invoice_type: InvoiceType.SOLDE,
  status: InvoiceStatus.ISSUED,
  source_quote_number: 'D-2026-001',
  issued_on: '2026-08-01',
  supply_date: '2026-08-01',
  due_on: '2026-08-31',
  currency: 'EUR',
  operation_category: OperationCategory.MIXTE,
  vat_on_debits: false,
  total_ht: '871.47',
  total_tva: '87.15',
  total_ttc: '958.62',
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
};

const invoicesServiceMock = {
  createFromQuote: jest.fn(),
  findAllForOrg: jest.fn(),
  findOneForOrg: jest.fn(),
  updateStatus: jest.fn(),
};

const invoicePdfServiceMock = {
  generatePdf: jest.fn(),
};

const usersServiceMock = {
  findByFirebaseUid: jest.fn(),
};

// PLAT-4 : les contrôleurs résolvent désormais la portée (organisation + auteur)
// au lieu de recharger l'utilisateur ; le guard de feature gates lit le palier
// effectif de l'organisation via ce même service.
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

describe('InvoicesController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    jest.clearAllMocks();
    invoicesServiceMock.createFromQuote.mockResolvedValue(mockInvoice);
    invoicesServiceMock.findAllForOrg.mockResolvedValue([mockInvoice]);
    invoicesServiceMock.findOneForOrg.mockResolvedValue(mockInvoice);
    invoicesServiceMock.updateStatus.mockResolvedValue({
      ...mockInvoice,
      status: InvoiceStatus.PAID,
    });
    invoicePdfServiceMock.generatePdf.mockResolvedValue(
      Buffer.from('%PDF-1.3 fake'),
    );
    usersServiceMock.findByFirebaseUid.mockResolvedValue({
      id: mockUserId,
      subscription_tier: SubscriptionTier.CONTRACTOR_ESSENTIEL,
    });
    featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(true);
    featureGatesServiceMock.getGateConfig.mockResolvedValue({
      feature_key: 'invoicing',
      min_tier: 'contractor_essentiel',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [
        { provide: InvoicesService, useValue: invoicesServiceMock },
        { provide: InvoicePdfService, useValue: invoicePdfServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
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

  describe('POST /invoices', () => {
    it('converts an accepted quote into an invoice', async () => {
      await request(app.getHttpServer())
        .post('/invoices')
        .send({ quote_id: mockQuoteId })
        .expect(201)
        .expect((res: request.Response) => {
          expect(res.body).toEqual(mockInvoice);
        });

      expect(invoicesServiceMock.createFromQuote).toHaveBeenCalledWith(
        mockOrgId,
        mockUserId,
        { quote_id: mockQuoteId },
      );
    });

    it('forwards the optional legal mentions', async () => {
      await request(app.getHttpServer())
        .post('/invoices')
        .send({
          quote_id: mockQuoteId,
          issued_on: '2026-08-01',
          supply_date: '2026-07-28',
          due_on: '2026-08-31',
          delivery_address: '12 rue du Chantier, 75011 Paris',
          operation_category: 'services',
          vat_on_debits: true,
          payment_terms: 'Comptant',
          notes: 'Merci',
        })
        .expect(201);

      expect(invoicesServiceMock.createFromQuote).toHaveBeenCalledWith(
        mockOrgId,
        mockUserId,
        expect.objectContaining({
          operation_category: 'services',
          vat_on_debits: true,
          delivery_address: '12 rue du Chantier, 75011 Paris',
        }),
      );
    });

    it('rejects a non-UUID quote id', async () => {
      await request(app.getHttpServer())
        .post('/invoices')
        .send({ quote_id: 'not-a-uuid' })
        .expect(400);

      expect(invoicesServiceMock.createFromQuote).not.toHaveBeenCalled();
    });

    it('rejects an unknown operation category', async () => {
      await request(app.getHttpServer())
        .post('/invoices')
        .send({ quote_id: mockQuoteId, operation_category: 'travaux' })
        .expect(400);
    });

    it('rejects unknown body properties', async () => {
      await request(app.getHttpServer())
        .post('/invoices')
        .send({ quote_id: mockQuoteId, total_ttc: 1 })
        .expect(400);
    });

    it('returns 400 when the quote is not accepted', async () => {
      invoicesServiceMock.createFromQuote.mockRejectedValue(
        new BadRequestException(
          'Seul un devis accepte peut etre transforme en facture',
        ),
      );

      await request(app.getHttpServer())
        .post('/invoices')
        .send({ quote_id: mockQuoteId })
        .expect(400);
    });

    it('returns a structured 400 when legal mentions are missing', async () => {
      invoicesServiceMock.createFromQuote.mockRejectedValue(
        new BadRequestException({
          message: 'Mentions legales manquantes',
          error: 'MISSING_LEGAL_MENTIONS',
          missing_fields: ['vat_number', 'insurance'],
        }),
      );

      await request(app.getHttpServer())
        .post('/invoices')
        .send({ quote_id: mockQuoteId })
        .expect(400)
        .expect((res: request.Response) => {
          const body = res.body as {
            error: string;
            missing_fields: string[];
          };
          expect(body.error).toBe('MISSING_LEGAL_MENTIONS');
          expect(body.missing_fields).toEqual(['vat_number', 'insurance']);
        });
    });

    it('returns 409 with the existing invoice when one already exists', async () => {
      invoicesServiceMock.createFromQuote.mockRejectedValue(
        new ConflictException({
          message: 'Une facture existe deja pour ce devis',
          error: 'INVOICE_ALREADY_EXISTS',
          invoice_id: mockInvoiceId,
          invoice_number: 'F-2026-0001',
        }),
      );

      await request(app.getHttpServer())
        .post('/invoices')
        .send({ quote_id: mockQuoteId })
        .expect(409)
        .expect((res: request.Response) => {
          const body = res.body as {
            error: string;
            invoice_id: string;
            invoice_number: string;
          };
          expect(body.error).toBe('INVOICE_ALREADY_EXISTS');
          expect(body.invoice_id).toBe(mockInvoiceId);
          expect(body.invoice_number).toBe('F-2026-0001');
        });
    });
  });

  describe('GET /invoices', () => {
    it('lists the invoices of the authenticated contractor', async () => {
      await request(app.getHttpServer())
        .get('/invoices')
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body).toEqual([mockInvoice]);
        });

      expect(invoicesServiceMock.findAllForOrg).toHaveBeenCalledWith(
        mockOrgId,
        { status: undefined, quote_id: undefined },
      );
    });

    it('filters by status', async () => {
      await request(app.getHttpServer())
        .get('/invoices?status=paid')
        .expect(200);

      expect(invoicesServiceMock.findAllForOrg).toHaveBeenCalledWith(
        mockOrgId,
        { status: 'paid', quote_id: undefined },
      );
    });

    it('filters by quote, so the quote page can tell whether it is invoiced', async () => {
      await request(app.getHttpServer())
        .get(`/invoices?quote_id=${mockQuoteId}`)
        .expect(200);

      expect(invoicesServiceMock.findAllForOrg).toHaveBeenCalledWith(
        mockOrgId,
        { status: undefined, quote_id: mockQuoteId },
      );
    });
  });

  describe('GET /invoices/:id', () => {
    it('returns an invoice', async () => {
      await request(app.getHttpServer())
        .get(`/invoices/${mockInvoiceId}`)
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body).toEqual(mockInvoice);
        });
    });

    it('rejects a non-UUID id', async () => {
      await request(app.getHttpServer()).get('/invoices/nope').expect(400);
    });
  });

  describe('GET /invoices/:id/export/pdf', () => {
    it('streams the PDF as an attachment', async () => {
      await request(app.getHttpServer())
        .get(`/invoices/${mockInvoiceId}/export/pdf`)
        .expect(200)
        .expect('Content-Type', 'application/pdf')
        .expect(
          'Content-Disposition',
          'attachment; filename="facture-F-2026-0001.pdf"',
        );

      expect(invoicePdfServiceMock.generatePdf).toHaveBeenCalledWith(
        mockInvoice,
      );
    });
  });

  describe('PATCH /invoices/:id/status', () => {
    it('marks an invoice paid', async () => {
      await request(app.getHttpServer())
        .patch(`/invoices/${mockInvoiceId}/status`)
        .send({ status: 'paid', paid_at: '2026-08-20' })
        .expect(200)
        .expect((res: request.Response) => {
          expect((res.body as { status: string }).status).toBe('paid');
        });

      expect(invoicesServiceMock.updateStatus).toHaveBeenCalledWith(
        mockInvoiceId,
        mockOrgId,
        { status: 'paid', paid_at: '2026-08-20' },
      );
    });

    it('rejects an unknown status', async () => {
      await request(app.getHttpServer())
        .patch(`/invoices/${mockInvoiceId}/status`)
        .send({ status: 'cancelled' })
        .expect(400);

      expect(invoicesServiceMock.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('immutability', () => {
    it('exposes no content update route', async () => {
      await request(app.getHttpServer())
        .patch(`/invoices/${mockInvoiceId}`)
        .send({ total_ttc: 1 })
        .expect(404);
    });

    it('exposes no delete route', async () => {
      await request(app.getHttpServer())
        .delete(`/invoices/${mockInvoiceId}`)
        .expect(404);
    });
  });

  describe('feature gate', () => {
    it('returns FEATURE_GATED when the invoicing gate refuses', async () => {
      featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(false);

      await request(app.getHttpServer())
        .post('/invoices')
        .send({ quote_id: mockQuoteId })
        .expect(403)
        .expect((res: request.Response) => {
          const body = res.body as {
            error: string;
            feature_key: string;
            required_tier: string;
          };
          expect(body.error).toBe('FEATURE_GATED');
          expect(body.feature_key).toBe('invoicing');
          expect(body.required_tier).toBe('contractor_essentiel');
        });

      expect(invoicesServiceMock.createFromQuote).not.toHaveBeenCalled();
    });

    // E5-2 : la gate porte sur l'émission d'une facture, pas sur la
    // consultation de celles qui existent. Un abonné déclassé — impayé non
    // régularisé, résiliation — garderait sinon une comptabilité qu'il ne peut
    // plus ni relire ni justifier, et le bandeau de relance qui lui promet le
    // contraire deviendrait un mensonge.
    it.each([
      ['la liste', `/invoices`],
      ['le détail', `/invoices/${mockInvoiceId}`],
      ['l’export PDF', `/invoices/${mockInvoiceId}/export/pdf`],
    ])('laisse passer %s malgré une gate qui refuse', async (_label, path) => {
      featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(false);

      await request(app.getHttpServer()).get(path).expect(200);
    });

    it('laisse marquer une facture payée malgré une gate qui refuse', async () => {
      featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(false);

      // La gater laisserait une facture encaissée marquée « impayée » pour
      // toujours : le même préjudice sous un autre nom.
      await request(app.getHttpServer())
        .patch(`/invoices/${mockInvoiceId}/status`)
        .send({ status: InvoiceStatus.PAID })
        .expect(200);
    });

    it('gates the conversion route too', async () => {
      featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(false);

      await request(app.getHttpServer())
        .post('/invoices')
        .send({ quote_id: mockQuoteId })
        .expect(403);

      expect(invoicesServiceMock.createFromQuote).not.toHaveBeenCalled();
    });
  });
});
