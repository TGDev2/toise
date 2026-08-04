import PDFDocument from 'pdfkit';
import { InvoicePdfService } from './invoice-pdf.service';
import {
  InvoiceStatus,
  InvoiceType,
  OperationCategory,
  type Invoice,
  type InvoiceLineItem,
  type InvoicePartySnapshot,
} from './entities/invoice.entity';

function makeSeller(
  overrides: Partial<InvoicePartySnapshot> = {},
): InvoicePartySnapshot {
  return {
    name: 'Dupont Renovation SARL',
    address_line1: '1 rue de Paris',
    address_line2: null,
    postal_code: '75001',
    city: 'Paris',
    country: 'FR',
    email: 'contact@dupont.fr',
    phone: '+33612345678',
    siret: '12345678901234',
    siren: '123456789',
    vat_number: 'FR12345678901',
    vat_exempt: false,
    legal_form: 'SARL',
    capital_social: 10000,
    rcs_city: 'Paris',
    rm_department: null,
    insurance_name: 'AXA',
    insurance_policy: 'POL-123',
    insurance_coverage: 'France metropolitaine',
    iban: 'FR7630006000011234567890189',
    bic: 'AGRIFRPP',
    ...overrides,
  };
}

function makeBuyer(
  overrides: Partial<InvoicePartySnapshot> = {},
): InvoicePartySnapshot {
  return {
    name: 'Marie Martin',
    address_line1: '5 avenue des Champs',
    address_line2: null,
    postal_code: '75008',
    city: 'Paris',
    country: 'FR',
    email: 'marie@example.com',
    phone: null,
    siret: null,
    siren: null,
    vat_number: null,
    is_company: false,
    ...overrides,
  };
}

function makeLine(overrides: Partial<InvoiceLineItem> = {}): InvoiceLineItem {
  return {
    kind: 'material',
    label: 'Peinture acrylique mate 10 L',
    description: 'Pot de 10 L',
    quantity: 3,
    unit: 'Pot de 10 L',
    unit_price_ht: 50.49,
    line_total_ht: 151.47,
    tva_rate: 10,
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'invoice-1',
    user_id: 'user-1',
    quote_id: 'quote-1',
    project_id: 'project-1',
    client_id: 'client-1',
    invoice_number: 'F-2026-0001',
    invoice_type: InvoiceType.SOLDE,
    status: InvoiceStatus.ISSUED,
    source_quote_number: 'D-2026-001',
    issued_on: '2026-08-01',
    supply_date: '2026-07-28',
    due_on: '2026-08-31',
    currency: 'EUR',
    seller_snapshot: makeSeller(),
    buyer_snapshot: makeBuyer(),
    buyer_siren: null,
    delivery_address: null,
    operation_category: OperationCategory.MIXTE,
    vat_on_debits: false,
    items_json: [
      makeLine(),
      makeLine({
        kind: 'labor',
        label: "Main d'oeuvre",
        description: '16 h x 45 EUR/h',
        quantity: 16,
        unit: 'h',
        unit_price_ht: 45,
        line_total_ht: 720,
      }),
    ],
    vat_breakdown: [{ rate: 10, base_ht: 871.47, tva_amount: 87.15 }],
    total_ht: '871.47' as unknown as number,
    total_tva: '87.15' as unknown as number,
    total_ttc: '958.62' as unknown as number,
    payment_terms: '30 % a la commande, solde a la livraison',
    late_penalty_rate: '12.00' as unknown as number,
    notes: null,
    paid_at: null,
    created_at: new Date('2026-08-01T08:00:00.000Z'),
    updated_at: new Date('2026-08-01T08:00:00.000Z'),
    ...overrides,
  } as Invoice;
}

