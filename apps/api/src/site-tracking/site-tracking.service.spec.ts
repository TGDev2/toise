import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SiteTrackingService } from './site-tracking.service';
import {
  SiteMilestone,
  MilestoneStatus,
} from './entities/site-milestone.entity';
import { ProjectsService } from '../projects/projects.service';

const mockProjectId = 'project-1';
const mockUserId = 'user-1';

function makeMilestone(overrides: Partial<SiteMilestone> = {}): SiteMilestone {
  return {
    id: 'milestone-1',
    project_id: mockProjectId,
    label: 'Démolition',
    status: MilestoneStatus.PENDING,
    planned_date: null,
    actual_date: null,
    sort_order: 0,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as SiteMilestone;
}

describe('SiteTrackingService', () => {
  let service: SiteTrackingService;

  const repoMock = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
  };

  const projectsServiceMock = {
    findOneByUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    projectsServiceMock.findOneByUser.mockResolvedValue({
      id: mockProjectId,
      user_id: mockUserId,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SiteTrackingService,
        { provide: getRepositoryToken(SiteMilestone), useValue: repoMock },
        { provide: ProjectsService, useValue: projectsServiceMock },
      ],
    }).compile();

    service = module.get(SiteTrackingService);
  });

  describe('findAllForProject', () => {
    it('vérifie la propriété du projet avant de lister les jalons', async () => {
      repoMock.find.mockResolvedValue([makeMilestone()]);

      const result = await service.findAllForProject(mockProjectId, mockUserId);

      expect(projectsServiceMock.findOneByUser).toHaveBeenCalledWith(
        mockProjectId,
        mockUserId,
      );
      expect(repoMock.find).toHaveBeenCalledWith({
        where: { project_id: mockProjectId },
        order: { sort_order: 'ASC', created_at: 'ASC' },
      });
      expect(result).toHaveLength(1);
    });

    it("propage le rejet d'accès quand le projet n'appartient pas à l'utilisateur", async () => {
      projectsServiceMock.findOneByUser.mockRejectedValue(
        new ForbiddenException('Access denied'),
      );

      await expect(
        service.findAllForProject(mockProjectId, 'another-user'),
      ).rejects.toThrow(ForbiddenException);
      expect(repoMock.find).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('place le nouveau jalon à la fin (sort_order = count existant)', async () => {
      repoMock.count.mockResolvedValue(2);
      repoMock.create.mockImplementation((v: Partial<SiteMilestone>) => v);
      repoMock.save.mockImplementation((v: Partial<SiteMilestone>) =>
        Promise.resolve(v),
      );

      const result = await service.create(mockProjectId, mockUserId, {
        label: 'Peinture',
      });

      expect(result.sort_order).toBe(2);
      expect(result.planned_date).toBeNull();
    });

    it('respecte un sort_order explicite', async () => {
      repoMock.create.mockImplementation((v: Partial<SiteMilestone>) => v);
      repoMock.save.mockImplementation((v: Partial<SiteMilestone>) =>
        Promise.resolve(v),
      );

      const result = await service.create(mockProjectId, mockUserId, {
        label: 'Plomberie',
        sort_order: 5,
      });

      expect(repoMock.count).not.toHaveBeenCalled();
      expect(result.sort_order).toBe(5);
    });
  });

  describe('update', () => {
    it("fixe automatiquement actual_date au jour meme quand le statut passe a 'done' sans date fournie", async () => {
      repoMock.findOne.mockResolvedValue(makeMilestone());
      repoMock.save.mockImplementation((v) => Promise.resolve(v));

      const result = await service.update(
        mockProjectId,
        mockUserId,
        'milestone-1',
        {
          status: MilestoneStatus.DONE,
        },
      );

      const today = new Date().toISOString().slice(0, 10);
      expect(result.status).toBe(MilestoneStatus.DONE);
      expect(result.actual_date).toBe(today);
    });

    it('respecte une actual_date explicite plutôt que la date du jour', async () => {
      repoMock.findOne.mockResolvedValue(makeMilestone());
      repoMock.save.mockImplementation((v) => Promise.resolve(v));

      const result = await service.update(
        mockProjectId,
        mockUserId,
        'milestone-1',
        {
          status: MilestoneStatus.DONE,
          actual_date: '2026-01-15',
        },
      );

      expect(result.actual_date).toBe('2026-01-15');
    });

    it("ne réécrit pas actual_date si déjà renseignée et qu'aucune date n'est fournie", async () => {
      repoMock.findOne.mockResolvedValue(
        makeMilestone({ actual_date: '2026-01-01' }),
      );
      repoMock.save.mockImplementation((v) => Promise.resolve(v));

      const result = await service.update(
        mockProjectId,
        mockUserId,
        'milestone-1',
        {
          status: MilestoneStatus.DONE,
        },
      );

      expect(result.actual_date).toBe('2026-01-01');
    });

    it("lève une 404 si le jalon n'appartient pas au projet", async () => {
      repoMock.findOne.mockResolvedValue(null);

      await expect(
        service.update(mockProjectId, mockUserId, 'unknown', { label: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('supprime le jalon après vérification de propriété', async () => {
      const milestone = makeMilestone();
      repoMock.findOne.mockResolvedValue(milestone);

      await service.remove(mockProjectId, mockUserId, 'milestone-1');

      expect(repoMock.remove).toHaveBeenCalledWith(milestone);
    });
  });
});
