import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ProjectsController } from '../src/projects/projects.controller';
import { ProjectsService } from '../src/projects/projects.service';
import { EstimationsController } from '../src/estimations/estimations.controller';
import { EstimationsService } from '../src/estimations/estimations.service';
import { ShoppingListsController } from '../src/shopping-lists/shopping-lists.controller';
import { ShoppingListsService } from '../src/shopping-lists/shopping-lists.service';
import { UsersService } from '../src/users/users.service';
import { OrgContextService } from '../src/organizations/org-context.service';
import { CompanyProfilesService } from '../src/company-profiles/company-profiles.service';
import { FeatureGatesService } from '../src/feature-gates/feature-gates.service';
import { CvCorrectionService } from '../src/analysis/cv-correction.service';
import { FirebaseAuthGuard } from '../src/auth/guards/firebase-auth.guard';
import { SubscriptionTier } from '../src/users/entities/user.entity';
import { EstimationLineItem } from '../src/estimations/entities/estimation-result.entity';
import { ShoppingListMaterialItem } from '../src/shopping-lists/entities/shopping-list.entity';

/**
 * Parcours critique ENG-4 : projet → dimensions → work-items → estimation →
 * liste d'achats, en une seule séquence HTTP réelle (DTOs/pipes/guards
 * inclus) à travers les 3 contrôleurs. Contrairement à `estimations.e2e-spec`
 * et `shopping-lists.e2e-spec` (contrat d'un contrôleur isolé), ce fichier
 * vérifie le câblage HTTP *entre* les contrôleurs au fil du parcours. Il ne
 * réimplémente pas la géométrie/l'agrégation réelle (déjà couvertes par
 * `estimation-engine.spec.ts` / `estimations.service.spec.ts` /
 * `shopping-lists.service.spec.ts`) : les faux services ci-dessous gardent un
 * état minimal en mémoire (dimensions posées ? work item ajouté ? estimation
 * générée ? liste générée ?) qui suffit à reproduire les mêmes garde-fous que
 * les vrais services (400/404) et à faire transiter des données cohérentes
 * d'une étape à l'autre.
 */

const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockFirebaseUid = 'firebase-uid-123';
const mockProjectId = '223e4567-e89b-12d3-a456-426614174000';
const mockRoomId = '323e4567-e89b-12d3-a456-426614174000';
const mockWorkTypeId = '423e4567-e89b-12d3-a456-426614174000';
const mockWorkItemId = '523e4567-e89b-12d3-a456-426614174000';
const mockEstimationId = '623e4567-e89b-12d3-a456-426614174000';
const mockShoppingListId = '723e4567-e89b-12d3-a456-426614174000';
const mockMaterialId = '823e4567-e89b-12d3-a456-426614174000';

interface FakeEstimation {
  id: string;
  project_id: string;
  skill_level: string;
  items_json: EstimationLineItem[];
  aggregated_json: null;
  total_items: number;
  created_at: Date;
}

interface FakeShoppingList {
  id: string;
  project_id: string;
  estimation_id: string;
  items_json: {
    material_items: ShoppingListMaterialItem[];
    complementary_items: [];
  };
  created_at: Date;
  updated_at: Date;
}

// État partagé du parcours, remis à zéro dans beforeEach. Les mocks
// ci-dessous ferment sur ces variables pour reproduire, sans DB, les mêmes
// prérequis inter-étapes que les vrais services (une estimation a besoin de
// dimensions + work items ; une liste d'achats a besoin d'une estimation).
let hasDimensions = false;
let hasWorkItems = false;
let latestEstimation: FakeEstimation | null = null;
let shoppingList: FakeShoppingList | null = null;

