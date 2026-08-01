import { Injectable } from '@nestjs/common';
import { LaborType } from './entities/quote.entity';
import type { Quote, QuoteLineItem } from './entities/quote.entity';
import type { CompanyProfile } from '../company-profiles/entities/company-profile.entity';
import type { Client } from '../clients/entities/client.entity';
import { PdfBuilder, type PdfColumn } from '../common/pdf/pdf-builder';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  refused: 'Refusé',
  negotiation: 'En négociation',
};

const COLUMNS: PdfColumn[] = [
  { label: 'Designation', offset: 0, width: 200 },
  { label: 'Qte', offset: 210, width: 40, align: 'center' },
  { label: 'PU HT', offset: 260, width: 80, align: 'right' },
  { label: 'Total HT', offset: 360, width: 85, align: 'right' },
];

@Injectable()
export class QuotePdfService {
  async generatePdf(
    quote: Quote,
    companyProfile: CompanyProfile,
    client: Client | null,
  ): Promise<Buffer> {
    const pdf = new PdfBuilder();
    const doc = pdf.doc;

    // ── Company header (top-left) ──
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(companyProfile.raison_sociale, pdf.left, 50);

    doc.fontSize(9).font('Helvetica').fillColor('#444444');
    doc.text(companyProfile.address_line1, pdf.left, doc.y + 4);
    if (companyProfile.address_line2) {
      doc.text(companyProfile.address_line2, pdf.left, doc.y);
    }
    doc.text(
      `${companyProfile.postal_code} ${companyProfile.city}`,
      pdf.left,
      doc.y,
    );
    if (companyProfile.phone) {
      doc.text(`Tel : ${companyProfile.phone}`, pdf.left, doc.y);
    }
    doc.text(`SIRET : ${companyProfile.siret}`, pdf.left, doc.y);

    const headerBottom = doc.y;

    // ── Client block (top-right) ──
    if (client) {
      const clientX = 350;
      let clientY = 50;
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text('Client', clientX, clientY);
      clientY += 14;
      doc.fontSize(10).text(client.name, clientX, clientY);
      clientY += 14;
      doc.fontSize(9).font('Helvetica').fillColor('#444444');
      if (client.address_line1) {
        doc.text(client.address_line1, clientX, clientY);
        clientY += 12;
      }
      if (client.address_line2) {
        doc.text(client.address_line2, clientX, clientY);
        clientY += 12;
      }
      if (client.postal_code || client.city) {
        doc.text(
          `${client.postal_code ?? ''} ${client.city ?? ''}`.trim(),
          clientX,
          clientY,
        );
        clientY += 12;
      }
      if (client.email) {
        doc.text(client.email, clientX, clientY);
        clientY += 12;
      }
      if (client.phone) {
        doc.text(`Tel : ${client.phone}`, clientX, clientY);
      }
    }

    // ── Quote metadata ──
    doc.fillColor('#000000');
    doc.y = Math.max(headerBottom, doc.y, 160);
    pdf.resetX();
    doc.moveDown(1.5);

    doc.fontSize(18).font('Helvetica-Bold');
    pdf.text(`DEVIS N° ${quote.quote_number}`, { align: 'center' });

    doc.moveDown(0.3);
    const dateStr = PdfBuilder.formatDate(quote.created_at);
    doc.fontSize(10).font('Helvetica').fillColor('#555555');
    pdf.text(`Date : ${dateStr}`, { align: 'center' });

    const validityDate = new Date(quote.created_at);
    validityDate.setDate(validityDate.getDate() + quote.validity_days);
    pdf.text(`Valable jusqu'au : ${PdfBuilder.formatDate(validityDate)}`, {
      align: 'center',
    });
    pdf.text(`Statut : ${STATUS_LABELS[quote.status] ?? quote.status}`, {
      align: 'center',
    });

    doc.fillColor('#000000');

    // ── Materials table ──
    doc.moveDown(1);
    pdf.sectionTitle('Detail des materiaux');
    doc.moveDown(0.3);
    pdf.tableHeader(COLUMNS);

    for (const item of quote.items_json) {
      pdf.checkPageBreak(30);
      this.drawMaterialRow(pdf, item);
    }

    // ── Labor section ──
    doc.moveDown(0.8);
    pdf.sectionTitle("Main d'oeuvre");
    doc.moveDown(0.3);

    doc.fontSize(10).font('Helvetica');
    if (quote.labor_type === LaborType.HOURLY) {
      const rate = Number(quote.labor_hourly_rate) || 0;
      const hours = Number(quote.labor_estimated_hours) || 0;
      pdf.text(
        `${hours} h x ${PdfBuilder.formatPrice(rate)} EUR/h = ${PdfBuilder.formatPrice(rate * hours)} EUR HT`,
      );
    } else {
      const amount = Number(quote.labor_flat_amount) || 0;
      pdf.text(`Forfait : ${PdfBuilder.formatPrice(amount)} EUR HT`);
    }

    // ── Totals block ──
    doc.moveDown(1);
    pdf.hr();
    doc.moveDown(0.5);

    pdf.totalsRow(
      'Sous-total materiaux HT',
      `${PdfBuilder.formatPrice(Number(quote.subtotal_materials_ht))} EUR`,
    );
    pdf.totalsRow(
      "Sous-total main d'oeuvre HT",
      `${PdfBuilder.formatPrice(Number(quote.subtotal_labor_ht))} EUR`,
    );

    const discountPercent = Number(quote.discount_percent) || 0;
    if (discountPercent > 0) {
      const discountAmount =
        (Number(quote.subtotal_materials_ht) +
          Number(quote.subtotal_labor_ht)) *
        (discountPercent / 100);
      pdf.totalsRow(
        `Remise (${discountPercent} %)`,
        `-${PdfBuilder.formatPrice(discountAmount)} EUR`,
      );
    }

    pdf.totalsRow(
      'Total HT',
      `${PdfBuilder.formatPrice(Number(quote.total_ht))} EUR`,
      { bold: true },
    );

    const tvaAmount = Number(quote.total_ttc) - Number(quote.total_ht);
    pdf.totalsRow(
      `TVA (${Number(quote.tva_rate)} %)`,
      `${PdfBuilder.formatPrice(tvaAmount)} EUR`,
    );

    doc.moveDown(0.3);
    pdf.totalsRow(
      'Total TTC',
      `${PdfBuilder.formatPrice(Number(quote.total_ttc))} EUR`,
      { bold: true, size: 13 },
    );

    // ── Payment terms ──
    if (quote.payment_terms) {
      doc.moveDown(1.5);
      pdf.sectionTitle('Conditions de reglement');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      pdf.text(quote.payment_terms);
    }

    // ── Notes ──
    if (quote.notes) {
      doc.moveDown(0.8);
      pdf.sectionTitle('Notes');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      pdf.text(quote.notes);
    }

    // ── Footer ──
    doc.moveDown(2);
    doc.fontSize(8).fillColor('#999999');
    pdf.text(
      `SIRET : ${companyProfile.siret} — Genere par Chiffréo — ${dateStr}`,
      { align: 'center' },
    );

    return pdf.finish();
  }

  private drawMaterialRow(pdf: PdfBuilder, item: QuoteLineItem): void {
    pdf.tableRow(COLUMNS, [
      { text: item.material_name },
      { text: String(item.units_needed) },
      { text: `${PdfBuilder.formatPrice(item.unit_price_with_margin)} EUR` },
      { text: `${PdfBuilder.formatPrice(item.line_total_ht)} EUR`, bold: true },
    ]);
  }
}
