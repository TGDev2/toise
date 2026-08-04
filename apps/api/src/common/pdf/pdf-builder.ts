import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

export interface PdfColumn {
  label: string;
  /** Décalage horizontal depuis la marge gauche. */
  offset: number;
  width: number;
  align?: 'left' | 'center' | 'right';
}

export interface PdfCell {
  text: string;
  bold?: boolean;
}

const MARGIN = 50;

/**
 * Fabrique de documents PDF partagée par le devis et la facture (PRO-4).
 *
 * Elle existe pour deux raisons :
 *
 * 1. **Cohérence.** La facture doit rester le frère jumeau du devis (même
 *    en-tête, même tableau, même bloc de totaux) ; deux implémentations
 *    parallèles divergent en une release.
 *
 * 2. **Discipline de curseur.** PDFKit laisse `doc.x` sur la dernière abscisse
 *    écrite : après un bloc positionné à droite (l'encadré client), tout le
 *    contenu suivant dérivait vers la droite et sortait de la page — bug réel du
 *    PDF de devis, corrigé ici à la racine. Chaque méthode repart donc
 *    explicitement de la marge gauche plutôt que de lire `doc.x`.
 *
 * `shopping-list-export.service.ts` n'est volontairement pas migré dessus : c'est
 * un autre document (regroupement par catégorie, lignes complémentaires) dont le
 * recouvrement avec celui-ci est superficiel.
 */
export class PdfBuilder {
  readonly doc: PDFKit.PDFDocument;
  readonly left = MARGIN;
  readonly contentWidth: number;

  private readonly stream = new PassThrough();
  private readonly chunks: Buffer[] = [];

  constructor() {
    this.doc = new PDFDocument({ size: 'A4', margin: MARGIN });
    this.contentWidth = this.doc.page.width - MARGIN * 2;
    this.doc.pipe(this.stream);
    this.stream.on('data', (chunk: Buffer) => this.chunks.push(chunk));
  }

  /** Ramène le curseur à la marge gauche — à appeler après tout bloc positionné. */
  resetX(): this {
    this.doc.x = this.left;
    return this;
  }

  /** Texte pleine largeur depuis la marge gauche. */
  text(value: string, options: PDFKit.Mixins.TextOptions = {}): this {
    this.doc.text(value, this.left, this.doc.y, {
      width: this.contentWidth,
      ...options,
    });
    return this.resetX();
  }

  sectionTitle(title: string): this {
    this.doc.fontSize(13).font('Helvetica-Bold').fillColor('#000000');
    this.text(title);
    this.doc.moveDown(0.1);
    return this.hr();
  }

  hr(): this {
    const y = this.doc.y;
    this.doc
      .strokeColor('#CCCCCC')
      .lineWidth(0.5)
      .moveTo(this.left, y)
      .lineTo(this.left + this.contentWidth, y)
      .stroke();
    return this;
  }

  tableHeader(columns: PdfColumn[]): this {
    const y = this.doc.y;
    this.doc.fontSize(8).font('Helvetica-Bold').fillColor('#666666');
    for (const col of columns) {
      this.doc.text(col.label, this.left + col.offset, y, {
        width: col.width,
        align: col.align ?? 'left',
      });
    }
    this.doc.fillColor('#000000');
    this.doc.y = y + 12;
    this.resetX();
    this.hr();
    this.doc.moveDown(0.2);
    return this.resetX();
  }

  /**
   * Une ligne de tableau. La hauteur est celle de la cellule la plus haute :
   * une désignation qui passe à la ligne ne chevauche donc pas la ligne suivante.
   */
  tableRow(columns: PdfColumn[], cells: PdfCell[]): this {
    const y = this.doc.y;
    let height = 0;

    columns.forEach((col, i) => {
      const cell = cells[i];
      if (!cell) return;
      this.doc
        .fontSize(9)
        .font(cell.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor('#000000');
      height = Math.max(
        height,
        this.doc.heightOfString(cell.text, { width: col.width }),
      );
      this.doc.text(cell.text, this.left + col.offset, y, {
        width: col.width,
        align: col.align ?? 'left',
      });
    });

    this.doc.y = y + height;
    this.doc.moveDown(0.4);
    return this.resetX();
  }

  /**
   * Ligne libellé/montant du bloc de totaux, aligné à droite de la page.
   *
   * Hauteur dérivée de `heightOfString`, comme `tableRow` : un libellé qui
   * passe à la ligne (« Sous-total main d'oeuvre HT » sur 120 pt de large)
   * ne chevauchait plus la ligne de totaux suivante autrement.
   */
  totalsRow(
    label: string,
    value: string,
    options: { bold?: boolean; size?: number } = {},
  ): this {
    const size = options.size ?? 10;
    const labelX = this.left + 250;
    const valueX = this.left + 380;
    const labelWidth = valueX - labelX - 10;
    const valueWidth = this.left + this.contentWidth - valueX;
    const y = this.doc.y;

    this.doc
      .fontSize(size)
      .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor('#000000');
    const height = Math.max(
      this.doc.heightOfString(label, { width: labelWidth }),
      size + 4,
    );
    this.doc.text(label, labelX, y, { width: labelWidth });
    this.doc.text(value, valueX, y, { width: valueWidth, align: 'right' });

    this.doc.y = y + height;
    return this.resetX();
  }

  checkPageBreak(needed: number): this {
    const { height, margins } = this.doc.page;
    if (this.doc.y + needed > height - margins.bottom) {
      this.doc.addPage();
      this.resetX();
    }
    return this;
  }

  async finish(): Promise<Buffer> {
    this.doc.end();
    return new Promise<Buffer>((resolve, reject) => {
      this.stream.on('end', () => resolve(Buffer.concat(this.chunks)));
      this.stream.on('error', reject);
    });
  }

  /** Format monétaire français, sans symbole (les services impriment « EUR »). */
  static formatPrice(value: number): string {
    return (Number(value) || 0).toFixed(2).replace('.', ',');
  }

  static formatDate(value: Date | string): string {
    return new Date(value).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }
}
