import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { Project, WorkType, ProjectStatus } from './entities/project.entity';
import {
  RoomDimensions,
  ConfidenceScore,
  DimensionSource,
} from './entities/room-dimensions.entity';
import { Opening, OpeningType } from './entities/opening.entity';

const mockProject: Project = {
  id: 'project-uuid',
  user_id: 'user-uuid',
  name: 'Renovation salon',
  room_name: 'Salon',
  work_type: WorkType.PAINTING,
  status: ProjectStatus.DRAFT,
  created_at: new Date('2026-03-27T00:00:00.000Z'),
  updated_at: new Date('2026-03-27T00:00:00.000Z'),
  user: null as never,
  dimensions: null,
  openings: [],
};

const mockOpening: Opening = {
  id: 'opening-uuid',
  project_id: 'project-uuid',
  type: OpeningType.DOOR,
  width_cm: 90,
  height_cm: 204,
  count: 1,
  created_at: new Date('2026-03-27T00:00:00.000Z'),
  updated_at: new Date('2026-03-27T00:00:00.000Z'),
  project: null as never,
};

const mockDimensions: RoomDimensions = {
  id: 'dim-uuid',
  project_id: 'project-uuid',
  length_cm: 500,
  width_cm: 400,
  height_cm: 250,
  confidence_score: ConfidenceScore.HIGH,
  source: DimensionSource.MANUAL,
  created_at: new Date('2026-03-27T00:00:00.000Z'),
  updated_at: new Date('2026-03-27T00:00:00.000Z'),
  project: null as never,
};

const projectsRepoMock = {
  create: jest.fn().mockReturnValue(mockProject),
  save: jest.fn().mockResolvedValue(mockProject),
  find: jest.fn().mockResolvedValue([mockProject]),
  findOne: jest.fn().mockResolvedValue(mockProject),
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
};

describe('ProjectsService', () => {
  let service: ProjectsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getRepositoryToken(Project), useValue: projectsRepoMock },
        {
          provide: getRepositoryToken(RoomDimensions),
          useValue: dimensionsRepoMock,
        },
        { provide: getRepositoryToken(Opening), useValue: openingsRepoMock },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  describe('createProject', () => {
    it('creates and returns a project', async () => {
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
      expect(result).toEqual(mockProject);
    });
  });

  describe('findByUser', () => {
    it('returns projects for the user', async () => {
      const result = await service.findByUser('user-uuid');
      expect(projectsRepoMock.find).toHaveBeenCalledWith({
        where: { user_id: 'user-uuid' },
        order: { created_at: 'DESC' },
      });
      expect(result).toEqual([mockProject]);
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

  describe('updateDimensions', () => {
    it('creates dimensions when none exist', async () => {
      dimensionsRepoMock.findOne.mockResolvedValueOnce(null);

      await service.updateDimensions('project-uuid', 'user-uuid', {
        length_cm: 500,
        width_cm: 400,
        height_cm: 250,
      });

      expect(dimensionsRepoMock.create).toHaveBeenCalledWith({
        project_id: 'project-uuid',
        length_cm: 500,
        width_cm: 400,
        height_cm: 250,
        source: DimensionSource.MANUAL,
        confidence_score: ConfidenceScore.HIGH,
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
  });

  describe('getDimensions', () => {
    it('returns dimensions for a project', async () => {
      dimensionsRepoMock.findOne.mockResolvedValueOnce(mockDimensions);

      const result = await service.getDimensions('project-uuid', 'user-uuid');
      expect(result).toEqual(mockDimensions);
    });

    it('returns null when no dimensions exist', async () => {
      dimensionsRepoMock.findOne.mockResolvedValueOnce(null);

      const result = await service.getDimensions('project-uuid', 'user-uuid');
      expect(result).toBeNull();
    });
  });

  describe('addOpening', () => {
    it('creates and returns an opening', async () => {
      const result = await service.addOpening('project-uuid', 'user-uuid', {
        type: OpeningType.DOOR,
        width_cm: 90,
        height_cm: 204,
        count: 1,
      });

      expect(openingsRepoMock.create).toHaveBeenCalledWith({
        project_id: 'project-uuid',
        type: OpeningType.DOOR,
        width_cm: 90,
        height_cm: 204,
        count: 1,
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
  });

  describe('removeOpening', () => {
    it('removes the opening', async () => {
      openingsRepoMock.findOne.mockResolvedValueOnce(mockOpening);

      await service.removeOpening('project-uuid', 'user-uuid', 'opening-uuid');
      expect(openingsRepoMock.remove).toHaveBeenCalledWith(mockOpening);
    });

    it('throws NotFoundException when opening does not exist', async () => {
      openingsRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(
        service.removeOpening('project-uuid', 'user-uuid', 'missing-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOpenings', () => {
    it('returns openings for a project', async () => {
      openingsRepoMock.find.mockResolvedValueOnce([mockOpening]);

      const result = await service.getOpenings('project-uuid', 'user-uuid');
      expect(result).toEqual([mockOpening]);
      expect(openingsRepoMock.find).toHaveBeenCalledWith({
        where: { project_id: 'project-uuid' },
        order: { created_at: 'ASC' },
      });
    });
  });
});
