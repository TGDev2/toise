import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { CommunityProject } from './entities/community-project.entity';
import { CommunityLike } from './entities/community-like.entity';
import { CommunityComment } from './entities/community-comment.entity';
import { Project, ProjectStatus } from '../projects/entities/project.entity';
import { ProjectPhoto } from '../photos/entities/project-photo.entity';
import { ShoppingList } from '../shopping-lists/entities/shopping-list.entity';
import { CreateCommunityProjectDto } from './dto/create-community-project.dto';

const mockUserId = 'user-1';
const mockProjectId = 'project-1';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: mockProjectId,
    user_id: mockUserId,
    work_type: 'painting',
    status: ProjectStatus.COMPLETED,
    rooms: [],
    ...overrides,
  } as unknown as Project;
}

function makeShoppingList(overrides: Partial<ShoppingList> = {}): ShoppingList {
  return {
    id: 'shopping-list-1',
    project_id: mockProjectId,
    items_json: {
      material_items: [
        {
          material_id: 'mat-1',
          work_type_code: 'wall_painting',
          work_type_label: 'Peinture murale',
          material_name: 'Peinture acrylique mate',
          material_category: 'painting',
          material_unit: 'L',
          packaging_label: 'Pot 10 L',
          packaging_qty_per_unit: 10,
          adjusted_qty: 10.5,
          original_units_needed: 2,
          units_needed: 2,
          is_manually_adjusted: false,
          real_unit_price: 45.5,
          store_name: 'Leroy Merlin',
        },
      ],
      complementary_items: [],
    },
    budget_summary_json: {
      total_real_cost: 91,
      total_brute_cost: 100,
      savings_amount: 9,
      savings_percent: 9,
      items_priced: 1,
      items_total: 1,
      is_complete: true,
      by_category: [
        {
          category: 'painting',
          label: 'Peinture',
          real_cost: 91,
          brute_cost: 100,
        },
      ],
      computed_at: '2026-08-01T00:00:00.000Z',
    },
    ...overrides,
  } as unknown as ShoppingList;
}

function makeDto(overrides: Partial<CreateCommunityProjectDto> = {}) {
  return {
    project_id: mockProjectId,
    title: 'Rénovation salle de bain',
    description: 'Carrelage mural',
    duration_days: 5,
    before_photo_ids: [],
    after_photo_ids: [],
    gdpr_consent: true,
    ...overrides,
  } as CreateCommunityProjectDto;
}

