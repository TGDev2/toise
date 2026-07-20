import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ShoppingListsController } from '../src/shopping-lists/shopping-lists.controller';
import { ShoppingListsService } from '../src/shopping-lists/shopping-lists.service';
import { UsersService } from '../src/users/users.service';
import { FeatureGatesService } from '../src/feature-gates/feature-gates.service';
import { FirebaseAuthGuard } from '../src/auth/guards/firebase-auth.guard';
import { SubscriptionTier } from '../src/users/entities/user.entity';
import {
  ShoppingListMaterialItem,
  ShoppingListComplementaryItem,
} from '../src/shopping-lists/entities/shopping-list.entity';

const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockProjectId = '223e4567-e89b-12d3-a456-426614174000';
const mockFirebaseUid = 'firebase-uid-123';
const mockEstimationId = '623e4567-e89b-12d3-a456-426614174000';
const mockShoppingListId = '723e4567-e89b-12d3-a456-426614174000';
const mockMaterialId = '823e4567-e89b-12d3-a456-426614174000';

const mockMaterialItem: ShoppingListMaterialItem = {
  material_id: mockMaterialId,
  work_type_code: 'painting_walls',
  work_type_label: 'Peinture murs',
  material_name: 'Peinture acrylique',
  material_category: 'painting',
  material_unit: 'L',
  packaging_label: 'Pot 3L',
  packaging_qty_per_unit: 3,
  adjusted_qty: 3.96,
  original_units_needed: 2,
  units_needed: 2,
  is_manually_adjusted: false,
};

const mockComplementaryItem: ShoppingListComplementaryItem = {
  complementary_material_id: 'compl-1',
  name: 'Ruban de masquage',
  description_fr: 'Protège les bords non peints',
  category: 'painting',
  unit_label: 'rouleau',
  default_quantity: 1,
  quantity: 1,
  is_removed: false,
};

const mockShoppingList = {
  id: mockShoppingListId,
  project_id: mockProjectId,
  estimation_id: mockEstimationId,
  items_json: {
    material_items: [mockMaterialItem],
    complementary_items: [mockComplementaryItem],
  },
  created_at: new Date('2026-03-27T00:00:00.000Z'),
  updated_at: new Date('2026-03-27T00:00:00.000Z'),
};

const shoppingListsServiceMock = {
  getOrGenerate: jest.fn().mockResolvedValue({
    shoppingList: mockShoppingList,
    latestEstimationId: mockEstimationId,
  }),
  update: jest.fn().mockResolvedValue({
    shoppingList: mockShoppingList,
    latestEstimationId: mockEstimationId,
  }),
  regenerate: jest.fn().mockResolvedValue({
    shoppingList: mockShoppingList,
    latestEstimationId: mockEstimationId,
  }),
};

const usersServiceMock = {
  findByFirebaseUid: jest.fn().mockResolvedValue({
    id: mockUserId,
    subscription_tier: SubscriptionTier.FREE,
  }),
};

// Non utilisé par les routes testées ici, mais requis pour que Nest puisse
// instancier FeatureGateGuard (appliqué aux routes budget-summary, hors
// périmètre du parcours critique — cf. plan ENG-4).
const featureGatesServiceMock = {
  isFeatureAllowed: jest.fn().mockResolvedValue(true),
  getGateConfig: jest.fn().mockResolvedValue(null),
};

