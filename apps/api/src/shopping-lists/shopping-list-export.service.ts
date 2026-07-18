import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import type { Project } from '../projects/entities/project.entity';
import type {
  ShoppingListData,
  ShoppingListMaterialItem,
  ShoppingListComplementaryItem,
} from './entities/shopping-list.entity';

const CATEGORY_LABELS: Record<string, string> = {
  painting: 'Peinture',
  tiling: 'Carrelage',
  flooring: 'Parquet / Sol',
  partition: 'Cloison',
  wall_covering: 'Revêtement mural',
};

@Injectable()
export class ShoppingListExportService {
  async generatePdf(
    project: Project,
    shoppingListData: ShoppingListData,
  ): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = new PassThrough();
    doc.pipe(stream);

    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));

    // Header
    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('Liste de courses', { align: 'center' });

    doc.moveDown(0.3);
    doc
      .fontSize(14)
      .font('Helvetica')
      .fillColor('#555555')
      .text(project.name, { align: 'center' });

    if (project.room_name) {
      doc.fontSize(11).text(project.room_name, { align: 'center' });
    }

    doc.moveDown(0.3);
    const dateStr = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    doc.fontSize(10).text(dateStr, { align: 'center' });

    doc.fillColor('#000000');

    // Dimensions
    if (project.dimensions) {
      doc.moveDown(0.8);
      this.drawSectionTitle(doc, 'Dimensions de la pièce');
      doc.moveDown(0.3);
      const d = project.dimensions;
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(
          `Longueur : ${d.length_cm} cm  ·  Largeur : ${d.width_cm} cm  ·  Hauteur : ${d.height_cm} cm`,
        );
    }

    // Material items grouped by category
    const materialsByCategory = this.groupByCategory(
      shoppingListData.material_items,
    );

    if (materialsByCategory.length > 0) {
      doc.moveDown(1);
      this.drawSectionTitle(doc, 'Matériaux à acheter');

      for (const [category, items] of materialsByCategory) {
        doc.moveDown(0.6);
        const label = CATEGORY_LABELS[category] || category;
        doc.fontSize(11).font('Helvetica-Bold').text(label);
        doc.moveDown(0.2);

        // Table header
        this.drawTableHeader(doc);

        for (const item of items) {
          this.checkPageBreak(doc, 30);
          this.drawMaterialRow(doc, item);
        }
      }
    }

    // Complementary items
    const activeComplements = shoppingListData.complementary_items.filter(
      (c) => !c.is_removed,
    );

    if (activeComplements.length > 0) {
      doc.moveDown(1);
      this.drawSectionTitle(doc, 'Matériaux complémentaires');
      doc.moveDown(0.3);

      // Table header
      const startX = doc.x;
      const y = doc.y;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#666666');
      doc.text('Article', startX, y, { width: 280 });
      doc.text('Qté', startX + 300, y, { width: 60, align: 'center' });
      doc.text('Unité', startX + 370, y, { width: 80 });
      doc.fillColor('#000000');
      doc.moveDown(0.3);
      this.drawLine(doc);
      doc.moveDown(0.2);

      for (const item of activeComplements) {
        this.checkPageBreak(doc, 25);
        this.drawComplementaryRow(doc, item);
      }
    }

    // Footer
    doc.moveDown(2);
    doc
      .fontSize(8)
      .fillColor('#999999')
      .text(`Généré par Chiffréo — ${dateStr}`, { align: 'center' });

    doc.end();

    return new Promise<Buffer>((resolve, reject) => {
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  private drawSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
    doc.fontSize(13).font('Helvetica-Bold').text(title);
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

  private drawTableHeader(doc: PDFKit.PDFDocument): void {
    const startX = doc.x;
    const y = doc.y;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#666666');
    doc.text('Article', startX, y, { width: 200 });
    doc.text('Type de travaux', startX + 210, y, { width: 120 });
    doc.text('Qté', startX + 340, y, { width: 40, align: 'center' });
    doc.text('Conditionnement', startX + 390, y, { width: 105 });
    doc.fillColor('#000000');
    doc.moveDown(0.3);
    this.drawLine(doc);
    doc.moveDown(0.2);
  }

  private drawMaterialRow(
    doc: PDFKit.PDFDocument,
    item: ShoppingListMaterialItem,
  ): void {
    const startX = doc.x;
    const y = doc.y;
    doc.fontSize(9).font('Helvetica');
    doc.text(item.material_name, startX, y, { width: 200 });
    doc.text(item.work_type_label, startX + 210, y, { width: 120 });
    doc
      .font('Helvetica-Bold')
      .text(String(item.units_needed), startX + 340, y, {
        width: 40,
        align: 'center',
      });
    doc
      .font('Helvetica')
      .text(item.packaging_label, startX + 390, y, { width: 105 });
    doc.moveDown(0.4);
  }

  private drawComplementaryRow(
    doc: PDFKit.PDFDocument,
    item: ShoppingListComplementaryItem,
  ): void {
    const startX = doc.x;
    const y = doc.y;
    doc.fontSize(9).font('Helvetica');
    const name = item.is_calculated ? `${item.name} (estimé)` : item.name;
    doc.text(name, startX, y, { width: 280 });
    doc.font('Helvetica-Bold').text(String(item.quantity), startX + 300, y, {
      width: 60,
      align: 'center',
    });
    doc.font('Helvetica').text(item.unit_label, startX + 370, y, { width: 80 });
    doc.moveDown(0.4);
  }

  private checkPageBreak(doc: PDFKit.PDFDocument, needed: number): void {
    if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
  }

  private groupByCategory(
    items: ShoppingListMaterialItem[],
  ): [string, ShoppingListMaterialItem[]][] {
    const map = new Map<string, ShoppingListMaterialItem[]>();
    for (const item of items) {
      const existing = map.get(item.material_category);
      if (existing) {
        existing.push(item);
      } else {
        map.set(item.material_category, [item]);
      }
    }
    return Array.from(map.entries());
  }
}
