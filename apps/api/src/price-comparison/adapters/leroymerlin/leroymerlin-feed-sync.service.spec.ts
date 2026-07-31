import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MaterialCatalog } from '../../../materials/entities/material-catalog.entity';
import { SupplierMaterialMatch } from '../../entities/supplier-material-match.entity';
import type { FeedProduct } from '../../matching/material-product-matcher';
import { LeroyMerlinFeedClient } from './leroymerlin-feed.client';
import { LeroyMerlinFeedSyncService } from './leroymerlin-feed-sync.service';

const insertBuilder = {
  insert: jest.fn().mockReturnThis(),
  into: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  orUpdate: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({}),
};

const matchRepoMock = {
  find: jest.fn(),
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(() => insertBuilder),
};

const materialRepoMock = {
  find: jest.fn(),
};

const feedClientMock = {
  isConfigured: true,
  streamProducts: jest.fn(),
};

const MATERIALS = [
  {
    id: 'mat-satin',
    name: 'Peinture acrylique satinée',
    category: 'painting',
    unit: 'L',
  },
  {
    id: 'mat-mortier',
    name: 'Mortier-colle flexible (C2)',
    category: 'tiling',
    unit: 'kg',
  },
];

const FEED: FeedProduct[] = [
  {
    external_id: 'LM-1',
    title: 'Peinture acrylique satinée blanche 2,5 L',
    brand: 'Luxens',
    category_path: 'Peinture',
    price: 32.9,
    currency: 'EUR',
    product_url: 'https://leroymerlin.example/aff/1',
    availability: 'in_stock',
  },
  {
    external_id: 'LM-2',
    title: 'Mortier-colle flexible C2 25 kg',
    brand: 'Weber',
    category_path: 'Carrelage',
    price: 17.9,
    currency: 'EUR',
    product_url: 'https://leroymerlin.example/aff/2',
    availability: 'in_stock',
  },
  {
    external_id: 'LM-3',
    title: 'Tondeuse thermique 46 cm',
    brand: null,
    category_path: 'Jardin',
    price: 229,
    currency: 'EUR',
    product_url: 'https://leroymerlin.example/aff/3',
    availability: 'in_stock',
  },
];

function makeConfigMock(overrides: Record<string, unknown> = {}) {
  const map: Record<string, unknown> = {
    'priceComparison.leroyMerlin.enabled': true,
    'priceComparison.leroyMerlin.feedTtlHours': 24,
    ...overrides,
  };
  return {
    get: jest.fn(
      (key: string, defaultValue?: unknown) => map[key] ?? defaultValue,
    ),
  };
}

async function createService(
  configOverrides: Record<string, unknown> = {},
): Promise<LeroyMerlinFeedSyncService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      LeroyMerlinFeedSyncService,
      {
        provide: getRepositoryToken(SupplierMaterialMatch),
        useValue: matchRepoMock,
      },
      {
        provide: getRepositoryToken(MaterialCatalog),
        useValue: materialRepoMock,
      },
      { provide: LeroyMerlinFeedClient, useValue: feedClientMock },
      { provide: ConfigService, useValue: makeConfigMock(configOverrides) },
    ],
  }).compile();

  return module.get(LeroyMerlinFeedSyncService);
}

/** Dernier tableau de lignes passé à `.values()`. */
function insertedRows(): Record<string, unknown>[] {
  const calls = insertBuilder.values.mock.calls as unknown as [
    Record<string, unknown>[],
  ][];
  return calls.at(-1)?.[0] ?? [];
}

