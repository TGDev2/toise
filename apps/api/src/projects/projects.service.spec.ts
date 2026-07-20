import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FeatureGatesService } from '../feature-gates/feature-gates.service';
import { SubscriptionTier } from '../users/entities/user.entity';
import { ProjectsService } from './projects.service';
import { Project, WorkType, ProjectStatus } from './entities/project.entity';
import { Room } from './entities/room.entity';
import {
  RoomDimensions,
  ConfidenceScore,
  DimensionSource,
  ExclusionType,
} from './entities/room-dimensions.entity';
import { Opening, OpeningType, OpeningSource } from './entities/opening.entity';
import { WorkType as WorkTypeEntity } from './entities/work-type.entity';
import {
  ProjectWorkItem,
  SkillLevel,
} from './entities/project-work-item.entity';

const mockProject: Project = {
  id: 'project-uuid',
  user_id: 'user-uuid',
  name: 'Renovation salon',
  room_name: 'Salon',
  work_type: WorkType.PAINTING,
  status: ProjectStatus.DRAFT,
  created_at: new Date('2026-03-27T00:00:00.000Z'),
  updated_at: new Date('2026-03-27T00:00:00.000Z'),
  deleted_at: null,
  user: null as never,
  rooms: [],
  photos: [],
  // getters de compatibilité (pièce par défaut) — valeurs inertes pour le mock
  dimensions: null,
  openings: [],
};

const mockRoom: Room = {
  id: 'room-uuid',
  project_id: 'project-uuid',
  name: 'Salon',
  sort_order: 0,
  created_at: new Date('2026-03-27T00:00:00.000Z'),
  updated_at: new Date('2026-03-27T00:00:00.000Z'),
  project: null as never,
  dimensions: null,
  openings: [],
  workItems: [],
};

const mockOpening: Opening = {
  id: 'opening-uuid',
  room_id: 'room-uuid',
  type: OpeningType.DOOR,
  width_cm: 90,
  height_cm: 204,
  count: 1,
  source: OpeningSource.MANUAL,
  cv_confidence: null,
  created_at: new Date('2026-03-27T00:00:00.000Z'),
  updated_at: new Date('2026-03-27T00:00:00.000Z'),
  room: mockRoom,
};

const mockDimensions: RoomDimensions = {
  id: 'dim-uuid',
  room_id: 'room-uuid',
  length_cm: 500,
  width_cm: 400,
  height_cm: 250,
  confidence_score: ConfidenceScore.HIGH,
  source: DimensionSource.MANUAL,
  raw_cv_output_json: null,
  segments_json: null,
  exclusions_json: null,
  created_at: new Date('2026-03-27T00:00:00.000Z'),
  updated_at: new Date('2026-03-27T00:00:00.000Z'),
  room: null as never,
};

const projectsRepoMock = {
  create: jest.fn().mockReturnValue(mockProject),
  save: jest.fn().mockResolvedValue(mockProject),
  count: jest.fn().mockResolvedValue(0),
  find: jest.fn().mockResolvedValue([mockProject]),
  findOne: jest.fn().mockResolvedValue(mockProject),
  findAndCount: jest.fn().mockResolvedValue([[mockProject], 1]),
  softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
};

const roomsRepoMock = {
  create: jest.fn().mockReturnValue(mockRoom),
  save: jest.fn().mockResolvedValue(mockRoom),
  find: jest.fn().mockResolvedValue([mockRoom]),
  findOne: jest.fn().mockResolvedValue(mockRoom),
  count: jest.fn().mockResolvedValue(1),
  remove: jest.fn().mockResolvedValue(undefined),
};

const dimensionsRepoMock = {
  create: jest.fn().mockReturnValue(mockDimensions),
  save: jest.fn().mockResolvedValue(mockDimensions),
  findOne: jest.fn().mockResolvedValue(null),
};

const openingsRepoMock = {
  create: jest.fn().mockReturnValue(mockOpening),
  save: jest.fn().mockResolvedValue(mockOpening),
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  remove: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue({ affected: 0 }),
};

const mockWorkType: WorkTypeEntity = {
  id: 'wt-wall-painting',
  code: 'wall_painting',
  label_fr: 'Peinture murale',
  category: 'painting',
  surface_target: 'wall',
  waste_factor_base: 1.1,
  required_materials: [],
  contextual_questions: [],
  display_order: 1,
  created_at: new Date('2026-03-27T00:00:00.000Z'),
  updated_at: new Date('2026-03-27T00:00:00.000Z'),
};

