import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InvoicesService } from './invoices.service';
import {
  Invoice,
  InvoiceStatus,
  InvoiceType,
  OperationCategory,
} from './entities/invoice.entity';
import {
  QuoteStatus,
  type Quote,
  type QuoteLaborLine,
} from '../quotes/entities/quote.entity';
import { QuotesService } from '../quotes/quotes.service';
import { CompanyProfilesService } from '../company-profiles/company-profiles.service';
import { ClientsService } from '../clients/clients.service';
import type { CompanyProfile } from '../company-profiles/entities/company-profile.entity';
import type { Client } from '../clients/entities/client.entity';

const USER_ID = 'user-1';

// `pg` renvoie les colonnes numeric sous forme de chaînes : les fixtures le
// reproduisent, sinon les tests valident un comportement que la prod n'a pas.
// `labor_items_json` est du jsonb : ses nombres reviennent en `number`, jamais
// en chaîne — asymétrie assumée avec les autres colonnes de cette entité.
function makeLaborLine(
  overrides: Partial<QuoteLaborLine> = {},
): QuoteLaborLine {
  return {
    work_item_id: null,
    work_type_code: null,
    label: "Main d'oeuvre",
    room_name: null,
    kind: 'hourly',
    surface_m2: null,
    quantity: 16,
    unit_price_ht: 45,
    line_total_ht: 720,
    ...overrides,
  };
}

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'quote-1',
    user_id: USER_ID,
    project_id: 'project-1',
    client_id: 'client-1',
    estimation_id: 'estimation-1',
    quote_number: 'D-2026-001',
    status: QuoteStatus.ACCEPTED,
    labor_items_json: [makeLaborLine()],
    material_margin_percent: '10.00' as unknown as number,
    discount_percent: '0.00' as unknown as number,
    payment_terms: '30 % a la commande, solde a la livraison',
    validity_days: 30,
    notes: null,
    items_json: [
      {
        material_name: 'Peinture acrylique mate 10 L',
        material_category: 'peinture',
        work_type_label: 'Peinture murs',
        packaging_label: 'Pot de 10 L',
        units_needed: 3,
        base_unit_price: 45.9,
        margin_percent: 10,
        unit_price_with_margin: 50.49,
        line_total_ht: 151.47,
      },
    ],
    subtotal_materials_ht: '151.47' as unknown as number,
    subtotal_labor_ht: '720.00' as unknown as number,
    total_ht: '871.47' as unknown as number,
    tva_rate: '10.00' as unknown as number,
    total_ttc: '958.62' as unknown as number,
    sent_at: new Date('2026-07-01T08:00:00.000Z'),
    accepted_at: new Date('2026-07-05T08:00:00.000Z'),
    refused_at: null,
    reminder_7d_sent_at: null,
    reminder_14d_sent_at: null,
    created_at: new Date('2026-07-01T08:00:00.000Z'),
    updated_at: new Date('2026-07-05T08:00:00.000Z'),
    ...overrides,
  } as Quote;
}

function makeProfile(overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    id: 'profile-1',
    user_id: USER_ID,
    raison_sociale: 'Dupont Renovation SARL',
    siret: '12345678901234',
    address_line1: '1 rue de Paris',
    address_line2: null,
    postal_code: '75001',
    city: 'Paris',
    country: 'FR',
    phone: '+33612345678',
    specialties: [],
    legal_form: 'SARL',
    capital_social: '10000.00' as unknown as number,
    vat_number: 'FR12345678901',
    vat_exempt: false,
    rcs_city: 'Paris',
    rm_department: null,
    insurance_name: 'AXA',
    insurance_policy: 'POL-123',
    insurance_coverage: 'France metropolitaine',
    iban: 'FR7630006000011234567890189',
    bic: 'AGRIFRPP',
    email: 'contact@dupont.fr',
    late_penalty_rate: '12.00' as unknown as number,
    default_payment_terms_days: 30,
    ...overrides,
  } as CompanyProfile;
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    user_id: USER_ID,
    name: 'Marie Martin',
    email: 'marie@example.com',
    phone: null,
    address_line1: '5 avenue des Champs',
    address_line2: null,
    postal_code: '75008',
    city: 'Paris',
    is_company: false,
    siret: null,
    vat_number: null,
    country: 'FR',
    ...overrides,
  } as Client;
}