const projectsServiceMock = {
  createProject: jest.fn().mockImplementation(() => ({
    id: mockProjectId,
    name: 'Renovation salon',
    room_name: 'Salon',
    work_type: 'painting',
    status: 'draft',
    created_at: new Date('2026-03-27T00:00:00.000Z'),
  })),
  ensureProjectWritable: jest.fn().mockResolvedValue(undefined),
  getDimensions: jest.fn().mockResolvedValue(null),
  updateDimensions: jest.fn().mockImplementation(
    (
      _id: string,
      _organizationId: string,
      _userId: string,
      dto: {
        length_cm: number;
        width_cm: number;
        height_cm: number;
        segments?: unknown[];
        exclusions?: unknown[];
      },
    ) => {
      hasDimensions = true;
      return {
        length_cm: dto.length_cm,
        width_cm: dto.width_cm,
        height_cm: dto.height_cm,
        segments_json: dto.segments ?? null,
        exclusions_json: dto.exclusions ?? null,
        source: 'manual',
        confidence_score: 'high',
      };
    },
  ),
  saveWorkItems: jest.fn().mockImplementation(() => {
    hasWorkItems = true;
    return [
      {
        id: mockWorkItemId,
        work_type: {
          id: mockWorkTypeId,
          code: 'painting_walls',
          label_fr: 'Peinture murs',
          category: 'painting',
          surface_target: 'wall',
          contextual_questions: [],
        },
        skill_level: 'intermediate',
        custom_params: {},
      },
    ];
  }),
};

const estimationsServiceMock = {
  estimate: jest
    .fn()
    .mockImplementation(
      (projectId: string, _userId: string, skillLevel?: string) => {
        if (!hasDimensions) {
          throw new BadRequestException(
            'Project must have room dimensions before estimation',
          );
        }
        if (!hasWorkItems) {
          throw new BadRequestException(
            'Project must have at least one work item before estimation',
          );
        }
        latestEstimation = {
          id: mockEstimationId,
          project_id: projectId,
          skill_level: skillLevel || 'intermediate',
          items_json: [
            {
              work_item_id: mockWorkItemId,
              work_type_code: 'painting_walls',
              work_type_label: 'Peinture murs',
              material_id: mockMaterialId,
              material_name: 'Peinture acrylique',
              material_unit: 'L',
              gross_surface_m2: 20,
              surface_m2: 18,
              theoretical_qty: 3.6,
              waste_factor_percent: 10,
              waste_factor_source: 'catalog',
              adjusted_qty: 3.96,
              packaging_label: 'Pot 3L',
              packaging_qty_per_unit: 3,
              units_needed: 2,
              pose_type: 'roller',
              room_id: mockRoomId,
              room_name: 'Salon',
            },
          ],
          aggregated_json: null,
          total_items: 1,
          created_at: new Date('2026-03-27T00:00:00.000Z'),
        };
        return latestEstimation;
      },
    ),
  getLatest: jest.fn().mockImplementation(() => {
    if (!latestEstimation) {
      throw new NotFoundException('No estimation found for this project');
    }
    return latestEstimation;
  }),
  getHistory: jest
    .fn()
    .mockImplementation(() => (latestEstimation ? [latestEstimation] : [])),
};

const shoppingListsServiceMock = {
  getOrGenerate: jest.fn().mockImplementation((projectId: string) => {
    if (!latestEstimation) {
      throw new NotFoundException('No estimation found for this project');
    }
    if (!shoppingList) {
      shoppingList = {
        id: mockShoppingListId,
        project_id: projectId,
        estimation_id: latestEstimation.id,
        items_json: {
          material_items: latestEstimation.items_json.map((item) => ({
            material_id: item.material_id,
            work_type_code: item.work_type_code,
            work_type_label: item.work_type_label,
            material_name: item.material_name,
            material_category: 'painting',
            material_unit: item.material_unit,
            packaging_label: item.packaging_label,
            packaging_qty_per_unit: item.packaging_qty_per_unit,
            adjusted_qty: item.adjusted_qty,
            original_units_needed: item.units_needed,
            units_needed: item.units_needed,
            is_manually_adjusted: false,
          })),
          complementary_items: [],
        },
        created_at: new Date('2026-03-27T00:00:00.000Z'),
        updated_at: new Date('2026-03-27T00:00:00.000Z'),
      };
    }
    return { shoppingList, latestEstimationId: latestEstimation.id };
  }),
  update: jest.fn().mockImplementation(
    (
      _projectId: string,
      _userId: string,
      dto: {
        material_items?: { material_id: string; units_needed: number }[];
      },
    ) => {
      if (!shoppingList) {
        throw new NotFoundException(
          'No shopping list found for this project. Generate one first.',
        );
      }
      for (const update of dto.material_items ?? []) {
        const item = shoppingList.items_json.material_items.find(
          (m) => m.material_id === update.material_id,
        );
        if (item) item.units_needed = update.units_needed;
      }
      return { shoppingList, latestEstimationId: latestEstimation!.id };
    },
  ),
};

