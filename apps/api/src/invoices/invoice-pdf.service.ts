import { Injectable } from '@nestjs/common';
import { PdfBuilder, type PdfColumn } from '../common/pdf/pdf-builder';
import {
  InvoiceStatus,
  type Invoice,
  type InvoiceLineItem,
  type InvoicePartySnapshot,
} from './entities/invoice.entity';

const OPERATION_LABELS: Record<string, string> = {
  biens: 'Livraisons de biens',
  services: 'Prestations de services',
  mixte: 'Livraisons de biens et prestations de services',
};

/** Art. L441-10 du code de commerce. */
const RECOVERY_INDEMNITY_EUR = 40;

const COLUMNS: PdfColumn[] = [
  { label: 'Designation', offset: 0, width: 195 },
  { label: 'Qte', offset: 200, width: 40, align: 'center' },
  { label: 'PU HT', offset: 245, width: 70, align: 'right' },
  { label: 'TVA', offset: 320, width: 40, align: 'right' },
  { label: 'Total HT', offset: 365, width: 80, align: 'right' },
];

/**
 * PDF de facture.
 *
 * `generatePdf` ne prend **que** la facture : ni `CompanyProfile` ni `Client` en
 * paramètre. Tout est rendu depuis `seller_snapshot` / `buyer_snapshot` /
 * `items_json` / `vat_breakdown`, donc une facture réimprimée dix ans plus tard
 * est identique à l'originale même si le profil ou le client ont changé. C'est la
 * contrainte la plus importante de PRO-4, et elle est portée par la signature.
 */
@Injectable()
export class InvoicePdfService {
  async generatePdf(invoice: Invoice): Promise<Buffer> {
    const pdf = new PdfBuilder();
    const doc = pdf.doc;
    const seller = invoice.seller_snapshot;
    const buyer = invoice.buyer_snapshot;

    this.drawSeller(pdf, seller);
    const headerBottom = doc.y;
    this.drawBuyer(pdf, buyer, invoice.buyer_siren);

    doc.fillColor('#000000');
    doc.y = Math.max(headerBottom, doc.y, 190);
    pdf.resetX();
    doc.moveDown(1);

    this.drawMetadata(pdf, invoice);
    this.drawLines(pdf, invoice.items_json);
    this.drawVatBreakdown(pdf, invoice);
    this.drawTotals(pdf, invoice);
    this.drawPayment(pdf, invoice);
    this.drawLegalFooter(pdf, invoice);

    return pdf.finish();
  }

  private drawSeller(pdf: PdfBuilder, seller: InvoicePartySnapshot): void {
    const doc = pdf.doc;
    doc.fontSize(15).font('Helvetica-Bold').fillColor('#000000');
    doc.text(seller.name, pdf.left, 50, { width: 280 });

    doc.fontSize(8).font('Helvetica').fillColor('#444444');
    const lines: string[] = [];
    if (seller.address_line1) lines.push(seller.address_line1);
    if (seller.address_line2) lines.push(seller.address_line2);
    lines.push(`${seller.postal_code ?? ''} ${seller.city ?? ''}`.trim());
    if (seller.phone) lines.push(`Tel : ${seller.phone}`);
    if (seller.email) lines.push(seller.email);
    lines.push(`SIRET : ${seller.siret ?? '-'}`);

    const registration = this.registrationLine(seller);
    if (registration) lines.push(registration);

    const legal = this.legalFormLine(seller);
    if (legal) lines.push(legal);

    lines.push(
      seller.vat_exempt
        ? 'TVA non applicable, art. 293 B du CGI'
        : `TVA intracom. : ${seller.vat_number ?? '-'}`,
    );

    for (const line of lines) {
      doc.text(line, pdf.left, doc.y, { width: 280 });
    }

    if (seller.insurance_name) {
      const policy = seller.insurance_policy
        ? ` — contrat ${seller.insurance_policy}`
        : '';
      doc.text(
        `Assurance decennale : ${seller.insurance_name}${policy} — couverture : ${seller.insurance_coverage ?? '-'}`,
        pdf.left,
        doc.y,
        { width: 280 },
      );
    }

    pdf.resetX();
  }

