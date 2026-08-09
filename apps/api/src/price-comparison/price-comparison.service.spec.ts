import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { PriceComparisonService } from './price-comparison.service';
import { SupplierPriceCache } from './entities/supplier-price-cache.entity';
import { SupplierRegistry } from './adapters/supplier-registry';
import { ShoppingListsService } from '../shopping-lists/shopping-lists.service';
import type { SupplierAdapter } from './adapters/supplier-adapter.interface';
import type { ShoppingListMaterialItem } from '../shopping-lists/entities/shopping-list.entity';

// Ce fichier exerce la logique de sélection de lien de `getBuyLinks`
// elle-même (le "meilleur fournisseur" par ligne) ; le garde-fou E5-4 qui
// bloque tout par défaut est prouvé séparément dans
// `price-comparison.service.engine-guard.spec.ts`, sur la vraie valeur
// (`false`) de la constante.
jest.mock('./shopping-list-engine-status', () => ({
  SHOPPING_LIST_ENGINE_CORRECTED: true,
}));

// Post-ENG-2, une liste d'achat générée depuis `aggregated_json` ne renseigne
// jamais `work_item_id` (cf. shopping-lists.service.ts `generate`).
const mutualizedItem: ShoppingListMaterialItem = {
  material_id: 'mat-paint',
  work_type_code: 'wall_painting',
  work_type_label: 'Peinture murale',
  material_name: 'Peinture acrylique mate',
  material_category: 'painting',
  material_unit: 'L',
  packaging_label: 'Pot 10 L',
  packaging_qty_per_unit: 10,
  adjusted_qty: 2,
  original_units_needed: 2,
  units_needed: 2,
  is_manually_adjusted: false,
};

function makeQueryBuilderMock(getManyResult: unknown[] = []) {
  const qb: Record<string, jest.Mock> = {
    where: jest.fn(),
    andWhere: jest.fn(),
    getMany: jest.fn().mockResolvedValue(getManyResult),
    insert: jest.fn(),
    into: jest.fn(),
    values: jest.fn(),
    orIgnore: jest.fn(),
    execute: jest.fn().mockResolvedValue(undefined),
  };
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.insert.mockReturnValue(qb);
  qb.into.mockReturnValue(qb);
  qb.values.mockReturnValue(qb);
  qb.orIgnore.mockReturnValue(qb);
  return qb;
}