const usersServiceMock = {
  findByFirebaseUid: jest.fn().mockResolvedValue({
    id: mockUserId,
    subscription_tier: SubscriptionTier.FREE,
  }),
};

// PLAT-4 : les contrôleurs résolvent désormais la portée (organisation + auteur)
// au lieu de recharger l'utilisateur ; le guard de feature gates lit le palier
// effectif de l'organisation via ce même service.
const mockOrgId = '00000000-0000-4000-8000-0000000000aa';
const orgContextMock = {
  resolveForFirebaseUid: jest.fn().mockResolvedValue({
    user: { id: mockUserId, subscription_tier: SubscriptionTier.FREE },
    userId: mockUserId,
    organization: { id: mockOrgId, name: 'Mon espace', is_personal: true },
    organizationId: mockOrgId,
    role: 'owner',
    effectiveTier: SubscriptionTier.FREE,
  }),
  resolveForUser: jest.fn(),
  getOrCreatePersonalOrganization: jest
    .fn()
    .mockResolvedValue({ id: mockOrgId }),
  findMembership: jest.fn(),
};

const featureGatesServiceMock = {
  isFeatureAllowed: jest.fn().mockResolvedValue(true),
  getGateConfig: jest.fn().mockResolvedValue(null),
};

const cvCorrectionServiceMock = {
  logCorrection: jest.fn().mockResolvedValue(undefined),
};

// E1-11 : `ShoppingListsController` lit le réglage marques via ce service.
// `null` ⇒ défaut `true`, exactement le comportement d'une organisation sans
// profil entreprise renseigné.
const companyProfilesServiceMock = {
  findByOrganizationId: jest.fn().mockResolvedValue(null),
};

