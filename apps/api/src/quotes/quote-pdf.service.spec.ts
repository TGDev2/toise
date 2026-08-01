import PDFDocument from 'pdfkit';
import { QuotePdfService } from './quote-pdf.service';
import {
  LaborType,
  QuoteStatus,
  type Quote,
  type QuoteLineItem,
} from './entities/quote.entity';
import type { CompanyProfile } from '../company-profiles/entities/company-profile.entity';
import type { Client } from '../clients/entities/client.entity';

/**
 * Filet de sécurité posé avant l'extraction de `PdfBuilder` (PRO-4) : le module
 * quotes n'avait aucun test. La sortie PDFKit n'est pas comparable octet à octet
 * (date de création embarquée), on assert donc ce qui est stable : en-tête PDF
 * valide, document non vide, et absence d'exception sur les cas limites.
 */

function makeItem(overrides: Partial<QuoteLineItem> = {}): QuoteLineItem {
  return {
    material_name: 'Peinture acrylique mate 10 L',
    material_category: 'peinture',
    work_type_label: 'Peinture murs',
    packaging_label: 'Pot de 10 L',
    units_needed: 3,
    base_unit_price: 45.9,
    margin_percent: 10,
    unit_price_with_margin: 50.49,
    line_total_ht: 151.47,
    ...overrides,
  };
}

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'quote-1',
    user_id: 'user-1',
    project_id: 'project-1',
    client_id: 'client-1',
    estimation_id: 'estimation-1',
    quote_number: 'D-2026-001',
    status: QuoteStatus.SENT,
    labor_type: LaborType.HOURLY,
    labor_hourly_rate: '45.00' as unknown as number,
    labor_estimated_hours: '16.00' as unknown as number,
    labor_flat_amount: null,
    material_margin_percent: '10.00' as unknown as number,
    discount_percent: '5.00' as unknown as number,
    payment_terms: '30 % a la commande, solde a la livraison',
    validity_days: 30,
    notes: 'Devis valable 30 jours',
    items_json: [makeItem()],
    subtotal_materials_ht: '151.47' as unknown as number,
    subtotal_labor_ht: '720.00' as unknown as number,
    total_ht: '827.90' as unknown as number,
    tva_rate: '10.00' as unknown as number,
    total_ttc: '910.69' as unknown as number,
    sent_at: new Date('2026-07-01T08:00:00.000Z'),
    accepted_at: null,
    refused_at: null,
    reminder_7d_sent_at: null,
    reminder_14d_sent_at: null,
    created_at: new Date('2026-07-01T08:00:00.000Z'),
    updated_at: new Date('2026-07-01T08:00:00.000Z'),
    ...overrides,
  } as Quote;
}

function makeCompanyProfile(
  overrides: Partial<CompanyProfile> = {},
): CompanyProfile {
  return {
    id: 'profile-1',
    user_id: 'user-1',
    raison_sociale: 'Dupont Renovation SARL',
    siret: '12345678901234',
    address_line1: '1 rue de Paris',
    address_line2: 'Batiment A',
    postal_code: '75001',
    city: 'Paris',
    country: 'FR',
    phone: '+33612345678',
    specialties: ['peinture'],
    ...overrides,
  } as CompanyProfile;
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    user_id: 'user-1',
    name: 'Marie Martin',
    email: 'marie@example.com',
    phone: '+33698765432',
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

describe('QuotePdfService', () => {
  let service: QuotePdfService;

  beforeEach(() => {
    service = new QuotePdfService();
  });

  it('produces a non-empty PDF document', async () => {
    const buffer = await service.generatePdf(
      makeQuote(),
      makeCompanyProfile(),
      makeClient(),
    );

    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('renders without a client', async () => {
    const buffer = await service.generatePdf(
      makeQuote({ client_id: null }),
      makeCompanyProfile(),
      null,
    );

    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('renders a flat-rate labor quote', async () => {
    const buffer = await service.generatePdf(
      makeQuote({
        labor_type: LaborType.FLAT,
        labor_hourly_rate: null,
        labor_estimated_hours: null,
        labor_flat_amount: '900.00' as unknown as number,
      }),
      makeCompanyProfile(),
      makeClient(),
    );

    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('renders a quote with no line items and no optional sections', async () => {
    const buffer = await service.generatePdf(
      makeQuote({
        items_json: [],
        discount_percent: '0.00' as unknown as number,
        payment_terms: null,
        notes: null,
      }),
      makeCompanyProfile({ address_line2: null, phone: null }),
      makeClient({
        address_line1: null,
        address_line2: null,
        postal_code: null,
        city: null,
        email: null,
        phone: null,
      }),
    );

    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('paginates a quote with many line items', async () => {
    const items = Array.from({ length: 60 }, (_, i) =>
      makeItem({ material_name: `Materiau ${i + 1}` }),
    );

    const buffer = await service.generatePdf(
      makeQuote({ items_json: items }),
      makeCompanyProfile(),
      makeClient(),
    );

    expect(buffer.length).toBeGreaterThan(1000);
  });

  /**
   * Régression : PDFKit laisse `doc.x` sur la dernière abscisse écrite. L'encadré
   * client étant positionné à x=350, tout le corps du document dérivait ensuite
   * vers la droite jusqu'à sortir de la page (première ligne du tableau à x=710
   * sur une A4 de 595 pt). `PdfBuilder` repart systématiquement de la marge.
   */
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
      await service.generatePdf(
        makeQuote({
          items_json: [makeItem(), makeItem({ material_name: 'Enduit' })],
        }),
        makeCompanyProfile(),
        makeClient(),
      );
    } finally {
      proto.text = original;
    }

    expect(overflows).toEqual([]);
  });
});