describe('LeroyMerlinFeedSyncService.sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    feedClientMock.isConfigured = true;
    materialRepoMock.find.mockResolvedValue(MATERIALS);
    matchRepoMock.find.mockResolvedValue([]);
    feedClientMock.streamProducts.mockImplementation(
      (onProduct: (p: FeedProduct) => void) => {
        FEED.forEach(onProduct);
        return Promise.resolve(FEED.length);
      },
    );
  });

  it('persists one row per matched material and skips the rest of the feed', async () => {
    const service = await createService();

    const written = await service.sync();

    expect(written).toBe(2);
    const rows = insertedRows();
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          supplier_key: 'leroymerlin',
          material_id: 'mat-satin',
          external_id: 'LM-1',
          price: 32.9,
          currency: 'EUR',
          pack_qty: 2.5,
          pack_unit: 'L',
          availability: 'in_stock',
          is_pinned: false,
        }),
        expect.objectContaining({
          material_id: 'mat-mortier',
          external_id: 'LM-2',
          pack_qty: 25,
          pack_unit: 'kg',
        }),
      ]),
    );
  });

  it('refreshes existing rows instead of ignoring them', async () => {
    const service = await createService();
    await service.sync();

    expect(insertBuilder.orUpdate).toHaveBeenCalledWith(
      expect.arrayContaining(['price', 'matched_at', 'product_url']),
      ['supplier_key', 'material_id'],
    );
  });

  it('never overwrites a manually pinned match', async () => {
    matchRepoMock.find.mockImplementation(
      (options: { where?: { is_pinned?: boolean } }) =>
        Promise.resolve(
          options.where?.is_pinned ? [{ material_id: 'mat-satin' }] : [],
        ),
    );
    const service = await createService();

    const written = await service.sync();

    expect(written).toBe(1);
    expect(insertedRows().map((row) => row.material_id)).toEqual([
      'mat-mortier',
    ]);
  });

  it('drops matches that the feed no longer supports', async () => {
    const service = await createService();
    await service.sync();

    expect(insertBuilder.delete).toHaveBeenCalled();
    expect(insertBuilder.andWhere).toHaveBeenCalledWith(
      'material_id NOT IN (:...keptIds)',
      {
        keptIds: expect.arrayContaining([
          'mat-satin',
          'mat-mortier',
        ]) as string[],
      },
    );
  });

  it('does nothing when no feed URL is configured', async () => {
    feedClientMock.isConfigured = false;
    const service = await createService();

    expect(await service.sync()).toBe(0);
    expect(feedClientMock.streamProducts).not.toHaveBeenCalled();
  });

  it('does not write when the catalog is empty', async () => {
    materialRepoMock.find.mockResolvedValue([]);
    const service = await createService();

    expect(await service.sync()).toBe(0);
    expect(feedClientMock.streamProducts).not.toHaveBeenCalled();
  });

  it('releases the lock when the feed fails, so the next attempt can run', async () => {
    feedClientMock.streamProducts.mockRejectedValueOnce(new Error('502'));
    const service = await createService();

    await expect(service.sync()).rejects.toThrow('502');

    feedClientMock.streamProducts.mockImplementation(
      (onProduct: (p: FeedProduct) => void) => {
        FEED.forEach(onProduct);
        return Promise.resolve(FEED.length);
      },
    );
    expect(await service.sync()).toBe(2);
  });

  it('refuses a concurrent sync', async () => {
    let release: (() => void) | undefined;
    feedClientMock.streamProducts.mockImplementationOnce(
      () => new Promise<number>((resolve) => (release = () => resolve(0))),
    );
    const service = await createService();

    const first = service.sync();
    await new Promise((resolve) => setImmediate(resolve));
    expect(feedClientMock.streamProducts).toHaveBeenCalledTimes(1);

    // Le second appel doit rendre la main immédiatement, sans relire le flux.
    expect(await service.sync()).toBe(0);
    expect(feedClientMock.streamProducts).toHaveBeenCalledTimes(1);

    release?.();
    await first;
  });
});

describe('LeroyMerlinFeedSyncService.onModuleInit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    feedClientMock.isConfigured = true;
    materialRepoMock.find.mockResolvedValue(MATERIALS);
    matchRepoMock.find.mockResolvedValue([]);
  });

  it('stays inert when the adapter is disabled', async () => {
    const service = await createService({
      'priceComparison.leroyMerlin.enabled': false,
    });

    service.onModuleInit();
    await Promise.resolve();

    expect(matchRepoMock.findOne).not.toHaveBeenCalled();
  });

  it('syncs at boot when the index is empty', async () => {
    matchRepoMock.findOne.mockResolvedValue(null);
    feedClientMock.streamProducts.mockResolvedValue(0);
    const service = await createService();

    service.onModuleInit();
    await new Promise((resolve) => setImmediate(resolve));

    expect(matchRepoMock.findOne).toHaveBeenCalled();
    expect(feedClientMock.streamProducts).toHaveBeenCalled();
  });

  it('leaves a fresh index alone', async () => {
    matchRepoMock.findOne.mockResolvedValue({ matched_at: new Date() });
    const service = await createService();

    service.syncIfStale();
    await new Promise((resolve) => setImmediate(resolve));

    expect(feedClientMock.streamProducts).not.toHaveBeenCalled();
  });

  it('re-syncs an index older than its TTL', async () => {
    matchRepoMock.findOne.mockResolvedValue({
      matched_at: new Date(Date.now() - 25 * 3600_000),
    });
    feedClientMock.streamProducts.mockResolvedValue(0);
    const service = await createService();

    service.syncIfStale();
    await new Promise((resolve) => setImmediate(resolve));

    expect(feedClientMock.streamProducts).toHaveBeenCalled();
  });

  it('swallows a background sync failure rather than crashing the request', async () => {
    matchRepoMock.findOne.mockRejectedValue(new Error('db down'));
    const service = await createService();

    expect(() => service.syncIfStale()).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
  });
});