describe('InvoicePdfService', () => {
  let service: InvoicePdfService;

  beforeEach(() => {
    service = new InvoicePdfService();
  });

  it('produces a non-empty PDF document', async () => {
    const buffer = await service.generatePdf(makeInvoice());

    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('has no dependency it could read live data from', () => {
    // Le service ne reçoit ni repository ni CompanyProfilesService/ClientsService :
    // il ne peut rendre que les snapshots de la facture. Un profil modifié ou un
    // client supprimé ne peuvent donc pas altérer un document déjà émis.
    expect(InvoicePdfService).toHaveLength(0);
  });

  it('renders a franchise en base invoice', async () => {
    const buffer = await service.generatePdf(
      makeInvoice({
        seller_snapshot: makeSeller({ vat_exempt: true, vat_number: null }),
        vat_breakdown: [
          {
            rate: 0,
            base_ht: 871.47,
            tva_amount: 0,
            exemption_reason: 'TVA non applicable, art. 293 B du CGI',
          },
        ],
        total_tva: '0.00' as unknown as number,
        total_ttc: '871.47' as unknown as number,
      }),
    );

    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('renders an artisan registered at the repertoire des metiers', async () => {
    const buffer = await service.generatePdf(
      makeInvoice({
        seller_snapshot: makeSeller({
          rcs_city: null,
          rm_department: 'Rhone',
          legal_form: null,
          capital_social: null,
        }),
      }),
    );

    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('renders a B2B invoice with the buyer SIREN and the 2026 mentions', async () => {
    const buffer = await service.generatePdf(
      makeInvoice({
        buyer_snapshot: makeBuyer({
          is_company: true,
          siret: '98765432109876',
          siren: '987654321',
          vat_number: 'FR98987654321',
        }),
        buyer_siren: '987654321',
        delivery_address: '12 rue du Chantier, 75011 Paris',
        operation_category: OperationCategory.SERVICES,
        vat_on_debits: true,
      }),
    );

    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('renders an invoice with two labor lines (E2-3)', async () => {
    const buffer = await service.generatePdf(
      makeInvoice({
        items_json: [
          makeLine(),
          makeLine({
            kind: 'labor',
            label: 'Peinture murale — Salon',
            description: '5 h x 45 EUR/h',
            quantity: 5,
            unit: 'h',
            unit_price_ht: 45,
            line_total_ht: 225,
          }),
          makeLine({
            kind: 'labor',
            label: 'Peinture plafond — Salon',
            description: '3 h x 45 EUR/h',
            quantity: 3,
            unit: 'h',
            unit_price_ht: 45,
            line_total_ht: 135,
          }),
        ],
      }),
    );

    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('renders a discount line and a paid invoice', async () => {
    const buffer = await service.generatePdf(
      makeInvoice({
        status: InvoiceStatus.PAID,
        paid_at: new Date('2026-08-20T00:00:00.000Z'),
        items_json: [
          makeLine(),
          makeLine({
            kind: 'discount',
            label: 'Remise (5 %)',
            description: null,
            quantity: 1,
            unit: null,
            unit_price_ht: -43.57,
            line_total_ht: -43.57,
          }),
        ],
      }),
    );

    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('renders a minimal invoice with every optional field empty', async () => {
    const buffer = await service.generatePdf(
      makeInvoice({
        source_quote_number: null,
        supply_date: null,
        payment_terms: null,
        late_penalty_rate: null,
        notes: null,
        seller_snapshot: makeSeller({
          address_line2: null,
          phone: null,
          email: null,
          iban: null,
          bic: null,
          insurance_name: null,
          insurance_policy: null,
          insurance_coverage: null,
          legal_form: null,
          capital_social: null,
        }),
        buyer_snapshot: makeBuyer({
          address_line1: null,
          postal_code: null,
          city: null,
          email: null,
        }),
      }),
    );

    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('paginates an invoice with many lines', async () => {
    const items = Array.from({ length: 60 }, (_, i) =>
      makeLine({ label: `Materiau ${i + 1}` }),
    );

    const buffer = await service.generatePdf(
      makeInvoice({ items_json: items }),
    );
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('never draws text outside the page content box', async () => {
    const proto = PDFDocument.prototype as unknown as {
      text: (...args: unknown[]) => unknown;
    };
    const original = proto.text;
    const overflows: string[] = [];

    proto.text = function (this: PDFKit.PDFDocument, ...args: unknown[]) {
      const x = typeof args[1] === 'number' ? args[1] : this.x;
      if (x < 0 || x > this.page.width - this.page.margins.right) {
        overflows.push(
          `x=${Math.round(x)} « ${String(args[0]).slice(0, 30)} »`,
        );
      }
      return original.apply(this, args);
    };

    try {
      await service.generatePdf(makeInvoice());
    } finally {
      proto.text = original;
    }

    expect(overflows).toEqual([]);
  });
});