describe('CommunityService', () => {
  let service: CommunityService;

  const communityRepoMock = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
  };
  const likeRepoMock = { findOne: jest.fn() };
  const commentRepoMock = { count: jest.fn(), findAndCount: jest.fn() };
  const projectRepoMock = { findOne: jest.fn() };
  const photoRepoMock = {
    createQueryBuilder: jest.fn(),
  };
  const shoppingListRepoMock = { findOne: jest.fn() };
  const dataSourceMock = { transaction: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    communityRepoMock.create.mockImplementation((data: object) => data);
    communityRepoMock.save.mockImplementation((entity: object) =>
      Promise.resolve(entity),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityService,
        {
          provide: getRepositoryToken(CommunityProject),
          useValue: communityRepoMock,
        },
        { provide: getRepositoryToken(CommunityLike), useValue: likeRepoMock },
        {
          provide: getRepositoryToken(CommunityComment),
          useValue: commentRepoMock,
        },
        { provide: getRepositoryToken(Project), useValue: projectRepoMock },
        { provide: getRepositoryToken(ProjectPhoto), useValue: photoRepoMock },
        {
          provide: getRepositoryToken(ShoppingList),
          useValue: shoppingListRepoMock,
        },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get(CommunityService);
  });

  describe('submitProject', () => {
    it('rejette sans consentement RGPD', async () => {
      await expect(
        service.submitProject(mockUserId, makeDto({ gdpr_consent: false })),
      ).rejects.toThrow(BadRequestException);
      expect(projectRepoMock.findOne).not.toHaveBeenCalled();
    });

    it('rejette si le projet est introuvable', async () => {
      projectRepoMock.findOne.mockResolvedValue(null);

      await expect(
        service.submitProject(mockUserId, makeDto()),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejette si le projet n'appartient pas a l'utilisateur", async () => {
      projectRepoMock.findOne.mockResolvedValue(
        makeProject({ user_id: 'someone-else' }),
      );

      await expect(
        service.submitProject(mockUserId, makeDto()),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejette si le projet n'est pas termine", async () => {
      projectRepoMock.findOne.mockResolvedValue(
        makeProject({ status: ProjectStatus.ESTIMATED }),
      );

      await expect(
        service.submitProject(mockUserId, makeDto()),
      ).rejects.toThrow(BadRequestException);
      expect(shoppingListRepoMock.findOne).not.toHaveBeenCalled();
    });

    it("rejette si aucune liste d'achats n'existe pour le projet", async () => {
      projectRepoMock.findOne.mockResolvedValue(makeProject());
      shoppingListRepoMock.findOne.mockResolvedValue(null);

      await expect(
        service.submitProject(mockUserId, makeDto()),
      ).rejects.toThrow(BadRequestException);
      expect(communityRepoMock.findOne).not.toHaveBeenCalled();
    });

    it("rejette si le budget reel n'a pas ete finalise (budget_summary_json absent)", async () => {
      projectRepoMock.findOne.mockResolvedValue(makeProject());
      shoppingListRepoMock.findOne.mockResolvedValue(
        makeShoppingList({ budget_summary_json: null }),
      );

      await expect(
        service.submitProject(mockUserId, makeDto()),
      ).rejects.toThrow(BadRequestException);
    });

    /**
     * La seule présence du résumé ne prouvait rien : la finalisation acceptait
     * jusqu'ici de persister un résumé partiel, publié tel quel comme référence
     * de coût pour les autres utilisateurs. Elle ne le fait plus, mais les
     * projets finalisés avant ce correctif en portent encore.
     */
    it('rejette un budget finalise mais incomplet', async () => {
      const shoppingList = makeShoppingList();
      projectRepoMock.findOne.mockResolvedValue(makeProject());
      shoppingListRepoMock.findOne.mockResolvedValue({
        ...shoppingList,
        budget_summary_json: {
          ...shoppingList.budget_summary_json,
          items_priced: 1,
          items_total: 3,
          is_complete: false,
        },
      });

      await expect(
        service.submitProject(mockUserId, makeDto()),
      ).rejects.toThrow(BadRequestException);
      expect(communityRepoMock.create).not.toHaveBeenCalled();
    });

    it('rejette si le projet a deja ete soumis a la communaute', async () => {
      projectRepoMock.findOne.mockResolvedValue(makeProject());
      shoppingListRepoMock.findOne.mockResolvedValue(makeShoppingList());
      communityRepoMock.findOne.mockResolvedValue({ id: 'existing-entry' });

      await expect(
        service.submitProject(mockUserId, makeDto()),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejette si une photo ne correspond pas au projet', async () => {
      projectRepoMock.findOne.mockResolvedValue(makeProject());
      shoppingListRepoMock.findOne.mockResolvedValue(makeShoppingList());
      communityRepoMock.findOne.mockResolvedValue(null);
      photoRepoMock.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      await expect(
        service.submitProject(
          mockUserId,
          makeDto({ before_photo_ids: ['photo-1'] }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("fige la liste d'achats reelle et le cout reel sur la publication", async () => {
      const shoppingList = makeShoppingList();
      projectRepoMock.findOne.mockResolvedValue(makeProject());
      shoppingListRepoMock.findOne.mockResolvedValue(shoppingList);
      communityRepoMock.findOne.mockResolvedValue(null);

      const result = await service.submitProject(mockUserId, makeDto());

      expect(communityRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          purchase_list_json: shoppingList.items_json,
          budget_summary_json: shoppingList.budget_summary_json,
          total_cost_cents: 9100,
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({ total_cost_cents: 9100 }),
      );
    });
  });

  describe('getApprovedDetail', () => {
    it('expose purchase_list et budget_summary plutot que materials_list', async () => {
      communityRepoMock.findOne.mockResolvedValue({
        id: 'entry-1',
        title: 'Titre',
        work_type: 'painting',
        description: null,
        purchase_list_json: { material_items: [], complementary_items: [] },
        budget_summary_json: { total_real_cost: 91 },
        total_cost_cents: 9100,
        duration_days: 5,
        length_cm: 300,
        width_cm: 200,
        height_cm: null,
        before_photo_ids: [],
        after_photo_ids: [],
        likes_count: 0,
        published_at: new Date('2026-08-01'),
        user_id: mockUserId,
        user: { email: 'a@b.com' },
      });
      commentRepoMock.count.mockResolvedValue(0);

      const detail = await service.getApprovedDetail('entry-1', null);

      expect(detail).toEqual(
        expect.objectContaining({
          purchase_list: { material_items: [], complementary_items: [] },
          budget_summary: { total_real_cost: 91 },
        }),
      );
      expect(detail).not.toHaveProperty('materials_list');
    });
  });

  describe('listPendingForModeration', () => {
    it('expose purchase_list et budget_summary aux moderateurs', async () => {
      communityRepoMock.findAndCount.mockResolvedValue([
        [
          {
            id: 'entry-1',
            title: 'Titre',
            work_type: 'painting',
            user: { email: 'a@b.com' },
            total_cost_cents: 9100,
            duration_days: 5,
            before_photo_ids: [],
            after_photo_ids: [],
            purchase_list_json: { material_items: [], complementary_items: [] },
            budget_summary_json: { total_real_cost: 91 },
            description: null,
            length_cm: 300,
            width_cm: 200,
            height_cm: null,
            created_at: new Date('2026-08-01'),
          },
        ],
        1,
      ]);

      const result = await service.listPendingForModeration();

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          purchase_list: { material_items: [], complementary_items: [] },
          budget_summary: { total_real_cost: 91 },
        }),
      );
    });
  });
});