  private registrationLine(seller: InvoicePartySnapshot): string | null {
    // Le numéro RCS est le SIREN : on ne le stocke pas, on le dérive du SIRET.
    if (seller.rcs_city) {
      return `RCS ${seller.rcs_city} ${seller.siren ?? ''}`.trim();
    }
    if (seller.rm_department) {
      return `Repertoire des metiers : ${seller.siren ?? ''} RM ${seller.rm_department}`.trim();
    }
    return null;
  }

  private legalFormLine(seller: InvoicePartySnapshot): string | null {
    if (!seller.legal_form) return null;
    if (seller.capital_social == null) return seller.legal_form;
    return `${seller.legal_form} au capital de ${PdfBuilder.formatPrice(Number(seller.capital_social))} EUR`;
  }

  private drawBuyer(
    pdf: PdfBuilder,
    buyer: InvoicePartySnapshot,
    buyerSiren: string | null,
  ): void {
    const doc = pdf.doc;
    const x = 350;
    let y = 50;

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
    doc.text('Facture a', x, y);
    y += 14;
    doc.fontSize(10).text(buyer.name, x, y, { width: 195 });
    y += 14;

    doc.fontSize(8).font('Helvetica').fillColor('#444444');
    const lines: string[] = [];
    if (buyer.address_line1) lines.push(buyer.address_line1);
    if (buyer.address_line2) lines.push(buyer.address_line2);
    const cityLine = `${buyer.postal_code ?? ''} ${buyer.city ?? ''}`.trim();
    if (cityLine) lines.push(cityLine);
    if (buyer.email) lines.push(buyer.email);
    if (buyerSiren) lines.push(`SIREN : ${buyerSiren}`);
    if (buyer.vat_number) lines.push(`TVA : ${buyer.vat_number}`);

    for (const line of lines) {
      doc.text(line, x, y, { width: 195 });
      y += 11;
    }
  }

  private drawMetadata(pdf: PdfBuilder, invoice: Invoice): void {
    const doc = pdf.doc;

    doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000');
    pdf.text(`FACTURE N° ${invoice.invoice_number}`, { align: 'center' });

    doc.moveDown(0.4);
    doc.fontSize(9).font('Helvetica').fillColor('#555555');
    pdf.text(`Date d'emission : ${PdfBuilder.formatDate(invoice.issued_on)}`, {
      align: 'center',
    });
    if (invoice.supply_date) {
      pdf.text(
        `Date de la prestation : ${PdfBuilder.formatDate(invoice.supply_date)}`,
        { align: 'center' },
      );
    }
    pdf.text(
      `Echeance de paiement : ${PdfBuilder.formatDate(invoice.due_on)}`,
      {
        align: 'center',
      },
    );
    pdf.text(
      `Nature de l'operation : ${OPERATION_LABELS[invoice.operation_category] ?? invoice.operation_category}`,
      { align: 'center' },
    );
    if (invoice.source_quote_number) {
      pdf.text(`Reference devis : ${invoice.source_quote_number}`, {
        align: 'center',
      });
    }
    if (invoice.status === InvoiceStatus.PAID) {
      doc.fillColor('#1d6b57').font('Helvetica-Bold');
      pdf.text('FACTURE ACQUITTEE', { align: 'center' });
    }
    if (invoice.delivery_address) {
      doc.fillColor('#555555').font('Helvetica');
      pdf.text(`Adresse de livraison : ${invoice.delivery_address}`, {
        align: 'center',
      });
    }
    if (invoice.vat_on_debits) {
      doc.fillColor('#555555').font('Helvetica');
      pdf.text("Option pour le paiement de la taxe d'apres les debits", {
        align: 'center',
      });
    }

    doc.fillColor('#000000');
  }