const mockFloorTilingWorkType: WorkTypeEntity = {
  id: 'wt-floor-tiling',
  code: 'floor_tiling',
  label_fr: 'Carrelage sol',
  category: 'tiling',
  surface_target: 'floor',
  waste_factor_base: 1.1,
  required_materials: [],
  contextual_questions: [
    {
      key: 'tile_format',
      type: 'select',
      label_fr: 'Format du carreau',
      options: [{ value: '30x30', label_fr: '30 x 30 cm' }],
      required: true,
    },
    {
      key: 'laying_pattern',
      type: 'select',
      label_fr: 'Type de pose',
      options: [{ value: 'straight', label_fr: 'Pose droite' }],
      required: true,
    },
  ],
  display_order: 3,
  created_at: new Date('2026-03-27T00:00:00.000Z'),
  updated_at: new Date('2026-03-27T00:00:00.000Z'),
};

const mockWorkItem: ProjectWorkItem = {
  id: 'wi-uuid',
  room_id: 'room-uuid',
  work_type_id: 'wt-wall-painting',
  skill_level: SkillLevel.BEGINNER,
  custom_params: {},
  created_at: new Date('2026-03-27T00:00:00.000Z'),
  updated_at: new Date('2026-03-27T00:00:00.000Z'),
  room: null as never,
  work_type: mockWorkType,
};

const workTypesRepoMock = {
  find: jest.fn().mockResolvedValue([mockWorkType]),
};

const workItemsRepoMock = {
  create: jest.fn().mockReturnValue(mockWorkItem),
  save: jest.fn().mockResolvedValue([mockWorkItem]),
  find: jest.fn().mockResolvedValue([mockWorkItem]),
  delete: jest.fn().mockResolvedValue({ affected: 0 }),
};

const featureGatesServiceMock = {
  isFeatureAllowed: jest.fn().mockResolvedValue(true),
};

