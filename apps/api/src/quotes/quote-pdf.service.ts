import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { LaborType } from './entities/quote.entity';
import type { Quote, QuoteLineItem } from './entities/quote.entity';
import type { CompanyProfile } from '../company-profiles/entities/company-profile.entity';
import type { Client } from '../clients/entities/client.entity';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  refused: 'Refusé',
  negotiation: 'En négociation',
};

@Injectable()
export class QuotePdfService {
  async generatePdf(
    quote: Quote,
    companyProfile: CompanyProfile,
    client: Client | null,
  ): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = new PassThrough();
    doc.pipe(stream);

    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));

    // ── Company header (top-left) ──
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(companyProfile.raison_sociale, 50, 50);

    doc.fontSize(9).font('Helvetica').fillColor('#444444');
    doc.text(companyProfile.address_line1, 50, doc.y + 4);
    if (companyProfile.address_line2) {
      doc.text(companyProfile.address_line2);
    }
    doc.text(`${companyProfile.postal_code} ${companyProfile.city}`);
    if (companyProfile.phone) {
      doc.text(`Tel : ${companyProfile.phone}`);
    }
    doc.text(`SIRET : ${companyProfile.siret}`);

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
    const metaY = Math.max(doc.y, 160);
    doc.y = metaY;
    doc.moveDown(1.5);

    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(`DEVIS N° ${quote.quote_number}`, { align: 'center' });

    doc.moveDown(0.3);
    const dateStr = new Date(quote.created_at).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    doc.fontSize(10).font('Helvetica').fillColor('#555555');
    doc.text(`Date : ${dateStr}`, { align: 'center' });

    const validityDate = new Date(quote.created_at);
    validityDate.setDate(validityDate.getDate() + quote.validity_days);
    const validityStr = validityDate.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    doc.text(`Valable jusqu'au : ${validityStr}`, { align: 'center' });
    doc.text(`Statut : ${STATUS_LABELS[quote.status] ?? quote.status}`, {
      align: 'center',
    });

    doc.fillColor('#000000');

    // ── Materials table ──
    doc.moveDown(1);
    this.drawSectionTitle(doc, 'Detail des materiaux');
    doc.moveDown(0.3);

    // Table header
    this.drawMaterialTableHeader(doc);

    for (const item of quote.items_json) {
      this.checkPageBreak(doc, 30);
      this.drawMaterialRow(doc, item);
    }

    // ── Labor section ──
    doc.moveDown(0.8);
    this.drawSectionTitle(doc, "Main d'oeuvre");
    doc.moveDown(0.3);

    doc.fontSize(10).font('Helvetica');
    if (quote.labor_type === LaborType.HOURLY) {
      const rate = Number(quote.labor_hourly_rate) || 0;
      const hours = Number(quote.labor_estimated_hours) || 0;
      doc.text(
        `${hours} h x ${this.formatPrice(rate)} EUR/h = ${this.formatPrice(rate * hours)} EUR HT`,
      );
    } else {
      const amount = Number(quote.labor_flat_amount) || 0;
      doc.text(`Forfait : ${this.formatPrice(amount)} EUR HT`);
    }

    // ── Totals block ──
    doc.moveDown(1);
    this.drawLine(doc);
    doc.moveDown(0.5);

    const totalsX = 300;
    const valuesX = 430;

    doc.fontSize(10).font('Helvetica');
    doc.text('Sous-total materiaux HT', totalsX, doc.y);
    doc.text(
      `${this.formatPrice(Number(quote.subtotal_materials_ht))} EUR`,
      valuesX,
      doc.y - 12,
      { width: 115, align: 'right' },
    );

    doc.moveDown(0.3);
    doc.text("Sous-total main d'oeuvre HT", totalsX, doc.y);
    doc.text(
      `${this.formatPrice(Number(quote.subtotal_labor_ht))} EUR`,
      valuesX,
      doc.y - 12,
      { width: 115, align: 'right' },
    );

    const discountPercent = Number(quote.discount_percent) || 0;
    if (discountPercent > 0) {
      doc.moveDown(0.3);
      doc.text(`Remise (${discountPercent} %)`, totalsX, doc.y);
      const discountAmount =
        (Number(quote.subtotal_materials_ht) +
          Number(quote.subtotal_labor_ht)) *
        (discountPercent / 100);
      doc.text(
        `-${this.formatPrice(discountAmount)} EUR`,
        valuesX,
        doc.y - 12,
        { width: 115, align: 'right' },
      );
    }

    doc.moveDown(0.3);
    doc.font('Helvetica-Bold');
    doc.text('Total HT', totalsX, doc.y);
    doc.text(
      `${this.formatPrice(Number(quote.total_ht))} EUR`,
      valuesX,
      doc.y - 12,
      { width: 115, align: 'right' },
    );

    doc.moveDown(0.3);
    doc.font('Helvetica');
    doc.text(`TVA (${Number(quote.tva_rate)} %)`, totalsX, doc.y);
    const tvaAmount = Number(quote.total_ttc) - Number(quote.total_ht);
    doc.text(`${this.formatPrice(tvaAmount)} EUR`, valuesX, doc.y - 12, {
      width: 115,
      align: 'right',
    });

    doc.moveDown(0.5);
    doc.fontSize(13).font('Helvetica-Bold');
    doc.text('Total TTC', totalsX, doc.y);
    doc.text(
      `${this.formatPrice(Number(quote.total_ttc))} EUR`,
      valuesX,
      doc.y - 15,
      { width: 115, align: 'right' },
    );

    // ── Payment terms ──
    if (quote.payment_terms) {
      doc.moveDown(1.5);
      this.drawSectionTitle(doc, 'Conditions de reglement');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').text(quote.payment_terms);
    }

    // ── Notes ──
    if (quote.notes) {
      doc.moveDown(0.8);
      this.drawSectionTitle(doc, 'Notes');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').text(quote.notes);
    }

    // ── Footer ──
    doc.moveDown(2);
    doc
      .fontSize(8)
      .fillColor('#999999')
      .text(
        `SIRET : ${companyProfile.siret} — Genere par Chiffréo — ${dateStr}`,
        { align: 'center' },
      );

    doc.end();

    return new Promise<Buffer>((resolve, reject) => {
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  private drawSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#000000').text(title);
    doc.moveDown(0.1);
    this.drawLine(doc);
  }

  private drawLine(doc: PDFKit.PDFDocument): void {
    const x = doc.x;
    const y = doc.y;
    doc
      .strokeColor('#CCCCCC')
      .lineWidth(0.5)
      .moveTo(x, y)
      .lineTo(x + 495, y)
      .stroke();
  }

  private drawMaterialTableHeader(doc: PDFKit.PDFDocument): void {
    const startX = doc.x;
    const y = doc.y;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#666666');
    doc.text('Designation', startX, y, { width: 200 });
    doc.text('Qte', startX + 210, y, { width: 40, align: 'center' });
    doc.text('PU HT', startX + 260, y, { width: 80, align: 'right' });
    doc.text('Total HT', startX + 360, y, { width: 85, align: 'right' });
    doc.fillColor('#000000');
    doc.moveDown(0.3);
    this.drawLine(doc);
    doc.moveDown(0.2);
  }

  private drawMaterialRow(doc: PDFKit.PDFDocument, item: QuoteLineItem): void {
    const startX = doc.x;
    const y = doc.y;
    doc.fontSize(9).font('Helvetica').fillColor('#000000');
    doc.text(item.material_name, startX, y, { width: 200 });
    doc.text(String(item.units_needed), startX + 210, y, {
      width: 40,
      align: 'center',
    });
    doc.text(
      `${this.formatPrice(item.unit_price_with_margin)} EUR`,
      startX + 260,
      y,
      { width: 80, align: 'right' },
    );
    doc
      .font('Helvetica-Bold')
      .text(`${this.formatPrice(item.line_total_ht)} EUR`, startX + 360, y, {
        width: 85,
        align: 'right',
      });
    doc.moveDown(0.4);
  }

  private checkPageBreak(doc: PDFKit.PDFDocument, needed: number): void {
    if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
  }

  private formatPrice(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }
}
