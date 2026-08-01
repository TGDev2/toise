import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ShoppingListsService } from './shopping-lists.service';
import { ShoppingList } from './entities/shopping-list.entity';
import { ComplementaryMaterial } from './entities/complementary-material.entity';
import { WorkType } from '../projects/entities/work-type.entity';
import { MaterialCatalog } from '../materials/entities/material-catalog.entity';
import { MaterialEcoEquivalence } from '../materials/entities/material-eco-equivalence.entity';
import { EstimationsService } from '../estimations/estimations.service';
import { ProjectsService } from '../projects/projects.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';
import { LogbookService } from '../logbook/logbook.service';
import { ProjectStatus } from '../projects/entities/project.entity';
import type { EstimationLineItem } from '../estimations/entities/estimation-result.entity';

const mockEstimationItem: EstimationLineItem = {
  work_item_id: 'wi-1',
  work_type_code: 'wall_painting',
  work_type_label: 'Peinture murale',
  material_id: 'mat-paint',
  material_name: 'Peinture acrylique mate',
  material_unit: 'L',
  gross_surface_m2: 12,
  surface_m2: 10,
  theoretical_qty: 1,
  waste_factor_percent: 5,
  waste_factor_source: 'catalog',
  adjusted_qty: 1.05,
  packaging_label: 'Pot 10 L',
  packaging_qty_per_unit: 10,
  units_needed: 1,
  pose_type: 'standard',
};

