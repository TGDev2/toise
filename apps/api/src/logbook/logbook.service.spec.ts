import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LogbookService } from './logbook.service';
import { RoomLogEntry } from './entities/room-log-entry.entity';
import { ProjectsService } from '../projects/projects.service';
import type { Room } from '../projects/entities/room.entity';
import { DimensionSource } from '../projects/entities/room-dimensions.entity';
import type { EstimationResult } from '../estimations/entities/estimation-result.entity';
import type { ShoppingList } from '../shopping-lists/entities/shopping-list.entity';

const mockProjectId = 'project-1';
const mockUserId = 'user-1';
const mockOrgId = 'org-1';

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'room-1',
    project_id: mockProjectId,
    name: 'Salon',
    sort_order: 0,
    created_at: new Date(),
    updated_at: new Date(),
    dimensions: {
      id: 'dim-1',
      room_id: 'room-1',
      length_cm: 400,
      width_cm: 300,
      height_cm: 250,
      confidence_score: 'high',
      source: DimensionSource.MANUAL,
      raw_cv_output_json: null,
      length_cm_uncertainty: null,
      width_cm_uncertainty: null,
      height_cm_uncertainty: null,
      segments_json: null,
      exclusions_json: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    openings: [],
    workItems: [],
    ...overrides,
  } as Room;
}

function makeEstimation(
  overrides: Partial<EstimationResult> = {},
): EstimationResult {
  return {
    id: 'estimation-1',
    project_id: mockProjectId,
    skill_level: 'beginner',
    items_json: [
      {
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
        room_id: 'room-1',
        room_name: 'Salon',
      },
    ],
    aggregated_json: null,
    total_items: 1,
    created_at: new Date(),
    ...overrides,
  } as EstimationResult;
}

function makeShoppingList(overrides: Partial<ShoppingList> = {}): ShoppingList {
  return {
    id: 'shopping-list-1',
    project_id: mockProjectId,
    estimation_id: 'estimation-1',
    items_json: {
      material_items: [
        {
          material_id: 'mat-paint',
          work_type_code: 'wall_painting',
          work_type_label: 'Peinture murale',
          material_name: 'Peinture acrylique mate',
          material_category: 'painting',
          material_unit: 'L',
          packaging_label: 'Pot 10 L',
          packaging_qty_per_unit: 10,
          adjusted_qty: 1.05,
          original_units_needed: 1,
          units_needed: 1,
          is_manually_adjusted: false,
          real_unit_price: 45.5,
          store_name: 'Leroy Merlin',
        },
      ],
      complementary_items: [],
    },
    budget_summary_json: null,
    share_token: null,
    share_token_created_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as ShoppingList;
}

describe('LogbookService', () => {
  let service: LogbookService;

  const repoMock = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const projectsServiceMock = {
    findOneForOrg: jest.fn(),
    getRooms: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    projectsServiceMock.findOneForOrg.mockResolvedValue({
      id: mockProjectId,
      user_id: mockUserId,
      organization_id: mockOrgId,
      name: 'Rénovation salon',
    });
    repoMock.create.mockImplementation((v: Partial<RoomLogEntry>) => v);
    repoMock.save.mockImplementation((v: Partial<RoomLogEntry>) =>
      Promise.resolve(v),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogbookService,
        { provide: getRepositoryToken(RoomLogEntry), useValue: repoMock },
        { provide: ProjectsService, useValue: projectsServiceMock },
      ],
    }).compile();

    service = module.get(LogbookService);
  });

  describe('findAllByUser', () => {
    it("liste les entrées de l'utilisateur triées par date décroissante", async () => {
      repoMock.find.mockResolvedValue([]);

      await service.findAllByUser(mockUserId);

      expect(repoMock.find).toHaveBeenCalledWith({
        where: { user_id: mockUserId },
        order: { recorded_at: 'DESC' },
      });
    });
  });

  describe('recordChantierCompletion', () => {
    it('crée une entrée par pièce avec dimensions et matériaux du chantier', async () => {
      projectsServiceMock.getRooms.mockResolvedValue([makeRoom()]);
      repoMock.findOne.mockResolvedValue(null);

      await service.recordChantierCompletion(
        mockProjectId,
        mockOrgId,
        mockUserId,
        makeEstimation(),
        makeShoppingList(),
      );

      expect(repoMock.save).toHaveBeenCalledTimes(1);
      expect(repoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          room_name: 'Salon',
          project_name: 'Rénovation salon',
          dimensions_snapshot: {
            length_cm: 400,
            width_cm: 300,
            height_cm: 250,
            source: DimensionSource.MANUAL,
            segments_json: null,
          },
          materials_snapshot: [
            {
              material_id: 'mat-paint',
              material_name: 'Peinture acrylique mate',
              material_category: 'painting',
              work_type_label: 'Peinture murale',
              pose_type: 'standard',
              real_unit_price: 45.5,
              store_name: 'Leroy Merlin',
            },
          ],
        }),
      );
    });

    it('ignore les pièces sans dimensions validées', async () => {
      projectsServiceMock.getRooms.mockResolvedValue([
        makeRoom({ dimensions: null }),
      ]);

      await service.recordChantierCompletion(
        mockProjectId,
        mockOrgId,
        mockUserId,
        makeEstimation(),
        makeShoppingList(),
      );

      expect(repoMock.save).not.toHaveBeenCalled();
    });

    it('met à jour l’entrée existante plutôt que de la dupliquer (ré-finalisation)', async () => {
      projectsServiceMock.getRooms.mockResolvedValue([makeRoom()]);
      const existing = {
        id: 'log-1',
        project_id: mockProjectId,
        room_id: 'room-1',
      };
      repoMock.findOne.mockResolvedValue(existing);

      await service.recordChantierCompletion(
        mockProjectId,
        mockOrgId,
        mockUserId,
        makeEstimation(),
        makeShoppingList(),
      );

      expect(repoMock.create).not.toHaveBeenCalled();
      expect(repoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'log-1' }),
      );
    });
  });
});
