import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { Readable } from 'node:stream';
import { of } from 'rxjs';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import type { FeedProduct } from '../../matching/material-product-matcher';
import { ManoManoFeedClient, toFeedProduct } from './manomano-feed.client';

const httpServiceMock = {
  get: jest.fn(),
};

function makeConfigMock(overrides: Record<string, unknown> = {}) {
  const map: Record<string, unknown> = {
    'priceComparison.manoMano.feedUrl': '',
    'priceComparison.manoMano.timeoutMs': 120000,
    ...overrides,
  };
  return {
    get: jest.fn(
      (key: string, defaultValue?: unknown) => map[key] ?? defaultValue,
    ),
  };
}

async function createClient(
  configOverrides: Record<string, unknown> = {},
): Promise<ManoManoFeedClient> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ManoManoFeedClient,
      { provide: HttpService, useValue: httpServiceMock },
      { provide: ConfigService, useValue: makeConfigMock(configOverrides) },
    ],
  }).compile();

  return module.get(ManoManoFeedClient);
}

const AWIN_CSV = [
  'aw_product_id,product_name,search_price,currency,aw_deep_link,in_stock,merchant_category,brand_name',
  '1001,"Peinture acrylique satinée blanche 2,5 L",34.90,EUR,https://mano.example/aff/1001,1,Peinture > Murale,Dulux',
  '1002,"Mortier-colle C2 25 kg",19.90,EUR,https://mano.example/aff/1002,0,Carrelage,Weber',
].join('\n');

describe('toFeedProduct', () => {
  const base = {
    aw_product_id: '1001',
    product_name: 'Peinture 2,5 L',
    search_price: '34.90',
    aw_deep_link: 'https://mano.example/aff/1001',
  };

  it('maps the Awin column names', () => {
    expect(toFeedProduct({ ...base, currency: 'eur', in_stock: '1' })).toEqual({
      external_id: '1001',
      title: 'Peinture 2,5 L',
      brand: null,
      category_path: '',
      price: 34.9,
      currency: 'EUR',
      product_url: 'https://mano.example/aff/1001',
      availability: 'in_stock',
    });
  });

  it('maps alternative column names from another platform', () => {
    const product = toFeedProduct({
      product_id: '2002',
      title: 'Colle 5 kg',
      prix: '12,50',
      url: 'https://mano.example/aff/2002',
      disponibilite: 'rupture',
      categorie: 'Carrelage',
      marque: 'Weber',
    });

    expect(product).toMatchObject({
      external_id: '2002',
      title: 'Colle 5 kg',
      price: 12.5,
      brand: 'Weber',
      category_path: 'Carrelage',
      availability: 'out_of_stock',
    });
  });

  it('parses a French price with a currency suffix', () => {
    expect(
      toFeedProduct({ ...base, search_price: '1 234,50 EUR' })?.price,
    ).toBe(1234.5);
  });

  it('defaults to EUR when the currency column is absent or invalid', () => {
    expect(toFeedProduct(base)?.currency).toBe('EUR');
    expect(toFeedProduct({ ...base, currency: 'euros' })?.currency).toBe('EUR');
  });

  it('maps the availability vocabulary', () => {
    const availability = (value: string) =>
      toFeedProduct({ ...base, in_stock: value })?.availability;

    expect(availability('1')).toBe('in_stock');
    expect(availability('en stock')).toBe('in_stock');
    expect(availability('0')).toBe('out_of_stock');
    expect(availability('indisponible')).toBe('out_of_stock');
    expect(availability('limited')).toBe('limited');
    // Colonne absente : un produit listé au flux est réputé vendable.
    expect(availability('')).toBe('in_stock');
  });

  it('drops rows that cannot be priced or linked', () => {
    expect(toFeedProduct({ ...base, aw_product_id: '' })).toBeNull();
    expect(toFeedProduct({ ...base, product_name: '' })).toBeNull();
    expect(toFeedProduct({ ...base, aw_deep_link: '' })).toBeNull();
    expect(toFeedProduct({ ...base, search_price: '0' })).toBeNull();
    expect(toFeedProduct({ ...base, search_price: 'sur devis' })).toBeNull();
  });
});

