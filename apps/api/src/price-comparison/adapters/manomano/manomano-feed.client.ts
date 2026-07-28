import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { createGunzip } from 'node:zlib';
import type { Readable } from 'node:stream';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type {
  FeedAvailability,
  FeedProduct,
} from '../../matching/material-product-matcher';
import { CsvRowParser } from './csv-row-parser';

/**
 * Alias de colonnes rencontrés sur les plateformes d'affiliation françaises
 * (Awin, Effiliation, Kwanko). Le premier alias présent dans l'en-tête gagne.
 *
 * ManoMano ne publie pas son flux directement : il transite par la plateforme
 * choisie à l'inscription, et chacune renomme les colonnes. Résoudre par alias
 * évite d'avoir à recoder l'adaptateur si le programme change de plateforme.
 */
const FEED_COLUMNS = {
  externalId: ['aw_product_id', 'product_id', 'id', 'sku', 'reference'],
  title: ['product_name', 'name', 'title', 'nom', 'libelle'],
  price: ['search_price', 'price', 'display_price', 'prix', 'sale_price'],
  currency: ['currency', 'devise', 'curr'],
  url: [
    'aw_deep_link',
    'merchant_deep_link',
    'deep_link',
    'product_url',
    'url',
    'lien',
  ],
  availability: ['in_stock', 'stock_status', 'availability', 'disponibilite'],
  categoryPath: [
    'merchant_category',
    'category_name',
    'categorie',
    'category',
    'category_path',
  ],
  brand: ['brand_name', 'brand', 'marque'],
} as const;

const IN_STOCK_VALUES = new Set([
  '1',
  'true',
  'yes',
  'oui',
  'in stock',
  'instock',
  'in_stock',
  'en stock',
  'available',
  'disponible',
]);

const OUT_OF_STOCK_VALUES = new Set([
  '0',
  'false',
  'no',
  'non',
  'out of stock',
  'outofstock',
  'out_of_stock',
  'rupture',
  'indisponible',
  'unavailable',
]);

const LIMITED_VALUES = new Set([
  'limited',
  'low stock',
  'lowstock',
  'stock limite',
  'stock limité',
  'derniers exemplaires',
  'backorder',
]);

@Injectable()
export class ManoManoFeedClient {
  private readonly logger = new Logger(ManoManoFeedClient.name);
  private readonly feedUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.feedUrl = this.configService.get<string>(
      'priceComparison.manoMano.feedUrl',
      '',
    );
    this.timeoutMs = this.configService.get<number>(
      'priceComparison.manoMano.timeoutMs',
      120000,
    );
  }

  get isConfigured(): boolean {
    return this.feedUrl.length > 0;
  }

  /**
   * Parcourt le flux et pousse chaque produit exploitable dans `onProduct`.
   * Rien n'est accumulé : le flux traverse gunzip puis le parseur CSV et
   * ressort ligne par ligne.
   *
   * @returns le nombre de lignes lues (pas le nombre de produits retenus).
   */
  async streamProducts(
    onProduct: (product: FeedProduct) => void,
  ): Promise<number> {
    const source = await this.openStream();
    const decoder = new StringDecoder('utf8');
    let rows = 0;

    const parser = new CsvRowParser((record) => {
      rows++;
      const product = toFeedProduct(record);
      if (product) {
        onProduct(product);
      }
    });

    for await (const chunk of source) {
      parser.push(decoder.write(chunk as Buffer));
    }
    parser.push(decoder.end());
    parser.end();

    return rows;
  }

  private async openStream(): Promise<Readable> {
    const url = this.feedUrl;
    const raw = /^https?:/i.test(url)
      ? await this.openHttpStream(url)
      : createReadStream(toLocalPath(url));

    // Un flux servi en `.gz` n'est pas décompressé par le transport : axios ne
    // gère que `content-encoding`, pas un fichier dont le nom porte
    // l'extension.
    if (/\.gz(?:\?|$)/i.test(url)) {
      return raw.pipe(createGunzip());
    }
    return raw;
  }

  private async openHttpStream(url: string): Promise<Readable> {
    this.logger.log(`Téléchargement du flux ManoMano depuis ${redact(url)}`);
    const response = await firstValueFrom(
      this.httpService.get<Readable>(url, {
        responseType: 'stream',
        timeout: this.timeoutMs,
      }),
    );
    return response.data;
  }
}

/** `file:///C:/flux.csv` comme `./flux.csv` mènent au même fichier. */
function toLocalPath(url: string): string {
  return /^file:/i.test(url) ? fileURLToPath(url) : url;
}

/** Les URL de flux portent le jeton d'affiliation : il ne doit pas fuir aux logs. */
function redact(url: string): string {
  const queryStart = url.indexOf('?');
  return queryStart < 0 ? url : `${url.slice(0, queryStart)}?…`;
}

function pick(
  record: Record<string, string>,
  aliases: readonly string[],
): string {
  for (const alias of aliases) {
    const value = record[alias];
    if (value != null && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}

/** « 34,90 EUR » comme « 34.90 » donnent 34.9. */
function parsePrice(raw: string): number {
  const numeric = raw
    .replace(/[^\d.,-]/g, '')
    .replace(/\.(?=\d{3}\b)/g, '')
    .replace(',', '.');
  const value = Number.parseFloat(numeric);
  return Number.isFinite(value) ? value : Number.NaN;
}

function parseAvailability(raw: string): FeedAvailability {
  const value = raw.trim().toLowerCase();
  if (value.length === 0) {
    // Colonne absente : un produit listé au flux est réputé vendable. Le
    // marchand reste la source de vérité au moment du clic.
    return 'in_stock';
  }
  if (OUT_OF_STOCK_VALUES.has(value)) {
    return 'out_of_stock';
  }
  if (LIMITED_VALUES.has(value)) {
    return 'limited';
  }
  if (IN_STOCK_VALUES.has(value)) {
    return 'in_stock';
  }
  return 'in_stock';
}

export function toFeedProduct(
  record: Record<string, string>,
): FeedProduct | null {
  const externalId = pick(record, FEED_COLUMNS.externalId);
  const title = pick(record, FEED_COLUMNS.title);
  const productUrl = pick(record, FEED_COLUMNS.url);
  const rawPrice = pick(record, FEED_COLUMNS.price);
  const price = parsePrice(rawPrice);

  // Sans identifiant, titre, lien affilié ou prix exploitable, la ligne ne
  // peut ni être rapprochée ni être tarifée : on la laisse tomber en silence.
  if (!externalId || !title || !productUrl || !(price > 0)) {
    return null;
  }

  const currency = pick(record, FEED_COLUMNS.currency).toUpperCase();

  return {
    external_id: externalId.slice(0, 100),
    title: title.slice(0, 500),
    brand: pick(record, FEED_COLUMNS.brand) || null,
    category_path: pick(record, FEED_COLUMNS.categoryPath),
    price,
    currency: /^[A-Z]{3}$/.test(currency) ? currency : 'EUR',
    product_url: productUrl,
    availability: parseAvailability(pick(record, FEED_COLUMNS.availability)),
  };
}