  private drawLines(pdf: PdfBuilder, items: InvoiceLineItem[]): void {
    const doc = pdf.doc;
    doc.moveDown(1);
    pdf.sectionTitle('Detail des prestations');
    doc.moveDown(0.3);
    pdf.tableHeader(COLUMNS);

    for (const item of items) {
      pdf.checkPageBreak(40);
      pdf.tableRow(COLUMNS, [
        { text: item.label },
        { text: this.formatQuantity(item.quantity) },
        { text: PdfBuilder.formatPrice(item.unit_price_ht) },
        { text: `${item.tva_rate} %` },
        { text: PdfBuilder.formatPrice(item.line_total_ht), bold: true },
      ]);
    }
  }

  private drawVatBreakdown(pdf: PdfBuilder, invoice: Invoice): void {
    const doc = pdf.doc;
    doc.moveDown(0.8);
    pdf.sectionTitle('Recapitulatif de TVA');
    doc.moveDown(0.3);

    doc.fontSize(9).font('Helvetica').fillColor('#000000');
    for (const entry of invoice.vat_breakdown) {
      const label = entry.exemption_reason
        ? entry.exemption_reason
        : `Base HT au taux de ${entry.rate} % : ${PdfBuilder.formatPrice(entry.base_ht)} EUR — TVA : ${PdfBuilder.formatPrice(entry.tva_amount)} EUR`;
      pdf.text(label);
    }
  }

  private drawTotals(pdf: PdfBuilder, invoice: Invoice): void {
    const doc = pdf.doc;
    doc.moveDown(1);
    pdf.hr();
    doc.moveDown(0.5);

    pdf.totalsRow(
      'Total HT',
      `${PdfBuilder.formatPrice(Number(invoice.total_ht))} EUR`,
      { bold: true },
    );
    pdf.totalsRow(
      'Total TVA',
      `${PdfBuilder.formatPrice(Number(invoice.total_tva))} EUR`,
    );
    doc.moveDown(0.3);
    pdf.totalsRow(
      'Net a payer TTC',
      `${PdfBuilder.formatPrice(Number(invoice.total_ttc))} EUR`,
      { bold: true, size: 13 },
    );
  }

  private drawPayment(pdf: PdfBuilder, invoice: Invoice): void {
    const doc = pdf.doc;
    const seller = invoice.seller_snapshot;

    doc.moveDown(1.5);
    pdf.sectionTitle('Reglement');
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica').fillColor('#000000');

    if (invoice.payment_terms) {
      pdf.text(invoice.payment_terms);
    }
    if (seller.iban) {
      const bic = seller.bic ? ` — BIC : ${seller.bic}` : '';
      pdf.text(`IBAN : ${seller.iban}${bic}`);
    }
    if (invoice.notes) {
      doc.moveDown(0.4);
      pdf.text(invoice.notes);
    }
  }

  private drawLegalFooter(pdf: PdfBuilder, invoice: Invoice): void {
    const doc = pdf.doc;
    const penaltyRate = invoice.late_penalty_rate;

    doc.moveDown(1.2);
    doc.fontSize(7).font('Helvetica').fillColor('#777777');

    pdf.text(
      penaltyRate == null
        ? "En cas de retard de paiement, penalites de retard au taux d'interet legal majore de 10 points, exigibles sans rappel."
        : `En cas de retard de paiement, penalites de retard au taux de ${Number(penaltyRate)} % l'an, exigibles sans rappel.`,
    );
    pdf.text(
      `Indemnite forfaitaire pour frais de recouvrement : ${RECOVERY_INDEMNITY_EUR} EUR (art. L441-10 du code de commerce).`,
    );
    pdf.text('Escompte pour paiement anticipe : neant.');

    doc.moveDown(0.5);
    doc.fillColor('#999999');
    pdf.text(
      `Facture ${invoice.invoice_number} — generee par Chiffréo le ${PdfBuilder.formatDate(invoice.issued_on)}`,
      { align: 'center' },
    );
  }

  private formatQuantity(quantity: number): string {
    return Number.isInteger(quantity)
      ? String(quantity)
      : String(Number(quantity.toFixed(2)));
  }
}