const shoppingListRepoMock = {
  find: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const complementaryRepoMock = {
  find: jest.fn(),
};

const workTypeRepoMock = {
  find: jest.fn(),
};

const materialCatalogRepoMock = {
  find: jest.fn().mockResolvedValue([]),
};

const ecoEquivalenceRepoMock = {
  find: jest.fn().mockResolvedValue([]),
};

const estimationsServiceMock = {
  getLatest: jest.fn(),
  findById: jest.fn(),
};

const projectsServiceMock = {
  findOneByUser: jest.fn(),
  getWorkItems: jest.fn(),
  getRooms: jest.fn().mockResolvedValue([]),
  updateStatus: jest.fn(),
};

const analyticsServiceMock = {
  track: jest.fn(),
};

const logbookServiceMock = {
  recordChantierCompletion: jest.fn(),
};

describe('ShoppingListsService.generate', () => {
  let service: ShoppingListsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    estimationsServiceMock.getLatest.mockResolvedValue({
      id: 'estimation-1',
      items_json: [mockEstimationItem],
    });
    workTypeRepoMock.find.mockResolvedValue([
      { code: 'wall_painting', category: 'painting' },
    ]);
    complementaryRepoMock.find.mockResolvedValue([]);
    shoppingListRepoMock.delete.mockResolvedValue(undefined);
    shoppingListRepoMock.create.mockImplementation(
      (data: Record<string, unknown>) => data,
    );
    shoppingListRepoMock.save.mockImplementation(
      (entity: Record<string, unknown>) =>
        Promise.resolve({ id: 'shopping-list-1', ...entity }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShoppingListsService,
        {
          provide: getRepositoryToken(ShoppingList),
          useValue: shoppingListRepoMock,
        },
        {
          provide: getRepositoryToken(ComplementaryMaterial),
          useValue: complementaryRepoMock,
        },
        { provide: getRepositoryToken(WorkType), useValue: workTypeRepoMock },
        {
          provide: getRepositoryToken(MaterialCatalog),
          useValue: materialCatalogRepoMock,
        },
        {
          provide: getRepositoryToken(MaterialEcoEquivalence),
          useValue: ecoEquivalenceRepoMock,
        },
        { provide: EstimationsService, useValue: estimationsServiceMock },
        { provide: ProjectsService, useValue: projectsServiceMock },
        { provide: AnalyticsService, useValue: analyticsServiceMock },
        { provide: LogbookService, useValue: logbookServiceMock },
      ],
    }).compile();

    service = module.get(ShoppingListsService);
  });

  it('builds material items from the latest estimation and persists them', async () => {
    const result = await service.generate('project-1', 'user-1');

    expect(shoppingListRepoMock.delete).toHaveBeenCalledWith({
      project_id: 'project-1',
    });
    expect(result.items_json.material_items).toHaveLength(1);
    expect(result.items_json.material_items[0]).toMatchObject({
      material_id: 'mat-paint',
      material_category: 'painting',
      units_needed: 1,
    });
  });

  it('tracks a shopping_list_generated analytics event with the item count', async () => {
    await service.generate('project-1', 'user-1');

    expect(analyticsServiceMock.track).toHaveBeenCalledWith(
      AnalyticsEventName.SHOPPING_LIST_GENERATED,
      'user-1',
      { project_id: 'project-1', total_items: 1 },
    );
  });

  it('builds mutualised material items from aggregated_json when present (ENG-2)', async () => {
    // 2 pièces (items granulaires) mais 1 seule ligne d'achat mutualisée.
    estimationsServiceMock.getLatest.mockResolvedValue({
      id: 'estimation-1',
      items_json: [
        mockEstimationItem,
        { ...mockEstimationItem, work_item_id: 'wi-2', room_id: 'r2' },
      ],
      aggregated_json: [
        {
          material_id: 'mat-paint',
          material_name: 'Peinture acrylique mate',
          material_unit: 'L',
          work_type_code: 'wall_painting',
          work_type_label: 'Peinture murale',
          total_adjusted_qty: 2.1,
          packaging_label: 'Pot 10 L',
          packaging_qty_per_unit: 10,
          units_needed: 1,
          room_count: 2,
          contributions: [],
        },
      ],
    });

    const result = await service.generate('project-1', 'user-1');

    // Une seule ligne malgré deux pièces contributrices.
    expect(result.items_json.material_items).toHaveLength(1);
    expect(result.items_json.material_items[0]).toMatchObject({
      material_id: 'mat-paint',
      material_category: 'painting',
      units_needed: 1,
      room_count: 2,
    });
  });

  // CV-5 : la fourchette basse/haute est un simple passthrough depuis le
  // moteur d'estimation, sur les deux chemins de génération.
  it('propagates units_needed_low/high from aggregated_json (ENG-2 path)', async () => {
    estimationsServiceMock.getLatest.mockResolvedValue({
      id: 'estimation-1',
      items_json: [mockEstimationItem],
      aggregated_json: [
        {
          material_id: 'mat-paint',
          material_name: 'Peinture acrylique mate',
          material_unit: 'L',
          work_type_code: 'wall_painting',
          work_type_label: 'Peinture murale',
          total_adjusted_qty: 1.05,
          packaging_label: 'Pot 10 L',
          packaging_qty_per_unit: 10,
          units_needed: 1,
          units_needed_low: 1,
          units_needed_high: 2,
          room_count: 1,
          contributions: [],
        },
      ],
    });

    const result = await service.generate('project-1', 'user-1');

    expect(result.items_json.material_items[0]).toMatchObject({
      units_needed_low: 1,
      units_needed_high: 2,
    });
  });

  it('propagates units_needed_low/high from items_json (legacy pre-ENG-2 path)', async () => {
    estimationsServiceMock.getLatest.mockResolvedValue({
      id: 'estimation-1',
      items_json: [
        { ...mockEstimationItem, units_needed_low: 1, units_needed_high: 2 },
      ],
      aggregated_json: null,
    });

    const result = await service.generate('project-1', 'user-1');

    expect(result.items_json.material_items[0]).toMatchObject({
      units_needed_low: 1,
      units_needed_high: 2,
    });
  });

  it('leaves units_needed_low/high undefined when the estimation carries no range', async () => {
    const result = await service.generate('project-1', 'user-1');

    expect(
      result.items_json.material_items[0].units_needed_low,
    ).toBeUndefined();
    expect(
      result.items_json.material_items[0].units_needed_high,
    ).toBeUndefined();
  });
});

