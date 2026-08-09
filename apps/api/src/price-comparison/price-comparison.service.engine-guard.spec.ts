import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { PriceComparisonService } from './price-comparison.service';
import { SupplierPriceCache } from './entities/supplier-price-cache.entity';
import { SupplierRegistry } from './adapters/supplier-registry';
import { ShoppingListsService } from '../shopping-lists/shopping-lists.service';
import type { SupplierAdapter } from './adapters/supplier-adapter.interface';
import type { ShoppingListMaterialItem } from '../shopping-lists/entities/shopping-list.entity';

// E5-4 : preuve, sans mock de `shopping-list-engine-status`, que
// `SHOPPING_LIST_ENGINE_CORRECTED` vaut bien `false` par défaut et que
// `getBuyLinks` s'arrête avant tout appel réseau/adaptateur — pas un filtre
// appliqué après coup sur un résultat déjà calculé.
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

describe('PriceComparisonService — E5-4 engine guard (real constant)', () => {
  let service: PriceComparisonService;
  let cacheRepoMock: { createQueryBuilder: jest.Mock; findOne: jest.Mock };
  let supplierRegistryMock: { getAllAdapters: jest.Mock };
  let shoppingListsServiceMock: { getOrGenerate: jest.Mock };
  let configServiceMock: { get: jest.Mock };
  let lookupPrices: jest.Mock;

  beforeEach(async () => {
    cacheRepoMock = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
    };

    lookupPrices = jest.fn().mockResolvedValue(
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
            fetched_at: '2026-08-05T00:00:00.000Z',
          },
        ],
      ]),
    );
    const adapter: SupplierAdapter = {
      supplierKey: 'manomano',
      supplierName: 'ManoMano',
      lookupPrices,
      healthCheck: jest.fn(),
    };
    supplierRegistryMock = {
      getAllAdapters: jest.fn().mockReturnValue([adapter]),
    };

    shoppingListsServiceMock = {
      getOrGenerate: jest.fn().mockResolvedValue({
        shoppingList: {
          id: 'sl-1',
          project_id: 'project-1',
          items_json: {
            material_items: [mutualizedItem],
            complementary_items: [],
          },
        },
      }),
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

  it('returns no buy links even when a match would otherwise be found', async () => {
    const result = await service.getBuyLinks('project-1', 'user-1');

    expect(result).toEqual([]);
  });

  it('short-circuits before generating or fetching the shopping list at all', async () => {
    await service.getBuyLinks('project-1', 'user-1');

    expect(shoppingListsServiceMock.getOrGenerate).not.toHaveBeenCalled();
    expect(lookupPrices).not.toHaveBeenCalled();
  });
});