describe('ProjectsService', () => {
  let service: ProjectsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getRepositoryToken(Project), useValue: projectsRepoMock },
        { provide: getRepositoryToken(Room), useValue: roomsRepoMock },
        {
          provide: getRepositoryToken(RoomDimensions),
          useValue: dimensionsRepoMock,
        },
        { provide: getRepositoryToken(Opening), useValue: openingsRepoMock },
        {
          provide: getRepositoryToken(WorkTypeEntity),
          useValue: workTypesRepoMock,
        },
        {
          provide: getRepositoryToken(ProjectWorkItem),
          useValue: workItemsRepoMock,
        },
        {
          provide: FeatureGatesService,
          useValue: featureGatesServiceMock,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  describe('createProject', () => {
    it('creates a project and its default room', async () => {
      const result = await service.createProject('user-uuid', {
        name: 'Renovation salon',
        room_name: 'Salon',
        work_type: WorkType.PAINTING,
      });

      expect(projectsRepoMock.create).toHaveBeenCalledWith({
        user_id: 'user-uuid',
        name: 'Renovation salon',
        room_name: 'Salon',
        work_type: WorkType.PAINTING,
      });
      expect(projectsRepoMock.save).toHaveBeenCalled();
      // Une pièce par défaut est créée pour tout nouveau projet.
      expect(roomsRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ project_id: 'project-uuid', sort_order: 0 }),
      );
      expect(roomsRepoMock.save).toHaveBeenCalled();
      expect(result).toEqual(mockProject);
    });

    it('blocks free tier users when the project limit is reached', async () => {
      featureGatesServiceMock.isFeatureAllowed.mockResolvedValueOnce(false);
      projectsRepoMock.count.mockResolvedValueOnce(2);

      await expect(
        service.createProject(
          'user-uuid',
          {
            name: 'Renovation salon',
            room_name: 'Salon',
            work_type: WorkType.PAINTING,
          },
          SubscriptionTier.FREE,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findByUser', () => {
    it('returns paginated projects for the user', async () => {
      const result = await service.findByUser('user-uuid', {});
      expect(projectsRepoMock.findAndCount).toHaveBeenCalledWith({
        where: { user_id: 'user-uuid' },
        order: { updated_at: 'DESC' },
        skip: 0,
        take: 12,
      });
      expect(result.data).toEqual([mockProject]);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 12,
        totalPages: 1,
      });
    });

    it('applies page and limit from query', async () => {
      await service.findByUser('user-uuid', { page: 2, limit: 5 });
      expect(projectsRepoMock.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });

    it('filters by status when provided', async () => {
      await service.findByUser('user-uuid', { status: ProjectStatus.DRAFT });
      expect(projectsRepoMock.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'user-uuid', status: ProjectStatus.DRAFT },
        }),
      );
    });
  });

  describe('findOneByUser', () => {
    it('returns the project if owned by user', async () => {
      const result = await service.findOneByUser('project-uuid', 'user-uuid');
      expect(result).toEqual(mockProject);
    });

    it('throws NotFoundException if project does not exist', async () => {
      projectsRepoMock.findOne.mockResolvedValueOnce(null);
      await expect(
        service.findOneByUser('missing-uuid', 'user-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if user does not own project', async () => {
      await expect(
        service.findOneByUser('project-uuid', 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getRooms', () => {
    it('returns all rooms of a project with geometry and work items loaded', async () => {
      const result = await service.getRooms('project-uuid', 'user-uuid');
      expect(roomsRepoMock.find).toHaveBeenCalledWith({
        where: { project_id: 'project-uuid' },
        relations: [
          'dimensions',
          'openings',
          'workItems',
          'workItems.work_type',
        ],
        order: { sort_order: 'ASC', created_at: 'ASC' },
      });
      expect(result).toEqual([mockRoom]);
    });

    it('throws ForbiddenException for wrong user', async () => {
      await expect(
        service.getRooms('project-uuid', 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createRoom', () => {
    it('creates a room with an auto name and appended sort_order', async () => {
      roomsRepoMock.count.mockResolvedValueOnce(1);

      await service.createRoom('project-uuid', 'user-uuid', {});

      expect(roomsRepoMock.create).toHaveBeenCalledWith({
        project_id: 'project-uuid',
        name: 'Pièce 2',
        sort_order: 1,
      });
      expect(roomsRepoMock.save).toHaveBeenCalled();
    });

    it('uses the provided (trimmed) name', async () => {
      roomsRepoMock.count.mockResolvedValueOnce(0);

      await service.createRoom('project-uuid', 'user-uuid', {
        name: '  Chambre  ',
      });

      expect(roomsRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Chambre', sort_order: 0 }),
      );
    });

    it('throws ForbiddenException for wrong user', async () => {
      await expect(
        service.createRoom('project-uuid', 'other-user', {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('renameRoom', () => {
    it('renames an existing room', async () => {
      roomsRepoMock.findOne.mockResolvedValueOnce({ ...mockRoom });

      await service.renameRoom('project-uuid', 'user-uuid', 'room-uuid', {
        name: 'Cuisine',
      });

      expect(roomsRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Cuisine' }),
      );
    });

    it('throws NotFoundException when the room does not belong to the project', async () => {
      roomsRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(
        service.renameRoom('project-uuid', 'user-uuid', 'missing', {
          name: 'X',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteRoom', () => {
    it('deletes a room when more than one remains', async () => {
      roomsRepoMock.count.mockResolvedValueOnce(2);
      const room = { ...mockRoom };
      roomsRepoMock.findOne.mockResolvedValueOnce(room);

      await service.deleteRoom('project-uuid', 'user-uuid', 'room-uuid');

      expect(roomsRepoMock.remove).toHaveBeenCalledWith(room);
    });

    it('refuses to delete the last remaining room', async () => {
      roomsRepoMock.count.mockResolvedValueOnce(1);

      await expect(
        service.deleteRoom('project-uuid', 'user-uuid', 'room-uuid'),
      ).rejects.toThrow(BadRequestException);
      expect(roomsRepoMock.remove).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the room does not belong to the project', async () => {
      roomsRepoMock.count.mockResolvedValueOnce(2);
      roomsRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(
        service.deleteRoom('project-uuid', 'user-uuid', 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('roomId targeting (Phase 2)', () => {
    it('getDimensions with a valid roomId reads that room', async () => {
      roomsRepoMock.findOne.mockResolvedValueOnce({ ...mockRoom });
      dimensionsRepoMock.findOne.mockResolvedValueOnce(mockDimensions);

      const result = await service.getDimensions(
        'project-uuid',
        'user-uuid',
        'room-uuid',
      );

      expect(roomsRepoMock.findOne).toHaveBeenCalledWith({
        where: { id: 'room-uuid', project_id: 'project-uuid' },
      });
      expect(result).toEqual(mockDimensions);
    });

    it('getDimensions throws NotFoundException for a roomId outside the project', async () => {
      roomsRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(
        service.getDimensions('project-uuid', 'user-uuid', 'foreign-room'),
      ).rejects.toThrow(NotFoundException);
    });

    it('updateDimensions with a roomId targets that room', async () => {
      roomsRepoMock.findOne.mockResolvedValueOnce({ ...mockRoom });
      dimensionsRepoMock.findOne.mockResolvedValueOnce(null);

      await service.updateDimensions(
        'project-uuid',
        'user-uuid',
        { length_cm: 300, width_cm: 300, height_cm: 250 },
        undefined,
        'room-uuid',
      );

      expect(dimensionsRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ room_id: 'room-uuid' }),
      );
    });
  });

  describe('updateDimensions', () => {
    it('creates dimensions on the default room when none exist', async () => {
      dimensionsRepoMock.findOne.mockResolvedValueOnce(null);

      await service.updateDimensions('project-uuid', 'user-uuid', {
        length_cm: 500,
        width_cm: 400,
        height_cm: 250,
      });

      expect(dimensionsRepoMock.create).toHaveBeenCalledWith({
        room_id: 'room-uuid',
        length_cm: 500,
        width_cm: 400,
        height_cm: 250,
        source: DimensionSource.MANUAL,
        confidence_score: ConfidenceScore.HIGH,
        segments_json: null,
        exclusions_json: null,
        raw_cv_output_json: null,
      });
      expect(dimensionsRepoMock.save).toHaveBeenCalled();
    });

    it('updates existing dimensions', async () => {
      dimensionsRepoMock.findOne.mockResolvedValueOnce({ ...mockDimensions });

      await service.updateDimensions('project-uuid', 'user-uuid', {
        length_cm: 600,
        width_cm: 500,
        height_cm: 300,
      });

      expect(dimensionsRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          length_cm: 600,
          width_cm: 500,
          height_cm: 300,
        }),
      );
    });

    // ENG-3: surfaces à exclure (déduction manuelle simple)
    it('persists exclusions_json when exclusions are provided', async () => {
      dimensionsRepoMock.findOne.mockResolvedValueOnce(null);

      await service.updateDimensions('project-uuid', 'user-uuid', {
        length_cm: 500,
        width_cm: 400,
        height_cm: 250,
        exclusions: [
          { surface_target: 'wall', type: ExclusionType.CREDENCE, area_m2: 2 },
        ],
      });

      expect(dimensionsRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          exclusions_json: [
            {
              surface_target: 'wall',
              type: ExclusionType.CREDENCE,
              area_m2: 2,
            },
          ],
        }),
      );
    });

    it('clears exclusions_json when exclusions are absent from the payload', async () => {
      dimensionsRepoMock.findOne.mockResolvedValueOnce({
        ...mockDimensions,
        exclusions_json: [
          { surface_target: 'wall', type: ExclusionType.CREDENCE, area_m2: 2 },
        ],
      });

      await service.updateDimensions('project-uuid', 'user-uuid', {
        length_cm: 600,
        width_cm: 500,
        height_cm: 300,
      });

      expect(dimensionsRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ exclusions_json: null }),
      );
    });
  });

  describe('getDimensions', () => {
    it('returns dimensions for the default room', async () => {
      dimensionsRepoMock.findOne.mockResolvedValueOnce(mockDimensions);

      const result = await service.getDimensions('project-uuid', 'user-uuid');
      expect(result).toEqual(mockDimensions);
    });

    it('returns null when no dimensions exist', async () => {
      dimensionsRepoMock.findOne.mockResolvedValueOnce(null);

      const result = await service.getDimensions('project-uuid', 'user-uuid');
      expect(result).toBeNull();
    });

    it('returns null when the project has no room yet', async () => {
      roomsRepoMock.findOne.mockResolvedValueOnce(null);

      const result = await service.getDimensions('project-uuid', 'user-uuid');
      expect(result).toBeNull();
    });
  });

  describe('addOpening', () => {
    it('creates and returns an opening on the default room', async () => {
      const result = await service.addOpening('project-uuid', 'user-uuid', {
        type: OpeningType.DOOR,
        width_cm: 90,
        height_cm: 204,
        count: 1,
      });

      expect(openingsRepoMock.create).toHaveBeenCalledWith({
        room_id: 'room-uuid',
        type: OpeningType.DOOR,
        width_cm: 90,
        height_cm: 204,
        count: 1,
        source: OpeningSource.MANUAL,
        cv_confidence: null,
      });
      expect(openingsRepoMock.save).toHaveBeenCalled();
      expect(result).toEqual(mockOpening);
    });

    it('defaults count to 1 when not provided', async () => {
      await service.addOpening('project-uuid', 'user-uuid', {
        type: OpeningType.WINDOW,
        width_cm: 120,
        height_cm: 100,
      });

      expect(openingsRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ count: 1 }),
      );
    });
  });

  describe('updateOpening', () => {
    it('updates and returns the opening', async () => {
      openingsRepoMock.findOne.mockResolvedValueOnce({ ...mockOpening });

      const result = await service.updateOpening(
        'project-uuid',
        'user-uuid',
        'opening-uuid',
        { width_cm: 100 },
      );

      expect(openingsRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ width_cm: 100 }),
      );
      expect(result).toBeDefined();
    });

    it('throws NotFoundException when opening does not exist', async () => {
      openingsRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(
        service.updateOpening('project-uuid', 'user-uuid', 'missing-uuid', {
          width_cm: 100,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the opening belongs to another project', async () => {
      openingsRepoMock.findOne.mockResolvedValueOnce({
        ...mockOpening,
        room: { ...mockRoom, project_id: 'other-project' },
      });

      await expect(
        service.updateOpening('project-uuid', 'user-uuid', 'opening-uuid', {
          width_cm: 100,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeOpening', () => {
    it('removes the opening', async () => {
      const opening = { ...mockOpening };
      openingsRepoMock.findOne.mockResolvedValueOnce(opening);

      await service.removeOpening('project-uuid', 'user-uuid', 'opening-uuid');
      expect(openingsRepoMock.remove).toHaveBeenCalledWith(opening);
    });

    it('throws NotFoundException when opening does not exist', async () => {
      openingsRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(
        service.removeOpening('project-uuid', 'user-uuid', 'missing-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOpenings', () => {
    it('returns openings of the default room', async () => {
      openingsRepoMock.find.mockResolvedValueOnce([mockOpening]);

      const result = await service.getOpenings('project-uuid', 'user-uuid');
      expect(result).toEqual([mockOpening]);
      expect(openingsRepoMock.find).toHaveBeenCalledWith({
        where: { room_id: 'room-uuid' },
        order: { created_at: 'ASC' },
      });
    });

    it('returns an empty list when the project has no room yet', async () => {
      roomsRepoMock.findOne.mockResolvedValueOnce(null);

      const result = await service.getOpenings('project-uuid', 'user-uuid');
      expect(result).toEqual([]);
    });
  });

  describe('removeCvOpenings', () => {
    it('deletes CV openings across all rooms of the project', async () => {
      roomsRepoMock.find.mockResolvedValueOnce([mockRoom]);

      await service.removeCvOpenings('project-uuid');

      expect(openingsRepoMock.delete).toHaveBeenCalledWith(
        expect.objectContaining({ source: OpeningSource.CV }),
      );
    });

    it('is a no-op when the project has no room', async () => {
      roomsRepoMock.find.mockResolvedValueOnce([]);

      await service.removeCvOpenings('project-uuid');

      expect(openingsRepoMock.delete).not.toHaveBeenCalled();
    });
  });

  describe('getWorkTypes', () => {
    it('returns work types ordered by display_order', async () => {
      const result = await service.getWorkTypes();
      expect(workTypesRepoMock.find).toHaveBeenCalledWith({
        order: { display_order: 'ASC' },
      });
      expect(result).toEqual([mockWorkType]);
    });
  });

  describe('saveWorkItems', () => {
    it('saves work items on the default room', async () => {
      workTypesRepoMock.find.mockResolvedValueOnce([mockWorkType]);
      workItemsRepoMock.find.mockResolvedValueOnce([mockWorkItem]);

      const result = await service.saveWorkItems('project-uuid', 'user-uuid', {
        items: [
          {
            work_type_id: 'wt-wall-painting',
            skill_level: SkillLevel.BEGINNER,
            custom_params: {},
          },
        ],
      });

      expect(workItemsRepoMock.delete).toHaveBeenCalledWith({
        room_id: 'room-uuid',
      });
      expect(workItemsRepoMock.create).toHaveBeenCalledWith({
        room_id: 'room-uuid',
        work_type_id: 'wt-wall-painting',
        skill_level: SkillLevel.BEGINNER,
        custom_params: {},
      });
      expect(workItemsRepoMock.save).toHaveBeenCalled();
      expect(result).toEqual([mockWorkItem]);
    });

    it('throws BadRequestException for invalid work_type_id', async () => {
      workTypesRepoMock.find.mockResolvedValueOnce([]);

      await expect(
        service.saveWorkItems('project-uuid', 'user-uuid', {
          items: [
            {
              work_type_id: 'invalid-uuid',
              skill_level: SkillLevel.BEGINNER,
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when required contextual params are missing', async () => {
      workTypesRepoMock.find.mockResolvedValueOnce([mockFloorTilingWorkType]);

      await expect(
        service.saveWorkItems('project-uuid', 'user-uuid', {
          items: [
            {
              work_type_id: 'wt-floor-tiling',
              skill_level: SkillLevel.BEGINNER,
              custom_params: {},
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts floor_tiling with all required contextual params', async () => {
      workTypesRepoMock.find.mockResolvedValueOnce([mockFloorTilingWorkType]);

      const tilingWorkItem: ProjectWorkItem = {
        ...mockWorkItem,
        work_type_id: 'wt-floor-tiling',
        custom_params: { tile_format: '30x30', laying_pattern: 'straight' },
        work_type: mockFloorTilingWorkType,
      };
      workItemsRepoMock.find.mockResolvedValueOnce([tilingWorkItem]);

      const result = await service.saveWorkItems('project-uuid', 'user-uuid', {
        items: [
          {
            work_type_id: 'wt-floor-tiling',
            skill_level: SkillLevel.BEGINNER,
            custom_params: {
              tile_format: '30x30',
              laying_pattern: 'straight',
            },
          },
        ],
      });

      expect(result).toEqual([tilingWorkItem]);
    });

    it('throws ForbiddenException for wrong user', async () => {
      await expect(
        service.saveWorkItems('project-uuid', 'other-user', {
          items: [
            {
              work_type_id: 'wt-wall-painting',
              skill_level: SkillLevel.BEGINNER,
            },
          ],
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getWorkItems', () => {
    it('returns work items of the default room', async () => {
      workItemsRepoMock.find.mockResolvedValueOnce([mockWorkItem]);

      const result = await service.getWorkItems('project-uuid', 'user-uuid');
      expect(result).toEqual([mockWorkItem]);
      expect(workItemsRepoMock.find).toHaveBeenCalledWith({
        where: { room_id: 'room-uuid' },
        relations: ['work_type'],
        order: { work_type: { display_order: 'ASC' } },
      });
    });

    it('returns an empty list when the project has no room yet', async () => {
      roomsRepoMock.findOne.mockResolvedValueOnce(null);

      const result = await service.getWorkItems('project-uuid', 'user-uuid');
      expect(result).toEqual([]);
    });

    it('throws ForbiddenException for wrong user', async () => {
      await expect(
        service.getWorkItems('project-uuid', 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('softDeleteProject', () => {
    it('soft-deletes the project after ownership check', async () => {
      await service.softDeleteProject('project-uuid', 'user-uuid');
      expect(projectsRepoMock.softDelete).toHaveBeenCalledWith('project-uuid');
    });

    it('throws ForbiddenException for wrong user', async () => {
      await expect(
        service.softDeleteProject('project-uuid', 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for missing project', async () => {
      projectsRepoMock.findOne.mockResolvedValueOnce(null);
      await expect(
        service.softDeleteProject('missing-uuid', 'user-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('updates the project status', async () => {
      await service.updateStatus('project-uuid', ProjectStatus.ESTIMATED);
      expect(projectsRepoMock.update).toHaveBeenCalledWith('project-uuid', {
        status: ProjectStatus.ESTIMATED,
      });
    });
  });
});