describe('PriceComparisonService', () => {
  function buildShoppingList(materialItems: ShoppingListMaterialItem[]) {
    return {
      id: 'sl-1',
      project_id: 'project-1',
      items_json: { material_items: materialItems, complementary_items: [] },
    };
  }

  type MockShoppingList = ReturnType<typeof buildShoppingList>;

  let service: PriceComparisonService;
  let cacheRepoMock: { createQueryBuilder: jest.Mock; findOne: jest.Mock };
  let supplierRegistryMock: { getAllAdapters: jest.Mock };
  let shoppingListsServiceMock: {
    getOrGenerate: jest.Mock;
    saveEntity: jest.Mock<MockShoppingList, [MockShoppingList]>;
  };
  let configServiceMock: { get: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    cacheRepoMock = {
      createQueryBuilder: jest.fn(() => makeQueryBuilderMock([])),
      findOne: jest.fn().mockResolvedValue(null),
    };
    supplierRegistryMock = { getAllAdapters: jest.fn().mockReturnValue([]) };
    shoppingListsServiceMock = {
      getOrGenerate: jest.fn(),
      saveEntity: jest.fn((entity: MockShoppingList) => entity),
    };
    configServiceMock = { get: jest.fn().mockReturnValue(24) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceComparisonService,
        {
          provide: getRepositoryToken(SupplierPriceCache),
          useValue: cacheRepoMock,
        },
        { provide: SupplierRegistry, useValue: supplierRegistryMock },
        { provide: ShoppingListsService, useValue: shoppingListsServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get(PriceComparisonService);
  });

  describe('comparePrices', () => {
    it('returns an empty response when the shopping list has no material items', async () => {
      shoppingListsServiceMock.getOrGenerate.mockResolvedValue({
        shoppingList: buildShoppingList([]),
      });

      const result = await service.comparePrices('project-1', 'user-1');

      expect(result.items).toEqual([]);
      expect(result.supplier_totals).toEqual([]);
      expect(result.optimized_total).toBe(0);
    });

    it('aggregates prices across adapters, sorts by price, and picks the cheapest available', async () => {
      shoppingListsServiceMock.getOrGenerate.mockResolvedValue({
        shoppingList: buildShoppingList([mutualizedItem]),
      });

      const cheapAdapter: SupplierAdapter = {
        supplierKey: 'manomano',
        supplierName: 'ManoMano',
        lookupPrices: jest.fn().mockResolvedValue(
          new Map([
            [
              'mat-paint',
              {
                supplier_key: 'manomano',
                supplier_name: 'ManoMano',
                product_name: 'Peinture acrylique mate 10L',
                unit_price: 29.9,
                currency: 'EUR',
                availability: 'in_stock',
                fetched_at: '2026-08-01T00:00:00.000Z',
              },
            ],
          ]),
        ),
        healthCheck: jest.fn(),
      };
      const expensiveAdapter: SupplierAdapter = {
        supplierKey: 'other',
        supplierName: 'Autre enseigne',
        lookupPrices: jest.fn().mockResolvedValue(
          new Map([
            [
              'mat-paint',
              {
                supplier_key: 'other',
                supplier_name: 'Autre enseigne',
                product_name: 'Peinture acrylique mate 10L',
                unit_price: 34.9,
                currency: 'EUR',
                availability: 'in_stock',
                fetched_at: '2026-08-01T00:00:00.000Z',
              },
            ],
          ]),
        ),
        healthCheck: jest.fn(),
      };
      supplierRegistryMock.getAllAdapters.mockReturnValue([
        expensiveAdapter,
        cheapAdapter,
      ]);

      const result = await service.comparePrices('project-1', 'user-1');

      expect(result.items).toHaveLength(1);
      const [item] = result.items;
      expect(item.material_id).toBe('mat-paint');
      expect(item.prices.map((p) => p.supplier_key)).toEqual([
        'manomano',
        'other',
      ]);
      expect(item.best_supplier_key).toBe('manomano');
      expect(result.supplier_totals.map((s) => s.supplier_key)).toEqual([
        'manomano',
        'other',
      ]);
      expect(result.optimized_total).toBe(29.9 * 2);
    });

    it('ranks not_found results last regardless of price and leaves best_supplier_key null when nothing is available', async () => {
      shoppingListsServiceMock.getOrGenerate.mockResolvedValue({
        shoppingList: buildShoppingList([mutualizedItem]),
      });

      const adapter: SupplierAdapter = {
        supplierKey: 'manomano',
        supplierName: 'ManoMano',
        lookupPrices: jest.fn().mockResolvedValue(
          new Map([
            [
              'mat-paint',
              {
                supplier_key: 'manomano',
                supplier_name: 'ManoMano',
                product_name: 'Peinture acrylique mate 10L',
                unit_price: 0,
                currency: 'EUR',
                availability: 'not_found',
                fetched_at: '2026-08-01T00:00:00.000Z',
              },
            ],
          ]),
        ),
        healthCheck: jest.fn(),
      };
      supplierRegistryMock.getAllAdapters.mockReturnValue([adapter]);

      const result = await service.comparePrices('project-1', 'user-1');

      expect(result.items[0].best_supplier_key).toBeNull();
      expect(result.optimized_total).toBe(0);
      expect(result.supplier_totals[0].items_available).toBe(0);
    });
  });

  describe('getBuyLinks', () => {
    it('returns an empty array when the shopping list has no material items', async () => {
      shoppingListsServiceMock.getOrGenerate.mockResolvedValue({
        shoppingList: buildShoppingList([]),
      });

      const result = await service.getBuyLinks('project-1', 'user-1');

      expect(result).toEqual([]);
    });

    it('returns a buy link for an available item with a product_url', async () => {
      shoppingListsServiceMock.getOrGenerate.mockResolvedValue({
        shoppingList: buildShoppingList([mutualizedItem]),
      });

      const adapter: SupplierAdapter = {
        supplierKey: 'manomano',
        supplierName: 'ManoMano',
        lookupPrices: jest.fn().mockResolvedValue(
          new Map([
            [
              'mat-paint',
              {
                supplier_key: 'manomano',
                supplier_name: 'ManoMano',
                product_name: 'Peinture acrylique mate 10L',
                unit_price: 29.9,
                currency: 'EUR',
                availability: 'in_stock',
                product_url: 'https://www.manomano.fr/p/peinture-123',
                fetched_at: '2026-08-01T00:00:00.000Z',
              },
            ],
          ]),
        ),
        healthCheck: jest.fn(),
      };
      supplierRegistryMock.getAllAdapters.mockReturnValue([adapter]);

      const result = await service.getBuyLinks('project-1', 'user-1');

      expect(result).toEqual([
        {
          material_id: 'mat-paint',
          supplier_key: 'manomano',
          supplier_name: 'ManoMano',
          url: 'https://www.manomano.fr/p/peinture-123',
        },
      ]);
    });

    it('omits a line when no supplier has an exploitable match (not_found)', async () => {
      shoppingListsServiceMock.getOrGenerate.mockResolvedValue({
        shoppingList: buildShoppingList([mutualizedItem]),
      });

      const adapter: SupplierAdapter = {
        supplierKey: 'manomano',
        supplierName: 'ManoMano',
        lookupPrices: jest.fn().mockResolvedValue(
          new Map([
            [
              'mat-paint',
              {
                supplier_key: 'manomano',
                supplier_name: 'ManoMano',
                product_name: 'Peinture acrylique mate',
                unit_price: 0,
                currency: 'EUR',
                availability: 'not_found',
                fetched_at: '2026-08-01T00:00:00.000Z',
              },
            ],
          ]),
        ),
        healthCheck: jest.fn(),
      };
      supplierRegistryMock.getAllAdapters.mockReturnValue([adapter]);

      const result = await service.getBuyLinks('project-1', 'user-1');

      expect(result).toEqual([]);
    });

    it('picks the cheapest available supplier when several match the same line', async () => {
      shoppingListsServiceMock.getOrGenerate.mockResolvedValue({
        shoppingList: buildShoppingList([mutualizedItem]),
      });

      const expensiveAdapter: SupplierAdapter = {
        supplierKey: 'other',
        supplierName: 'Autre enseigne',
        lookupPrices: jest.fn().mockResolvedValue(
          new Map([
            [
              'mat-paint',
              {
                supplier_key: 'other',
                supplier_name: 'Autre enseigne',
                product_name: 'Peinture acrylique mate 10L',
                unit_price: 34.9,
                currency: 'EUR',
                availability: 'in_stock',
                product_url: 'https://autre-enseigne.fr/p/peinture-456',
                fetched_at: '2026-08-01T00:00:00.000Z',
              },
            ],
          ]),
        ),
        healthCheck: jest.fn(),
      };
      const cheapAdapter: SupplierAdapter = {
        supplierKey: 'manomano',
        supplierName: 'ManoMano',
        lookupPrices: jest.fn().mockResolvedValue(
          new Map([
            [
              'mat-paint',
              {
                supplier_key: 'manomano',
                supplier_name: 'ManoMano',
                product_name: 'Peinture acrylique mate 10L',
                unit_price: 29.9,
                currency: 'EUR',
                availability: 'in_stock',
                product_url: 'https://www.manomano.fr/p/peinture-123',
                fetched_at: '2026-08-01T00:00:00.000Z',
              },
            ],
          ]),
        ),
        healthCheck: jest.fn(),
      };
      supplierRegistryMock.getAllAdapters.mockReturnValue([
        expensiveAdapter,
        cheapAdapter,
      ]);

      const result = await service.getBuyLinks('project-1', 'user-1');

      expect(result).toEqual([
        {
          material_id: 'mat-paint',
          supplier_key: 'manomano',
          supplier_name: 'ManoMano',
          url: 'https://www.manomano.fr/p/peinture-123',
        },
      ]);
    });
  });

  describe('applySelections', () => {
    it('applies a selection to a mutualized item matched on material_id alone (no work_item_id)', async () => {
      const materialItems: ShoppingListMaterialItem[] = [{ ...mutualizedItem }];
      const shoppingList = buildShoppingList(materialItems);
      shoppingListsServiceMock.getOrGenerate.mockResolvedValue({
        shoppingList,
      });
      cacheRepoMock.findOne.mockResolvedValue({
        price_data: {
          supplier_key: 'manomano',
          supplier_name: 'ManoMano',
          unit_price: 27.5,
          store_name: 'ManoMano',
        },
      });

      await service.applySelections('project-1', 'user-1', [
        { material_id: 'mat-paint', supplier_key: 'manomano' },
      ]);

      expect(shoppingListsServiceMock.saveEntity).toHaveBeenCalledTimes(1);
      const saved = shoppingListsServiceMock.saveEntity.mock.calls[0][0];
      const updatedItem = saved.items_json.material_items[0];
      expect(updatedItem.real_unit_price).toBe(27.5);
      expect(updatedItem.store_name).toBe('ManoMano');
    });

    it('ignores a stale work_item_id sent by an old client and still matches on material_id', async () => {
      const materialItems: ShoppingListMaterialItem[] = [{ ...mutualizedItem }];
      const shoppingList = buildShoppingList(materialItems);
      shoppingListsServiceMock.getOrGenerate.mockResolvedValue({
        shoppingList,
      });
      cacheRepoMock.findOne.mockResolvedValue({
        price_data: {
          supplier_key: 'manomano',
          supplier_name: 'ManoMano',
          unit_price: 27.5,
          store_name: 'ManoMano',
        },
      });

      await service.applySelections('project-1', 'user-1', [
        {
          material_id: 'mat-paint',
          work_item_id: 'stale-legacy-id',
          supplier_key: 'manomano',
        },
      ]);

      const saved = shoppingListsServiceMock.saveEntity.mock.calls[0][0];
      expect(saved.items_json.material_items[0].real_unit_price).toBe(27.5);
    });

    it('does not save when no cached price matches the selection', async () => {
      const materialItems: ShoppingListMaterialItem[] = [{ ...mutualizedItem }];
      const shoppingList = buildShoppingList(materialItems);
      shoppingListsServiceMock.getOrGenerate.mockResolvedValue({
        shoppingList,
      });
      cacheRepoMock.findOne.mockResolvedValue(null);

      await service.applySelections('project-1', 'user-1', [
        { material_id: 'mat-paint', supplier_key: 'manomano' },
      ]);

      expect(shoppingListsServiceMock.saveEntity).not.toHaveBeenCalled();
    });
  });
});