describe('ShoppingListsController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    jest.clearAllMocks();
    shoppingListsServiceMock.getOrGenerate.mockResolvedValue({
      shoppingList: mockShoppingList,
      latestEstimationId: mockEstimationId,
    });
    shoppingListsServiceMock.update.mockResolvedValue({
      shoppingList: mockShoppingList,
      latestEstimationId: mockEstimationId,
    });
    shoppingListsServiceMock.regenerate.mockResolvedValue({
      shoppingList: mockShoppingList,
      latestEstimationId: mockEstimationId,
    });
    usersServiceMock.findByFirebaseUid.mockResolvedValue({
      id: mockUserId,
      subscription_tier: SubscriptionTier.FREE,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ShoppingListsController],
      providers: [
        { provide: ShoppingListsService, useValue: shoppingListsServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: FeatureGatesService, useValue: featureGatesServiceMock },
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

  it('GET /projects/:id/shopping-list returns the shopping list', async () => {
    await request(app.getHttpServer())
      .get(`/projects/${mockProjectId}/shopping-list`)
      .expect(200)
      .expect((res: request.Response) => {
        const body = res.body as {
          id: string;
          estimation_id: string;
          is_stale: boolean;
          material_items: ShoppingListMaterialItem[];
        };
        expect(body.id).toBe(mockShoppingListId);
        expect(body.estimation_id).toBe(mockEstimationId);
        expect(body.is_stale).toBe(false);
        expect(body.material_items).toHaveLength(1);
      });
  });

  it('GET /projects/:id/shopping-list flags a stale list when a newer estimation exists', async () => {
    const newerEstimationId = '923e4567-e89b-12d3-a456-426614174000';
    shoppingListsServiceMock.getOrGenerate.mockResolvedValueOnce({
      shoppingList: mockShoppingList,
      latestEstimationId: newerEstimationId,
    });

    await request(app.getHttpServer())
      .get(`/projects/${mockProjectId}/shopping-list`)
      .expect(200)
      .expect((res: request.Response) => {
        expect((res.body as { is_stale: boolean }).is_stale).toBe(true);
      });
  });

  it('GET /projects/:id/shopping-list returns 404 when no estimation exists', async () => {
    shoppingListsServiceMock.getOrGenerate.mockRejectedValueOnce(
      new NotFoundException('No estimation found for this project'),
    );

    await request(app.getHttpServer())
      .get(`/projects/${mockProjectId}/shopping-list`)
      .expect(404)
      .expect((res: request.Response) => {
        expect((res.body as { message: string }).message).toBe(
          'No estimation found for this project',
        );
      });
  });

  it('GET /projects/:id/shopping-list rejects a non-UUID project id', async () => {
    await request(app.getHttpServer())
      .get('/projects/not-a-uuid/shopping-list')
      .expect(400);
  });

  it('PATCH /projects/:id/shopping-list updates a material item', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${mockProjectId}/shopping-list`)
      .send({
        material_items: [{ material_id: mockMaterialId, units_needed: 5 }],
      })
      .expect(200);

    expect(shoppingListsServiceMock.update).toHaveBeenCalledWith(
      mockProjectId,
      mockUserId,
      expect.objectContaining({
        material_items: [
          expect.objectContaining({
            material_id: mockMaterialId,
            units_needed: 5,
          }),
        ],
      }),
    );
  });

  it('PATCH /projects/:id/shopping-list rejects a negative units_needed', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${mockProjectId}/shopping-list`)
      .send({
        material_items: [{ material_id: mockMaterialId, units_needed: -1 }],
      })
      .expect(400);
  });

  it('PATCH /projects/:id/shopping-list rejects a non-UUID material_id', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${mockProjectId}/shopping-list`)
      .send({
        material_items: [{ material_id: 'not-a-uuid', units_needed: 5 }],
      })
      .expect(400);
  });

  it('PATCH /projects/:id/shopping-list returns 404 when no list exists yet', async () => {
    shoppingListsServiceMock.update.mockRejectedValueOnce(
      new NotFoundException(
        'No shopping list found for this project. Generate one first.',
      ),
    );

    await request(app.getHttpServer())
      .patch(`/projects/${mockProjectId}/shopping-list`)
      .send({
        material_items: [{ material_id: mockMaterialId, units_needed: 5 }],
      })
      .expect(404)
      .expect((res: request.Response) => {
        expect((res.body as { message: string }).message).toBe(
          'No shopping list found for this project. Generate one first.',
        );
      });
  });

  it('POST /projects/:id/shopping-list/regenerate regenerates the list', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${mockProjectId}/shopping-list/regenerate`)
      .expect(201)
      .expect((res: request.Response) => {
        expect((res.body as { id: string }).id).toBe(mockShoppingListId);
      });
  });

  it('POST /projects/:id/shopping-list/regenerate returns 404 when no estimation exists', async () => {
    shoppingListsServiceMock.regenerate.mockRejectedValueOnce(
      new NotFoundException('No estimation found for this project'),
    );

    await request(app.getHttpServer())
      .post(`/projects/${mockProjectId}/shopping-list/regenerate`)
      .expect(404);
  });

  it('POST /projects/:id/shopping-list/regenerate rejects a non-UUID project id', async () => {
    await request(app.getHttpServer())
      .post('/projects/not-a-uuid/shopping-list/regenerate')
      .expect(400);
  });
});
