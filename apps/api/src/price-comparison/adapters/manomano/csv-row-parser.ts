/**
 * Parseur CSV incrémental (RFC 4180) alimenté par les chunks d'un flux.
 *
 * Les flux produits d'affiliation pèsent plusieurs centaines de Mo une fois
 * décompressés : ils ne peuvent pas être chargés en mémoire, ni découpés
 * naïvement sur `\n` — un champ entre guillemets contient couramment des
 * virgules, des guillemets échappés et des sauts de ligne (les descriptions
 * produit en sont pleines).
 *
 * Écrit à la main plutôt qu'apporté en dépendance : le besoin tient en une
 * machine à états d'une cinquantaine de lignes, entièrement testable, là où
 * `apps/api` maintient volontairement un arbre de dépendances minimal.
 */

const DELIMITER_CANDIDATES = [',', ';', '\t', '|'] as const;

export class CsvRowParser {
  private buffer = '';
  private delimiter: string | null = null;
  private header: string[] | null = null;

  private field = '';
  private row: string[] = [];
  private inQuotes = false;
  private rowStarted = false;

  constructor(
    private readonly onRow: (record: Record<string, string>) => void,
  ) {}

  push(chunk: string): void {
    if (this.delimiter === null) {
      this.buffer += chunk;
      const newlineIndex = this.buffer.indexOf('\n');
      if (newlineIndex < 0) {
        // En-tête incomplet : on attend le chunk suivant pour choisir le
        // séparateur, sans quoi le comptage porterait sur une ligne tronquée.
        return;
      }
      this.delimiter = detectDelimiter(this.buffer.slice(0, newlineIndex));
      const pending = this.buffer;
      this.buffer = '';
      this.consume(pending);
      return;
    }

    this.consume(chunk);
  }

  end(): void {
    if (this.delimiter === null && this.buffer.length > 0) {
      // Flux d'une seule ligne, sans saut de ligne final.
      this.delimiter = detectDelimiter(this.buffer);
      const pending = this.buffer;
      this.buffer = '';
      this.consume(pending);
    }
    if (this.inQuotes || this.field.length > 0 || this.row.length > 0) {
      this.endRow();
    }
  }

  private consume(chunk: string): void {
    const delimiter = this.delimiter as string;

    for (let i = 0; i < chunk.length; i++) {
      const char = chunk[i];

      if (this.inQuotes) {
        if (char === '"') {
          if (chunk[i + 1] === '"') {
            this.field += '"';
            i++;
          } else {
            this.inQuotes = false;
          }
        } else {
          this.field += char;
        }
        continue;
      }

      if (char === '"' && this.field.length === 0) {
        this.inQuotes = true;
        this.rowStarted = true;
        continue;
      }

      if (char === delimiter) {
        this.row.push(this.field);
        this.field = '';
        this.rowStarted = true;
        continue;
      }

      if (char === '\n') {
        this.endRow();
        continue;
      }

      if (char === '\r') {
        continue;
      }

      this.field += char;
      this.rowStarted = true;
    }
  }

  private endRow(): void {
    if (!this.rowStarted && this.field.length === 0 && this.row.length === 0) {
      return;
    }

    this.row.push(this.field);
    const values = this.row;
    this.field = '';
    this.row = [];
    this.inQuotes = false;
    this.rowStarted = false;

    if (this.header === null) {
      this.header = values.map(normalizeHeader);
      return;
    }

    const record: Record<string, string> = {};
    for (let i = 0; i < this.header.length; i++) {
      record[this.header[i]] = values[i] ?? '';
    }
    this.onRow(record);
  }
}

/** Retient le candidat le plus fréquent hors guillemets sur la ligne d'en-tête. */
function detectDelimiter(headerLine: string): string {
  let best = ',';
  let bestCount = 0;

  for (const candidate of DELIMITER_CANDIDATES) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < headerLine.length; i++) {
      const char = headerLine[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes && char === candidate) {
        count++;
      }
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }

  return best;
}

/** `"Search Price"` et `aw_product_id` deviennent `search_price` / `aw_product_id`. */
function normalizeHeader(header: string): string {
  return header
    .replace(/\uFEFF/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