describe('InvoicesService', () => {
  let service: InvoicesService;
  let managerMock: {
    query: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  const repoMock = { findOne: jest.fn(), find: jest.fn(), save: jest.fn() };
  const quotesServiceMock = { findOneForUser: jest.fn() };
  const companyProfilesServiceMock = { findByUserId: jest.fn() };
  const clientsServiceMock = { findOneForUser: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    managerMock = {
      query: jest.fn().mockResolvedValue([{ last_number: 1 }]),
      // Le vrai `manager.create` fusionne simplement les valeurs sur l'entité.
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    };

    const dataSourceMock = {
      transaction: jest.fn((cb: (m: typeof managerMock) => unknown) =>
        cb(managerMock),
      ),
    };

    repoMock.findOne.mockResolvedValue(null);
    quotesServiceMock.findOneForUser.mockResolvedValue(makeQuote());
    companyProfilesServiceMock.findByUserId.mockResolvedValue(makeProfile());
    clientsServiceMock.findOneForUser.mockResolvedValue(makeClient());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: getRepositoryToken(Invoice), useValue: repoMock },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: QuotesService, useValue: quotesServiceMock },
        {
          provide: CompanyProfilesService,
          useValue: companyProfilesServiceMock,
        },
        { provide: ClientsService, useValue: clientsServiceMock },
      ],
    }).compile();

    service = module.get(InvoicesService);
  });

  async function create(): Promise<Invoice> {
    return service.createFromQuote(USER_ID, {
      quote_id: 'quote-1',
      issued_on: '2026-08-01',
    });
  }

  describe('createFromQuote', () => {
    it('numbers the invoice from the allocated sequence value', async () => {
      const invoice = await create();
      expect(invoice.invoice_number).toBe('F-2026-0001');
    });

    it('zero-pads the sequence to four digits', async () => {
      managerMock.query.mockResolvedValue([{ last_number: 42 }]);
      const invoice = await create();
      expect(invoice.invoice_number).toBe('F-2026-0042');
    });

    it('allocates the number through the transaction manager, not the pool', async () => {
      await create();

      expect(managerMock.query).toHaveBeenCalledTimes(1);
      const [sql, params] = managerMock.query.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(sql).toContain('INSERT INTO "invoice_sequences"');
      expect(sql).toContain('ON CONFLICT ("user_id", "year")');
      expect(sql).toContain(
        '"last_number" = "invoice_sequences"."last_number" + 1',
      );
      expect(sql).toContain('RETURNING "last_number"');
      expect(params).toEqual([USER_ID, 2026]);
    });

    it('derives the sequence year from the issue date', async () => {
      await service.createFromQuote(USER_ID, {
        quote_id: 'quote-1',
        issued_on: '2027-01-02',
      });
      const [, params] = managerMock.query.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual([USER_ID, 2027]);
    });

    it('rejects a quote that is not accepted', async () => {
      quotesServiceMock.findOneForUser.mockResolvedValue(
        makeQuote({ status: QuoteStatus.SENT }),
      );
      await expect(create()).rejects.toBeInstanceOf(BadRequestException);
      expect(managerMock.query).not.toHaveBeenCalled();
    });

    it('propagates a not-found quote', async () => {
      quotesServiceMock.findOneForUser.mockRejectedValue(
        new NotFoundException('Devis non trouve'),
      );
      await expect(create()).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses a second solde invoice for the same quote', async () => {
      repoMock.findOne.mockResolvedValue({
        id: 'invoice-9',
        invoice_number: 'F-2026-0007',
      });

      await expect(create()).rejects.toMatchObject({
        response: {
          error: 'INVOICE_ALREADY_EXISTS',
          invoice_id: 'invoice-9',
          invoice_number: 'F-2026-0007',
        },
      });
      await expect(create()).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses to issue when legal mentions are missing', async () => {
      companyProfilesServiceMock.findByUserId.mockResolvedValue(
        makeProfile({ vat_number: null, insurance_name: null }),
      );

      await expect(create()).rejects.toMatchObject({
        response: {
          error: 'MISSING_LEGAL_MENTIONS',
          missing_fields: ['vat_number', 'insurance'],
        },
      });
      expect(managerMock.query).not.toHaveBeenCalled();
    });

    it('refuses to issue without a company profile', async () => {
      companyProfilesServiceMock.findByUserId.mockResolvedValue(null);
      await expect(create()).rejects.toMatchObject({
        response: { error: 'MISSING_LEGAL_MENTIONS' },
      });
    });

    it('builds lines that sum exactly to the quote total HT', async () => {
      const invoice = await create();
      const sum = invoice.items_json.reduce((s, i) => s + i.line_total_ht, 0);

      expect(Math.round(sum * 100) / 100).toBe(871.47);
      expect(Number(invoice.total_ht)).toBe(871.47);
    });

    it('materialises the quote discount as a negative amount line', async () => {
      // Devis remisé : 151,47 + 720,00 = 871,47 brut, remisé 5 % => 827,90.
      quotesServiceMock.findOneForUser.mockResolvedValue(
        makeQuote({
          discount_percent: '5.00' as unknown as number,
          total_ht: '827.90' as unknown as number,
          total_ttc: '910.69' as unknown as number,
        }),
      );

      const invoice = await create();
      const discountLine = invoice.items_json.find(
        (i) => i.kind === 'discount',
      );

      expect(discountLine).toBeDefined();
      expect(discountLine?.line_total_ht).toBe(-43.57);

      const sum = invoice.items_json.reduce((s, i) => s + i.line_total_ht, 0);
      expect(Math.round(sum * 100) / 100).toBe(827.9);
      expect(Number(invoice.total_ht)).toBe(827.9);
    });

    it('turns a retro-fitted single labour line into a billable line (retro-compat)', async () => {
      const invoice = await create();
      const labor = invoice.items_json.find((i) => i.kind === 'labor');

      expect(labor).toMatchObject({
        label: "Main d'oeuvre",
        quantity: 16,
        unit: 'h',
        unit_price_ht: 45,
        line_total_ht: 720,
      });
    });

    it('transforme chaque ligne de MO du devis en sa propre ligne de facture', async () => {
      quotesServiceMock.findOneForUser.mockResolvedValue(
        makeQuote({
          labor_items_json: [
            makeLaborLine({
              label: 'Peinture murale',
              room_name: 'Salon',
              quantity: 5,
              unit_price_ht: 45,
              line_total_ht: 225,
            }),
            makeLaborLine({
              label: 'Peinture plafond',
              room_name: 'Salon',
              quantity: 3,
              unit_price_ht: 45,
              line_total_ht: 135,
            }),
          ],
          subtotal_labor_ht: '360.00' as unknown as number,
          total_ht: '511.47' as unknown as number,
          total_ttc: '562.62' as unknown as number,
        }),
      );

      const invoice = await create();
      const laborLines = invoice.items_json.filter((i) => i.kind === 'labor');

      expect(laborLines).toHaveLength(2);
      expect(laborLines[0]).toMatchObject({
        label: 'Peinture murale — Salon',
        quantity: 5,
        line_total_ht: 225,
      });
      expect(laborLines[1]).toMatchObject({
        label: 'Peinture plafond — Salon',
        quantity: 3,
        line_total_ht: 135,
      });
    });

    it('ne pousse aucune ligne "Remise (0 %)" fantome quand la remise est nulle', async () => {
      quotesServiceMock.findOneForUser.mockResolvedValue(
        makeQuote({
          labor_items_json: [
            makeLaborLine({
              quantity: 5,
              unit_price_ht: 45,
              line_total_ht: 225,
            }),
            makeLaborLine({
              quantity: 3,
              unit_price_ht: 45,
              line_total_ht: 135,
            }),
            makeLaborLine({
              kind: 'flat',
              quantity: 1,
              unit_price_ht: 100,
              line_total_ht: 100,
            }),
          ],
          subtotal_labor_ht: '460.00' as unknown as number,
          discount_percent: '0.00' as unknown as number,
          total_ht: '611.47' as unknown as number,
          total_ttc: '672.62' as unknown as number,
        }),
      );

      const invoice = await create();
      expect(invoice.items_json.some((i) => i.kind === 'discount')).toBe(false);
      const sum = invoice.items_json.reduce((s, i) => s + i.line_total_ht, 0);
      expect(Math.round(sum * 100) / 100).toBe(611.47);
    });

    it('omits the labour line when the quote has none', async () => {
      quotesServiceMock.findOneForUser.mockResolvedValue(
        makeQuote({
          labor_items_json: [],
          subtotal_labor_ht: '0.00' as unknown as number,
          total_ht: '151.47' as unknown as number,
        }),
      );

      const invoice = await create();
      expect(invoice.items_json.some((i) => i.kind === 'labor')).toBe(false);
    });

    it('computes VAT from the total HT rather than copying the quote TTC', async () => {
      const invoice = await create();

      expect(Number(invoice.total_tva)).toBe(87.15);
      expect(Number(invoice.total_ttc)).toBe(958.62);
      expect(invoice.vat_breakdown).toEqual([
        { rate: 10, base_ht: 871.47, tva_amount: 87.15 },
      ]);
    });

    it('forces a zero rate and the 293 B mention under the franchise en base', async () => {
      companyProfilesServiceMock.findByUserId.mockResolvedValue(
        makeProfile({ vat_exempt: true, vat_number: null }),
      );

      const invoice = await create();

      expect(Number(invoice.total_tva)).toBe(0);
      expect(Number(invoice.total_ttc)).toBe(871.47);
      expect(invoice.vat_breakdown).toEqual([
        {
          rate: 0,
          base_ht: 871.47,
          tva_amount: 0,
          exemption_reason: 'TVA non applicable, art. 293 B du CGI',
        },
      ]);
      expect(invoice.items_json.every((i) => i.tva_rate === 0)).toBe(true);
    });

    it('snapshots the seller identity', async () => {
      const invoice = await create();

      expect(invoice.seller_snapshot).toMatchObject({
        name: 'Dupont Renovation SARL',
        siret: '12345678901234',
        siren: '123456789',
        vat_number: 'FR12345678901',
        rcs_city: 'Paris',
        insurance_name: 'AXA',
        capital_social: 10000,
        iban: 'FR7630006000011234567890189',
      });
    });

    it('snapshots the buyer identity and the B2B SIREN', async () => {
      clientsServiceMock.findOneForUser.mockResolvedValue(
        makeClient({ is_company: true, siret: '98765432109876' }),
      );

      const invoice = await create();

      expect(invoice.buyer_snapshot).toMatchObject({
        name: 'Marie Martin',
        siret: '98765432109876',
        siren: '987654321',
        is_company: true,
      });
      expect(invoice.buyer_siren).toBe('987654321');
    });

    it('leaves the buyer SIREN empty for an individual', async () => {
      const invoice = await create();
      expect(invoice.buyer_siren).toBeNull();
      expect(invoice.buyer_snapshot.is_company).toBe(false);
    });

    it('falls back to a placeholder buyer when the quote has no client', async () => {
      quotesServiceMock.findOneForUser.mockResolvedValue(
        makeQuote({ client_id: null }),
      );

      const invoice = await create();

      expect(clientsServiceMock.findOneForUser).not.toHaveBeenCalled();
      expect(invoice.buyer_snapshot.name).toBe('Client particulier');
    });

    it('keeps the quote reference so it survives quote deletion', async () => {
      const invoice = await create();
      expect(invoice.source_quote_number).toBe('D-2026-001');
      expect(invoice.quote_id).toBe('quote-1');
    });

    it('derives the due date from the profile payment terms', async () => {
      companyProfilesServiceMock.findByUserId.mockResolvedValue(
        makeProfile({ default_payment_terms_days: 45 }),
      );

      const invoice = await create();
      expect(invoice.issued_on).toBe('2026-08-01');
      expect(invoice.due_on).toBe('2026-09-15');
    });

    it('defaults the supply date to the issue date', async () => {
      const invoice = await create();
      expect(invoice.supply_date).toBe('2026-08-01');
    });

    it('carries the 2026 mandatory mentions', async () => {
      const invoice = await service.createFromQuote(USER_ID, {
        quote_id: 'quote-1',
        issued_on: '2026-08-01',
        delivery_address: '12 rue du Chantier, 75011 Paris',
        operation_category: OperationCategory.SERVICES,
        vat_on_debits: true,
      });

      expect(invoice.delivery_address).toBe('12 rue du Chantier, 75011 Paris');
      expect(invoice.operation_category).toBe(OperationCategory.SERVICES);
      expect(invoice.vat_on_debits).toBe(true);
    });

    it('defaults the operation category to mixte for renovation work', async () => {
      const invoice = await create();
      expect(invoice.operation_category).toBe(OperationCategory.MIXTE);
      expect(invoice.vat_on_debits).toBe(false);
    });

    it('issues as a solde invoice in the issued state', async () => {
      const invoice = await create();
      expect(invoice.invoice_type).toBe(InvoiceType.SOLDE);
      expect(invoice.status).toBe(InvoiceStatus.ISSUED);
    });
  });

  describe('updateStatus', () => {
    it('stamps paid_at when marking the invoice paid', async () => {
      repoMock.findOne.mockResolvedValue({
        id: 'invoice-1',
        user_id: USER_ID,
        status: InvoiceStatus.ISSUED,
        paid_at: null,
      });
      repoMock.save.mockImplementation((i: unknown) => Promise.resolve(i));

      const invoice = await service.updateStatus('invoice-1', USER_ID, {
        status: InvoiceStatus.PAID,
        paid_at: '2026-08-20',
      });

      expect(invoice.status).toBe(InvoiceStatus.PAID);
      expect(invoice.paid_at?.toISOString()).toBe('2026-08-20T00:00:00.000Z');
    });

    it('clears paid_at when reverting to issued', async () => {
      repoMock.findOne.mockResolvedValue({
        id: 'invoice-1',
        user_id: USER_ID,
        status: InvoiceStatus.PAID,
        paid_at: new Date('2026-08-20T00:00:00.000Z'),
      });
      repoMock.save.mockImplementation((i: unknown) => Promise.resolve(i));

      const invoice = await service.updateStatus('invoice-1', USER_ID, {
        status: InvoiceStatus.ISSUED,
      });

      expect(invoice.paid_at).toBeNull();
    });

    it('refuses an invoice owned by someone else', async () => {
      repoMock.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatus('invoice-1', USER_ID, {
          status: InvoiceStatus.PAID,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAllForUser', () => {
    it('scopes to the user and applies the filters', async () => {
      repoMock.find.mockResolvedValue([]);

      await service.findAllForUser(USER_ID, {
        status: InvoiceStatus.PAID,
        quote_id: 'quote-1',
      });

      expect(repoMock.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            user_id: USER_ID,
            status: InvoiceStatus.PAID,
            quote_id: 'quote-1',
          },
        }),
      );
    });

    it('omits absent filters', async () => {
      repoMock.find.mockResolvedValue([]);
      await service.findAllForUser(USER_ID);
      expect(repoMock.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { user_id: USER_ID } }),
      );
    });
  });
});
