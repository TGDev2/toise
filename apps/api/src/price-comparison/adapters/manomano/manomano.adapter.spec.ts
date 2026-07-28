import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SupplierMaterialMatch } from '../../entities/supplier-material-match.entity';
import type { SupplierLookupItem } from '../supplier-adapter.interface';
import { ManoManoAdapter } from './manomano.adapter';
import { ManoManoFeedSyncService } from './manomano-feed-sync.service';

const matchRepoMock = {
  findBy: jest.fn(),
  countBy: jest.fn(),
};

const syncServiceMock = {
  syncIfStale: jest.fn(),
};

async function createAdapter(): Promise<ManoManoAdapter> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ManoManoAdapter,
      {
        provide: getRepositoryToken(SupplierMaterialMatch),
        useValue: matchRepoMock,
      },
      { provide: ManoManoFeedSyncService, useValue: syncServiceMock },
    ],
  }).compile();

  return module.get(ManoManoAdapter);
}

function lookupItem(
  overrides: Partial<SupplierLookupItem> = {},
): SupplierLookupItem {
  return {
    material_id: 'mat-satin',
    material_name: 'Peinture acrylique satinée',
    material_category: 'painting',
    material_unit: 'L',
    packaging_label: 'Pot 2.5 L',
    packaging_qty_per_unit: 2.5,
    units_needed: 3,
    ...overrides,
  };
}

/** Le driver Postgres renvoie les colonnes `numeric` sous forme de chaînes. */
function matchRow(
  overrides: Partial<Record<keyof SupplierMaterialMatch, unknown>> = {},
): SupplierMaterialMatch {
  return {
    id: 'row-1',
    supplier_key: 'manomano',
    material_id: 'mat-satin',
    external_id: 'MM-1',
    product_name: 'Peinture acrylique satinée blanche Dulux',
    product_url: 'https://mano.example/aff/1',
    brand: 'Dulux',
    price: '34.90',
    currency: 'EUR',
    pack_qty: '2.5000',
    pack_unit: 'L',
    availability: 'in_stock',
    match_score: '0.9100',
    is_pinned: false,
    matched_at: new Date('2026-07-28T10:00:00Z'),
    ...overrides,
  } as unknown as SupplierMaterialMatch;
}

describe('ManoManoAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    matchRepoMock.findBy.mockResolvedValue([]);
  });

  it('identifies itself as the ManoMano supplier', async () => {
    const adapter = await createAdapter();
    expect(adapter.supplierKey).toBe('manomano');
    expect(adapter.supplierName).toBe('ManoMano');
  });

  it('returns the merchant price when both packagings agree', async () => {
    matchRepoMock.findBy.mockResolvedValue([matchRow()]);
    const adapter = await createAdapter();

    const results = await adapter.lookupPrices([lookupItem()]);
    const price = results.get('mat-satin')!;

    expect(price).toMatchObject({
      supplier_key: 'manomano',
      supplier_name: 'ManoMano',
      unit_price: 34.9,
      currency: 'EUR',
      availability: 'in_stock',
      product_url: 'https://mano.example/aff/1',
    });
    expect(price.product_name).toBe(
      'Peinture acrylique satinée blanche Dulux (2.5 L)',
    );
  });

  it('prorates a larger merchant packaging down to the quote packaging', async () => {
    // Bidon de 10 L à 89,90 EUR pour un devis raisonnant en pots de 2,5 L.
    matchRepoMock.findBy.mockResolvedValue([
      matchRow({ price: '89.90', pack_qty: '10.0000' }),
    ]);
    const adapter = await createAdapter();

    const price = (await adapter.lookupPrices([lookupItem()])).get(
      'mat-satin',
    )!;

    expect(price.unit_price).toBe(22.48);
    expect(price.availability).toBe('in_stock');
    // Le conditionnement réel du marchand reste lisible.
    expect(price.product_name).toContain('(10 L)');
  });

  it('reports not_found rather than extrapolating outside the ratio band', async () => {
    matchRepoMock.findBy.mockResolvedValue([
      matchRow({ price: '199.00', pack_qty: '25.0000' }),
    ]);
    const adapter = await createAdapter();

    const price = (await adapter.lookupPrices([lookupItem()])).get(
      'mat-satin',
    )!;

    expect(price.availability).toBe('not_found');
    expect(price.unit_price).toBe(0);
    expect(price.product_url).toBeUndefined();
  });

  it('reports not_found for a material with no match', async () => {
    const adapter = await createAdapter();

    const price = (await adapter.lookupPrices([lookupItem()])).get(
      'mat-satin',
    )!;

    expect(price).toMatchObject({
      supplier_key: 'manomano',
      availability: 'not_found',
      unit_price: 0,
      currency: 'EUR',
      product_name: 'Peinture acrylique satinée',
    });
  });

  it('carries the merchant availability through', async () => {
    matchRepoMock.findBy.mockResolvedValue([
      matchRow({ availability: 'out_of_stock' }),
    ]);
    const adapter = await createAdapter();

    expect(
      (await adapter.lookupPrices([lookupItem()])).get('mat-satin')!
        .availability,
    ).toBe('out_of_stock');
  });

  it('returns an entry for every requested material', async () => {
    matchRepoMock.findBy.mockResolvedValue([matchRow()]);
    const adapter = await createAdapter();

    const results = await adapter.lookupPrices([
      lookupItem(),
      lookupItem({ material_id: 'mat-other', material_name: 'Colle' }),
    ]);

    expect([...results.keys()].sort()).toEqual(['mat-other', 'mat-satin']);
  });

  it('never exposes a store or a distance: ManoMano sells online only', async () => {
    matchRepoMock.findBy.mockResolvedValue([matchRow()]);
    const adapter = await createAdapter();

    const price = (await adapter.lookupPrices([lookupItem()])).get(
      'mat-satin',
    )!;
    expect(price.store_name).toBeUndefined();
    expect(price.store_distance_km).toBeUndefined();
  });

  it('short-circuits an empty lookup without touching the database', async () => {
    const adapter = await createAdapter();

    expect((await adapter.lookupPrices([])).size).toBe(0);
    expect(matchRepoMock.findBy).not.toHaveBeenCalled();
    expect(syncServiceMock.syncIfStale).not.toHaveBeenCalled();
  });

  it('triggers a background refresh without awaiting it', async () => {
    matchRepoMock.findBy.mockResolvedValue([matchRow()]);
    const adapter = await createAdapter();

    await adapter.lookupPrices([lookupItem()]);

    expect(syncServiceMock.syncIfStale).toHaveBeenCalledTimes(1);
  });

  describe('healthCheck', () => {
    it('is healthy once the index holds matches', async () => {
      matchRepoMock.countBy.mockResolvedValue(42);
      const adapter = await createAdapter();
      expect(await adapter.healthCheck()).toBe(true);
    });

    it('is unhealthy while the index is empty', async () => {
      matchRepoMock.countBy.mockResolvedValue(0);
      const adapter = await createAdapter();
      expect(await adapter.healthCheck()).toBe(false);
    });

    it('is unhealthy rather than throwing when the database is down', async () => {
      matchRepoMock.countBy.mockRejectedValue(new Error('db down'));
      const adapter = await createAdapter();
      expect(await adapter.healthCheck()).toBe(false);
    });
  });
});