// COM-1 : regenerate() peut effacer budget_summary_json sur un projet déjà
// COMPLETED sans que le résumé recalculé en direct ne le signale (cf. notes
// dans le service) — isFinalized doit refléter le snapshot persisté, pas le
// calcul live.
describe('ShoppingListsService.getBudgetSummary', () => {
  let service: ShoppingListsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    projectsServiceMock.findOneByUser.mockResolvedValue({
      id: 'project-1',
      user_id: 'user-1',
    });
    estimationsServiceMock.findById.mockResolvedValue({
      id: 'estimation-1',
      items_json: [],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShoppingListsService,
        {
          provide: getRepositoryToken(ShoppingList),
          useValue: shoppingListRepoMock,
        },
        {
          provide: getRepositoryToken(ComplementaryMaterial),
          useValue: complementaryRepoMock,
        },
        { provide: getRepositoryToken(WorkType), useValue: workTypeRepoMock },
        {
          provide: getRepositoryToken(MaterialCatalog),
          useValue: materialCatalogRepoMock,
        },
        {
          provide: getRepositoryToken(MaterialEcoEquivalence),
          useValue: ecoEquivalenceRepoMock,
        },
        { provide: EstimationsService, useValue: estimationsServiceMock },
        { provide: ProjectsService, useValue: projectsServiceMock },
        { provide: AnalyticsService, useValue: analyticsServiceMock },
        { provide: LogbookService, useValue: logbookServiceMock },
      ],
    }).compile();

    service = module.get(ShoppingListsService);
  });

  it('reports isFinalized: false when budget_summary_json has never been persisted', async () => {
    shoppingListRepoMock.findOne.mockResolvedValue({
      id: 'shopping-list-1',
      estimation_id: 'estimation-1',
      items_json: { material_items: [], complementary_items: [] },
      budget_summary_json: null,
    });

    const { isFinalized } = await service.getBudgetSummary(
      'project-1',
      'user-1',
    );

    expect(isFinalized).toBe(false);
  });

  it('reports isFinalized: true when a budget has been persisted by finalize()', async () => {
    shoppingListRepoMock.findOne.mockResolvedValue({
      id: 'shopping-list-1',
      estimation_id: 'estimation-1',
      items_json: { material_items: [], complementary_items: [] },
      budget_summary_json: { total_real_cost: 91 },
    });

    const { isFinalized } = await service.getBudgetSummary(
      'project-1',
      'user-1',
    );

    expect(isFinalized).toBe(true);
  });

  it('reports isFinalized: false even when regenerate() has since restored a complete-looking live summary', async () => {
    // Cas concret (cf. notes COM-1) : regenerate() restaure real_unit_price
    // par matériau mais jamais budget_summary_json — le live recompute peut
    // redevenir "complet" alors que rien n'a été refinalisé.
    shoppingListRepoMock.findOne.mockResolvedValue({
      id: 'shopping-list-1',
      estimation_id: 'estimation-1',
      items_json: {
        material_items: [
          {
            material_id: 'mat-paint',
            material_category: 'painting',
            units_needed: 1,
            real_unit_price: 45.5,
          },
        ],
        complementary_items: [],
      },
      budget_summary_json: null,
    });

    const { summary, isFinalized } = await service.getBudgetSummary(
      'project-1',
      'user-1',
    );

    expect(summary.is_complete).toBe(true);
    expect(isFinalized).toBe(false);
  });
});

