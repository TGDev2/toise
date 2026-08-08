import { Injectable } from '@nestjs/common';
import type {
  Quote,
  QuoteLineItem,
  QuoteLaborLine,
} from './entities/quote.entity';
import type { CompanyProfile } from '../company-profiles/entities/company-profile.entity';
import type { Client } from '../clients/entities/client.entity';
import { PdfBuilder, type PdfColumn } from '../common/pdf/pdf-builder';
import { round2 } from '../common/round2';
import { pickJustification } from '../materials/render-justification';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  refused: 'Refusé',
  negotiation: 'En négociation',
};

const COLUMNS: PdfColumn[] = [
  { label: 'Désignation', offset: 0, width: 200 },
  { label: 'Qté', offset: 210, width: 40, align: 'center' },
  { label: 'PU HT', offset: 260, width: 80, align: 'right' },
  { label: 'Total HT', offset: 360, width: 85, align: 'right' },
];

// Mêmes offsets que COLUMNS : les deux tableaux s'alignent verticalement et se
// lisent comme un seul document.
const LABOR_COLUMNS: PdfColumn[] = [
  { label: 'Ouvrage', offset: 0, width: 200 },
  { label: 'Qté', offset: 210, width: 40, align: 'center' },
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
      doc.text(`Tél : ${companyProfile.phone}`, pdf.left, doc.y);
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
        doc.text(`Tél : ${client.phone}`, clientX, clientY);
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
    pdf.text(`Valable jusqu’au : ${PdfBuilder.formatDate(validityDate)}`, {
      align: 'center',
    });
    pdf.text(`Statut : ${STATUS_LABELS[quote.status] ?? quote.status}`, {
      align: 'center',
    });

    doc.fillColor('#000000');

    // ── Materials table ──
    // E1-11 : optionnel, désactivé par défaut (`quote.show_material_details`)
    // — détailler les fournitures ligne à ligne expose la marge de l'artisan
    // sur les matériaux. Masqué, le bloc totaux fond le sous-total matériaux
    // dans le total plutôt que d'afficher un sous-total vide.
    if (quote.show_material_details) {
      doc.moveDown(1);
      pdf.sectionTitle('Détail des matériaux');
      doc.moveDown(0.3);
      pdf.tableHeader(COLUMNS);

      for (const item of quote.items_json) {
        pdf.checkPageBreak(quote.show_material_justifications ? 55 : 30);
        this.drawMaterialRow(pdf, item);
        if (quote.show_material_justifications) {
          this.drawJustification(
            pdf,
            item,
            companyProfile.show_material_brands,
          );
        }
      }
    }

    // ── Labor table ──
    doc.moveDown(0.8);
    // Titre + hr + en-tête + 1 ligne : jamais orphelins en bas de page.
    pdf.checkPageBreak(70);
    pdf.sectionTitle('Main-d’œuvre');
    doc.moveDown(0.3);

    if (quote.labor_items_json.length === 0) {
      doc.fontSize(9).font('Helvetica').fillColor('#666666');
      pdf.text('Aucune main-d’œuvre chiffrée.');
      doc.fillColor('#000000');
    } else {
      pdf.tableHeader(LABOR_COLUMNS);
      for (const line of quote.labor_items_json) {
        // 40 et non 30 (comme les matériaux) : la désignation, augmentée du
        // détail ouvrage/surface, tient plus souvent sur 2 lignes.
        pdf.checkPageBreak(40);
        this.drawLaborRow(pdf, line);
      }
    }

    // ── Totals block ──
    doc.moveDown(1);
    // 6 lignes de totaux ~14-17 pt + la règle : un bloc coupé entre deux
    // lignes est le seul saut de page qu'un client remarque.
    pdf.checkPageBreak(140);
    pdf.hr();
    doc.moveDown(0.5);

    if (quote.show_material_details) {
      pdf.totalsRow(
        'Sous-total matériaux HT',
        `${PdfBuilder.formatPrice(Number(quote.subtotal_materials_ht))} EUR`,
      );
      pdf.totalsRow(
        'Sous-total main-d’œuvre HT',
        `${PdfBuilder.formatPrice(Number(quote.subtotal_labor_ht))} EUR`,
      );
    }

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
      pdf.sectionTitle('Conditions de règlement');
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
      `SIRET : ${companyProfile.siret} — Généré par Chiffréo — ${dateStr}`,
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

  /**
   * E1-11 — la justification d'une ligne, sous cette ligne. Le réglage
   * marques est lu ici, jamais recomposé : `pickJustification` ne fait que
   * choisir laquelle des deux phrases déjà écrites imprimer.
   */
  private drawJustification(
    pdf: PdfBuilder,
    item: QuoteLineItem,
    showBrands: boolean,
  ): void {
    const { justification_fr } = pickJustification(
      item.justification,
      showBrands,
    );
    if (!justification_fr) return;
    pdf.doc.fontSize(8).font('Helvetica').fillColor('#666666');
    pdf.text(justification_fr);
    pdf.doc.fillColor('#000000');
    pdf.doc.moveDown(0.2);
  }

  private drawLaborRow(pdf: PdfBuilder, line: QuoteLaborLine): void {
    const room = line.room_name ? ` — ${line.room_name}` : '';
    // Le temps unitaire n'est pas persisté (cf. quote.entity.ts) : il se
    // dérive ici pour l'affichage, jamais l'inverse.
    const detail =
      line.kind === 'flat'
        ? ' (forfait)'
        : line.surface_m2
          ? ` (${line.surface_m2} m² x ${round2((line.quantity * 60) / line.surface_m2)} min/m²)`
          : '';
    pdf.tableRow(LABOR_COLUMNS, [
      { text: `${line.label}${room}${detail}` },
      { text: line.kind === 'flat' ? '1' : `${line.quantity} h` },
      {
        text:
          line.kind === 'flat'
            ? `${PdfBuilder.formatPrice(line.unit_price_ht)} EUR`
            : `${PdfBuilder.formatPrice(line.unit_price_ht)} EUR/h`,
      },
      { text: `${PdfBuilder.formatPrice(line.line_total_ht)} EUR`, bold: true },
    ]);
  }
}