describe('ManoManoFeedClient', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'manomano-feed-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports whether a feed URL is configured', async () => {
    expect((await createClient()).isConfigured).toBe(false);
    expect(
      (
        await createClient({
          'priceComparison.manoMano.feedUrl': 'https://example.fr/feed.csv',
        })
      ).isConfigured,
    ).toBe(true);
  });

  it('streams products from a local file path', async () => {
    const path = join(dir, 'feed.csv');
    writeFileSync(path, AWIN_CSV, 'utf8');
    const client = await createClient({
      'priceComparison.manoMano.feedUrl': path,
    });

    const products: FeedProduct[] = [];
    const rows = await client.streamProducts((p) => products.push(p));

    expect(rows).toBe(2);
    expect(products).toHaveLength(2);
    expect(products[0]).toMatchObject({
      external_id: '1001',
      title: 'Peinture acrylique satinée blanche 2,5 L',
      price: 34.9,
      brand: 'Dulux',
      category_path: 'Peinture > Murale',
      availability: 'in_stock',
    });
    expect(products[1].availability).toBe('out_of_stock');
    expect(httpServiceMock.get).not.toHaveBeenCalled();
  });

  it('accepts a file:// URL', async () => {
    const path = join(dir, 'feed-url.csv');
    writeFileSync(path, AWIN_CSV, 'utf8');
    const client = await createClient({
      'priceComparison.manoMano.feedUrl': pathToFileURL(path).href,
    });

    const products: FeedProduct[] = [];
    await client.streamProducts((p) => products.push(p));
    expect(products).toHaveLength(2);
  });

  it('gunzips a .gz feed', async () => {
    const path = join(dir, 'feed.csv.gz');
    writeFileSync(path, gzipSync(Buffer.from(AWIN_CSV, 'utf8')));
    const client = await createClient({
      'priceComparison.manoMano.feedUrl': path,
    });

    const products: FeedProduct[] = [];
    await client.streamProducts((p) => products.push(p));
    expect(products.map((p) => p.external_id)).toEqual(['1001', '1002']);
  });

  it('downloads an http feed as a stream', async () => {
    httpServiceMock.get.mockReturnValue(
      of({ data: Readable.from([Buffer.from(AWIN_CSV, 'utf8')]) }),
    );
    const client = await createClient({
      'priceComparison.manoMano.feedUrl':
        'https://feed.example.fr/manomano.csv?token=secret',
      'priceComparison.manoMano.timeoutMs': 5000,
    });

    const products: FeedProduct[] = [];
    await client.streamProducts((p) => products.push(p));

    expect(products).toHaveLength(2);
    expect(httpServiceMock.get).toHaveBeenCalledWith(
      'https://feed.example.fr/manomano.csv?token=secret',
      expect.objectContaining({ responseType: 'stream', timeout: 5000 }),
    );
  });

  it('reassembles multi-byte characters split across chunks', async () => {
    // « é » est encodé sur deux octets : une coupure entre les deux ne doit
    // pas produire de caractère de remplacement.
    const csv = 'id,name,price,url\n1,"Peinture satinée",10,https://x.fr/1\n';
    const bytes = Buffer.from(csv, 'utf8');
    httpServiceMock.get.mockReturnValue(
      of({
        data: Readable.from(
          Array.from({ length: bytes.length }, (_, i) =>
            bytes.subarray(i, i + 1),
          ),
        ),
      }),
    );
    const client = await createClient({
      'priceComparison.manoMano.feedUrl': 'https://feed.example.fr/f.csv',
    });

    const products: FeedProduct[] = [];
    await client.streamProducts((p) => products.push(p));
    expect(products[0].title).toBe('Peinture satinée');
  });
});
