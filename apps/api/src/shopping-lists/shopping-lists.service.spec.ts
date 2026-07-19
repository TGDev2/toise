import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ShoppingListsService } from './shopping-lists.service';
import { ShoppingList } from './entities/shopping-list.entity';
import { ComplementaryMaterial } from './entities/complementary-material.entity';
import { WorkType } from '../projects/entities/work-type.entity';
import { EstimationsService } from '../estimations/estimations.service';
import { ProjectsService } from '../projects/projects.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';
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

const estimationsServiceMock = {
  getLatest: jest.fn(),
};

const projectsServiceMock = {
  findOneByUser: jest.fn(),
  getWorkItems: jest.fn(),
};

const analyticsServiceMock = {
  track: jest.fn(),
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
        { provide: EstimationsService, useValue: estimationsServiceMock },
        { provide: ProjectsService, useValue: projectsServiceMock },
        { provide: AnalyticsService, useValue: analyticsServiceMock },
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
});