describe('Critical path (e2e): project → dimensions → work-items → estimate → shopping-list', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    jest.clearAllMocks();
    hasDimensions = false;
    hasWorkItems = false;
    latestEstimation = null;
    shoppingList = null;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        ProjectsController,
        EstimationsController,
        ShoppingListsController,
      ],
      providers: [
        { provide: ProjectsService, useValue: projectsServiceMock },
        { provide: EstimationsService, useValue: estimationsServiceMock },
        { provide: ShoppingListsService, useValue: shoppingListsServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: OrgContextService, useValue: orgContextMock },
        { provide: FeatureGatesService, useValue: featureGatesServiceMock },
        { provide: CvCorrectionService, useValue: cvCorrectionServiceMock },
        {
          provide: CompanyProfilesService,
          useValue: companyProfilesServiceMock,
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext): boolean {
          const req = context.switchToHttp().getRequest<{
            firebaseUser?: { uid: string; email?: string };
          }>();
          req.firebaseUser = {
            uid: mockFirebaseUid,
            email: 'test@example.com',
          };
          return true;
        },
      } satisfies CanActivate)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('runs the nominal journey end to end', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/projects')
      .send({
        name: 'Renovation salon',
        room_name: 'Salon',
        work_type: 'painting',
      })
      .expect(201)
      .expect((res: request.Response) => {
        expect((res.body as { id: string }).id).toBe(mockProjectId);
      });

    await request(server)
      .put(`/projects/${mockProjectId}/dimensions`)
      .send({ length_cm: 400, width_cm: 300, height_cm: 250 })
      .expect(200)
      .expect((res: request.Response) => {
        expect((res.body as { length_cm: number }).length_cm).toBe(400);
      });

    await request(server)
      .post(`/projects/${mockProjectId}/work-items`)
      .send({
        items: [{ work_type_id: mockWorkTypeId, skill_level: 'intermediate' }],
      })
      .expect(201);

    const estimateRes = await request(server)
      .post(`/projects/${mockProjectId}/estimate`)
      .send({})
      .expect(201);
    const estimateBody = estimateRes.body as {
      id: string;
      project_id: string;
      total_items: number;
      items: EstimationLineItem[];
    };
    expect(estimateBody.project_id).toBe(mockProjectId);
    expect(estimateBody.total_items).toBe(1);
    expect(estimateBody.items[0].room_id).toBe(mockRoomId);

    const shoppingListRes = await request(server)
      .get(`/projects/${mockProjectId}/shopping-list`)
      .expect(200);
    const shoppingListBody = shoppingListRes.body as {
      estimation_id: string;
      is_stale: boolean;
      material_items: ShoppingListMaterialItem[];
    };
    expect(shoppingListBody.estimation_id).toBe(estimateBody.id);
    expect(shoppingListBody.is_stale).toBe(false);
    expect(shoppingListBody.material_items.length).toBeGreaterThan(0);
  });

  it('rejects estimation before any dimensions have been set', async () => {
    const server = app.getHttpServer();
    await request(server).post('/projects').send({ name: 'Salle de bain' });

    await request(server)
      .post(`/projects/${mockProjectId}/estimate`)
      .send({})
      .expect(400)
      .expect((res: request.Response) => {
        expect((res.body as { message: string }).message).toBe(
          'Project must have room dimensions before estimation',
        );
      });
  });

  it('rejects estimation when dimensions exist but no work item was added', async () => {
    const server = app.getHttpServer();
    await request(server).post('/projects').send({ name: 'Cuisine' });
    await request(server)
      .put(`/projects/${mockProjectId}/dimensions`)
      .send({ length_cm: 300, width_cm: 250, height_cm: 250 });

    await request(server)
      .post(`/projects/${mockProjectId}/estimate`)
      .send({})
      .expect(400)
      .expect((res: request.Response) => {
        expect((res.body as { message: string }).message).toBe(
          'Project must have at least one work item before estimation',
        );
      });
  });

  it('rejects fetching a shopping list before any estimation exists', async () => {
    const server = app.getHttpServer();
    await request(server).post('/projects').send({ name: 'Chambre' });

    await request(server)
      .get(`/projects/${mockProjectId}/shopping-list`)
      .expect(404)
      .expect((res: request.Response) => {
        expect((res.body as { message: string }).message).toBe(
          'No estimation found for this project',
        );
      });
  });

  it('propagates multi-room mutualization (room_count) through to the shopping list response', async () => {
    const server = app.getHttpServer();
    await request(server).post('/projects').send({ name: 'Appartement' });
    await request(server)
      .put(`/projects/${mockProjectId}/dimensions`)
      .send({ length_cm: 400, width_cm: 300, height_cm: 250 });
    await request(server)
      .post(`/projects/${mockProjectId}/work-items`)
      .send({
        items: [{ work_type_id: mockWorkTypeId, skill_level: 'intermediate' }],
      });
    await request(server).post(`/projects/${mockProjectId}/estimate`).send({});
    await request(server).get(`/projects/${mockProjectId}/shopping-list`);

    // Deux pièces mutualisées sur le même matériau (ENG-2) : on ne rejoue pas
    // l'agrégation réelle (déjà testée dans estimations.service.spec.ts),
    // seulement que le champ `room_count` traverse le contrôleur/DTO intact.
    shoppingListsServiceMock.getOrGenerate.mockResolvedValueOnce({
      shoppingList: {
        ...shoppingList!,
        items_json: {
          material_items: [
            { ...shoppingList!.items_json.material_items[0], room_count: 2 },
          ],
          complementary_items: [],
        },
      },
      latestEstimationId: latestEstimation!.id,
    });

    await request(server)
      .get(`/projects/${mockProjectId}/shopping-list`)
      .expect(200)
      .expect((res: request.Response) => {
        const body = res.body as { material_items: ShoppingListMaterialItem[] };
        expect(body.material_items[0].room_count).toBe(2);
      });
  });

  it('updates a shopping list item after it has been generated', async () => {
    const server = app.getHttpServer();
    await request(server).post('/projects').send({ name: 'Bureau' });
    await request(server)
      .put(`/projects/${mockProjectId}/dimensions`)
      .send({ length_cm: 400, width_cm: 300, height_cm: 250 });
    await request(server)
      .post(`/projects/${mockProjectId}/work-items`)
      .send({
        items: [{ work_type_id: mockWorkTypeId, skill_level: 'intermediate' }],
      });
    await request(server).post(`/projects/${mockProjectId}/estimate`).send({});
    await request(server).get(`/projects/${mockProjectId}/shopping-list`);

    await request(server)
      .patch(`/projects/${mockProjectId}/shopping-list`)
      .send({
        material_items: [{ material_id: mockMaterialId, units_needed: 5 }],
      })
      .expect(200)
      .expect((res: request.Response) => {
        const body = res.body as { material_items: ShoppingListMaterialItem[] };
        expect(body.material_items[0].units_needed).toBe(5);
      });
  });
});