describe('ShoppingListsService.getEcoSuggestions', () => {
  let service: ShoppingListsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    materialCatalogRepoMock.find.mockResolvedValue([]);
    ecoEquivalenceRepoMock.find.mockResolvedValue([]);

    projectsServiceMock.findOneByUser.mockResolvedValue({
      id: 'project-1',
      user_id: 'user-1',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShoppingListsService,
        {
          provide: getRepositoryToken(ShoppingList),
          useValue: shoppingListRepoMock,
        },
        {
          provide: getRepositoryToken(ComplementaryMaterial),
          useValue: complementaryRepoMock,
        },
        { provide: getRepositoryToken(WorkType), useValue: workTypeRepoMock },
        {
          provide: getRepositoryToken(MaterialCatalog),
          useValue: materialCatalogRepoMock,
        },
        {
          provide: getRepositoryToken(MaterialEcoEquivalence),
          useValue: ecoEquivalenceRepoMock,
        },
        { provide: EstimationsService, useValue: estimationsServiceMock },
        { provide: ProjectsService, useValue: projectsServiceMock },
        { provide: AnalyticsService, useValue: analyticsServiceMock },
        { provide: LogbookService, useValue: logbookServiceMock },
      ],
    }).compile();

    service = module.get(ShoppingListsService);
  });

  const shoppingListWithMaterials = {
    id: 'shopping-list-1',
    project_id: 'project-1',
    items_json: {
      material_items: [
        { material_id: 'mat-paint', material_category: 'painting' },
        { material_id: 'mat-paint-eco', material_category: 'painting' },
      ],
      complementary_items: [],
    },
  };

  it('returns eco_items for materials already flagged is_eco', async () => {
    shoppingListRepoMock.findOne.mockResolvedValue(shoppingListWithMaterials);
    materialCatalogRepoMock.find.mockResolvedValue([
      {
        id: 'mat-paint',
        name: 'Peinture acrylique mate',
        is_eco: false,
        eco_label_fr: null,
      },
      {
        id: 'mat-paint-eco',
        name: 'Peinture acrylique mate sans COV',
        is_eco: true,
        eco_label_fr: 'Sans COV, écolabel NF Environnement',
      },
    ]);

    const result = await service.getEcoSuggestions('project-1', 'user-1');

    expect(result.eco_items).toEqual([
      {
        material_id: 'mat-paint-eco',
        material_name: 'Peinture acrylique mate sans COV',
        eco_label_fr: 'Sans COV, écolabel NF Environnement',
      },
    ]);
  });

  it('returns suggestions for standard materials with an active eco equivalent', async () => {
    shoppingListRepoMock.findOne.mockResolvedValue(shoppingListWithMaterials);
    materialCatalogRepoMock.find.mockResolvedValue([
      {
        id: 'mat-paint',
        name: 'Peinture acrylique mate',
        is_eco: false,
        eco_label_fr: null,
      },
    ]);
    ecoEquivalenceRepoMock.find.mockResolvedValue([
      {
        standard_material_id: 'mat-paint',
        eco_material_id: 'mat-paint-eco',
        ecoMaterial: {
          id: 'mat-paint-eco',
          name: 'Peinture acrylique mate sans COV',
          is_active: true,
          eco_label_fr: 'Sans COV, écolabel NF Environnement',
        },
      },
    ]);

    const result = await service.getEcoSuggestions('project-1', 'user-1');

    expect(result.suggestions).toEqual([
      {
        material_id: 'mat-paint',
        material_name: 'Peinture acrylique mate',
        eco_material_id: 'mat-paint-eco',
        eco_material_name: 'Peinture acrylique mate sans COV',
        eco_label_fr: 'Sans COV, écolabel NF Environnement',
      },
    ]);
  });

  it('omits a suggestion whose linked eco material has been deactivated', async () => {
    shoppingListRepoMock.findOne.mockResolvedValue(shoppingListWithMaterials);
    materialCatalogRepoMock.find.mockResolvedValue([
      {
        id: 'mat-paint',
        name: 'Peinture acrylique mate',
        is_eco: false,
        eco_label_fr: null,
      },
    ]);
    ecoEquivalenceRepoMock.find.mockResolvedValue([
      {
        standard_material_id: 'mat-paint',
        eco_material_id: 'mat-paint-eco',
        ecoMaterial: {
          id: 'mat-paint-eco',
          name: 'Peinture acrylique mate sans COV',
          is_active: false,
          eco_label_fr: 'Sans COV, écolabel NF Environnement',
        },
      },
    ]);

    const result = await service.getEcoSuggestions('project-1', 'user-1');

    expect(result.suggestions).toEqual([]);
  });

  it('throws NotFoundException when no shopping list exists for the project', async () => {
    shoppingListRepoMock.findOne.mockResolvedValue(null);

    await expect(
      service.getEcoSuggestions('project-1', 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ShoppingListsService.finalizeBudgetSummary', () => {
  let service: ShoppingListsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    projectsServiceMock.findOneByUser.mockResolvedValue({
      id: 'project-1',
      user_id: 'user-1',
    });
    estimationsServiceMock.findById.mockResolvedValue({
      id: 'estimation-1',
      items_json: [mockEstimationItem],
    });
    shoppingListRepoMock.save.mockImplementation(
      (entity: Record<string, unknown>) => Promise.resolve(entity),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShoppingListsService,
        {
          provide: getRepositoryToken(ShoppingList),
          useValue: shoppingListRepoMock,
        },
        {
          provide: getRepositoryToken(ComplementaryMaterial),
          useValue: complementaryRepoMock,
        },
        { provide: getRepositoryToken(WorkType), useValue: workTypeRepoMock },
        {
          provide: getRepositoryToken(MaterialCatalog),
          useValue: materialCatalogRepoMock,
        },
        {
          provide: getRepositoryToken(MaterialEcoEquivalence),
          useValue: ecoEquivalenceRepoMock,
        },
        { provide: EstimationsService, useValue: estimationsServiceMock },
        { provide: ProjectsService, useValue: projectsServiceMock },
        { provide: AnalyticsService, useValue: analyticsServiceMock },
        { provide: LogbookService, useValue: logbookServiceMock },
      ],
    }).compile();

    service = module.get(ShoppingListsService);
  });

  it('marque le projet COMPLETED puis déclenche le carnet du logement (PLAT-1)', async () => {
    const shoppingList = {
      id: 'shopping-list-1',
      project_id: 'project-1',
      estimation_id: 'estimation-1',
      items_json: {
        material_items: [
          {
            material_id: 'mat-paint',
            material_category: 'painting',
            units_needed: 1,
            real_unit_price: 45.5,
          },
        ],
        complementary_items: [],
      },
      budget_summary_json: null,
    };
    shoppingListRepoMock.findOne.mockResolvedValue(shoppingList);

    await service.finalizeBudgetSummary('project-1', 'user-1');

    expect(projectsServiceMock.updateStatus).toHaveBeenCalledWith(
      'project-1',
      ProjectStatus.COMPLETED,
    );
    expect(logbookServiceMock.recordChantierCompletion).toHaveBeenCalledWith(
      'project-1',
      'user-1',
      expect.objectContaining({ id: 'estimation-1' }),
      expect.objectContaining({ id: 'shopping-list-1' }),
    );
  });

  it('ne déclenche ni COMPLETED ni le carnet si des articles restent sans prix réel', async () => {
    shoppingListRepoMock.findOne.mockResolvedValue({
      id: 'shopping-list-1',
      estimation_id: 'estimation-1',
      items_json: {
        material_items: [{ material_id: 'mat-paint', real_unit_price: null }],
        complementary_items: [],
      },
    });

    await expect(
      service.finalizeBudgetSummary('project-1', 'user-1'),
    ).rejects.toThrow();

    expect(projectsServiceMock.updateStatus).not.toHaveBeenCalled();
    expect(logbookServiceMock.recordChantierCompletion).not.toHaveBeenCalled();
  });
});
