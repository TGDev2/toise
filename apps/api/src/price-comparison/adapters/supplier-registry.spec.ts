import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SupplierRegistry } from './supplier-registry';
import { ManoManoAdapter } from './manomano/manomano.adapter';
import { LeroyMerlinAdapter } from './leroymerlin/leroymerlin.adapter';

const manoManoAdapterMock = {
  supplierKey: 'manomano',
  supplierName: 'ManoMano',
  lookupPrices: jest.fn(),
  healthCheck: jest.fn(),
};

const leroyMerlinAdapterMock = {
  supplierKey: 'leroymerlin',
  supplierName: 'Leroy Merlin',
  lookupPrices: jest.fn(),
  healthCheck: jest.fn(),
};

function makeConfigMock(overrides: Record<string, unknown> = {}) {
  const map: Record<string, unknown> = {
    'priceComparison.manoMano.enabled': false,
    'priceComparison.leroyMerlin.enabled': false,
    ...overrides,
  };
  return {
    get: jest.fn(
      (key: string, defaultValue?: unknown) => map[key] ?? defaultValue,
    ),
  };
}

async function createRegistry(
  configOverrides: Record<string, unknown> = {},
): Promise<SupplierRegistry> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      SupplierRegistry,
      { provide: ManoManoAdapter, useValue: manoManoAdapterMock },
      { provide: LeroyMerlinAdapter, useValue: leroyMerlinAdapterMock },
      { provide: ConfigService, useValue: makeConfigMock(configOverrides) },
    ],
  }).compile();

  return module.get(SupplierRegistry);
}

describe('SupplierRegistry', () => {
  beforeEach(() => jest.clearAllMocks());

  it('registers no adapter while every supplier is disabled', async () => {
    const registry = await createRegistry();
    expect(registry.getAllAdapters()).toEqual([]);
  });

  it('registers the ManoMano adapter when enabled', async () => {
    const registry = await createRegistry({
      'priceComparison.manoMano.enabled': true,
    });

    expect(registry.getAllAdapters()).toHaveLength(1);
    expect(registry.getAdapter('manomano')).toBe(manoManoAdapterMock);
  });

  it('registers the Leroy Merlin adapter when enabled', async () => {
    const registry = await createRegistry({
      'priceComparison.leroyMerlin.enabled': true,
    });

    expect(registry.getAllAdapters()).toHaveLength(1);
    expect(registry.getAdapter('leroymerlin')).toBe(leroyMerlinAdapterMock);
  });

  it('registers both adapters at once so the comparison has more than one source (BUY-4)', async () => {
    const registry = await createRegistry({
      'priceComparison.manoMano.enabled': true,
      'priceComparison.leroyMerlin.enabled': true,
    });

    const keys = registry.getAllAdapters().map((a) => a.supplierKey);
    expect(keys.sort()).toEqual(['leroymerlin', 'manomano']);
  });

  it('no longer exposes any mock adapter', async () => {
    // BUY-1 : les adaptateurs mock fabriquaient des prix en CAD, incohérents
    // avec un produit intégralement français, et ont été supprimés.
    const registry = await createRegistry({
      'priceComparison.manoMano.enabled': true,
      'priceComparison.leroyMerlin.enabled': true,
    });

    const keys = registry.getAllAdapters().map((a) => a.supplierKey);
    expect(keys).not.toContain('home_depot_mock');
    expect(keys).not.toContain('lowes_mock');
    expect(keys).not.toContain('local_mock');
    expect(keys.some((key) => key.includes('mock'))).toBe(false);
  });

  it('returns undefined for an unknown supplier key', async () => {
    const registry = await createRegistry({
      'priceComparison.manoMano.enabled': true,
      'priceComparison.leroyMerlin.enabled': true,
    });
    expect(registry.getAdapter('castorama')).toBeUndefined();
  });

  it('hands out a copy of the adapter list', async () => {
    const registry = await createRegistry({
      'priceComparison.manoMano.enabled': true,
    });

    registry.getAllAdapters().pop();
    expect(registry.getAllAdapters()).toHaveLength(1);
  });
});
