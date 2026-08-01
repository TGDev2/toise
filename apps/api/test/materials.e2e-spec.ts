import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { MaterialsController } from '../src/materials/materials.controller';
import { MaterialsService } from '../src/materials/materials.service';
import { MaterialCategory } from '../src/materials/entities/material-catalog.entity';
import { FirebaseAuthGuard } from '../src/auth/guards/firebase-auth.guard';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { UserRole } from '../src/users/entities/user.entity';

const mockAdminUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockMaterialId = '223e4567-e89b-12d3-a456-426614174000';
const mockEcoMaterialId = '323e4567-e89b-12d3-a456-426614174000';

const mockMaterial = {
  id: mockMaterialId,
  name: 'Peinture acrylique mate',
  category: MaterialCategory.PAINTING,
  unit: 'L',
  yield_per_unit: 10,
  is_active: true,
  is_eco: false,
  eco_label_fr: null,
  packagings: [{ label: 'Pot 10 L', quantity_per_unit: 10, unit: 'L' }],
  waste_factors: [],
  eco_equivalents: [],
};

const materialsServiceMock = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  deactivate: jest.fn(),
  linkEcoEquivalent: jest.fn(),
  unlinkEcoEquivalent: jest.fn(),
};

describe('MaterialsController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    jest.clearAllMocks();
    materialsServiceMock.create.mockResolvedValue(mockMaterial);
    materialsServiceMock.findAll.mockResolvedValue([mockMaterial]);
    materialsServiceMock.findOne.mockResolvedValue(mockMaterial);
    materialsServiceMock.linkEcoEquivalent.mockResolvedValue({
      ...mockMaterial,
      eco_equivalents: [{ id: 'eq-1', eco_material_id: mockEcoMaterialId }],
    });
    materialsServiceMock.unlinkEcoEquivalent.mockResolvedValue(mockMaterial);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MaterialsController],
      providers: [
        { provide: MaterialsService, useValue: materialsServiceMock },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext): boolean {
          const req = context.switchToHttp().getRequest<{
            firebaseUser?: { uid: string; email?: string };
          }>();
          req.firebaseUser = {
            uid: 'admin-firebase-uid',
            email: 'admin@example.com',
          };
          return true;
        },
      } satisfies CanActivate)
      .overrideGuard(AdminGuard)
      .useValue({
        canActivate(context: ExecutionContext): boolean {
          const req = context.switchToHttp().getRequest<{
            appUser?: { id: string; role: string };
          }>();
          req.appUser = { id: mockAdminUserId, role: UserRole.ADMIN };
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

  describe('POST /admin/materials', () => {
    it('creates a material with is_eco/eco_label_fr', async () => {
      await request(app.getHttpServer())
        .post('/admin/materials')
        .send({
          name: 'Peinture acrylique mate sans COV',
          category: 'painting',
          unit: 'L',
          yield_per_unit: 10,
          is_eco: true,
          eco_label_fr: 'Sans COV, écolabel NF Environnement',
          packagings: [{ label: 'Pot 10 L', quantity_per_unit: 10, unit: 'L' }],
        })
        .expect(201);

      expect(materialsServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          is_eco: true,
          eco_label_fr: 'Sans COV, écolabel NF Environnement',
        }),
        mockAdminUserId,
      );
    });

    it('rejects is_eco: true without eco_label_fr, propagated from the service', async () => {
      materialsServiceMock.create.mockRejectedValue(
        new BadRequestException(
          'eco_label_fr est requis lorsque is_eco est vrai.',
        ),
      );

      await request(app.getHttpServer())
        .post('/admin/materials')
        .send({
          name: 'Peinture éco',
          category: 'painting',
          unit: 'L',
          yield_per_unit: 10,
          is_eco: true,
          packagings: [{ label: 'Pot 10 L', quantity_per_unit: 10, unit: 'L' }],
        })
        .expect(400);
    });
  });

  describe('GET /admin/materials', () => {
    it('filters by is_eco', async () => {
      await request(app.getHttpServer())
        .get('/admin/materials?is_eco=true')
        .expect(200);

      expect(materialsServiceMock.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ is_eco: true }),
      );
    });
  });

  describe('eco-equivalent linking', () => {
    it('links an eco equivalent', async () => {
      await request(app.getHttpServer())
        .post(`/admin/materials/${mockMaterialId}/eco-equivalent`)
        .send({ eco_material_id: mockEcoMaterialId })
        .expect(201);

      expect(materialsServiceMock.linkEcoEquivalent).toHaveBeenCalledWith(
        mockMaterialId,
        mockEcoMaterialId,
      );
    });

    it('rejects a non-UUID eco_material_id', async () => {
      await request(app.getHttpServer())
        .post(`/admin/materials/${mockMaterialId}/eco-equivalent`)
        .send({ eco_material_id: 'not-a-uuid' })
        .expect(400);

      expect(materialsServiceMock.linkEcoEquivalent).not.toHaveBeenCalled();
    });

    it('unlinks an eco equivalent', async () => {
      await request(app.getHttpServer())
        .delete(
          `/admin/materials/${mockMaterialId}/eco-equivalent/${mockEcoMaterialId}`,
        )
        .expect(200);

      expect(materialsServiceMock.unlinkEcoEquivalent).toHaveBeenCalledWith(
        mockMaterialId,
        mockEcoMaterialId,
      );
    });

    it('propagates a category-mismatch rejection from the service', async () => {
      materialsServiceMock.linkEcoEquivalent.mockRejectedValue(
        new BadRequestException(
          'Le matériau éco doit appartenir à la même catégorie.',
        ),
      );

      await request(app.getHttpServer())
        .post(`/admin/materials/${mockMaterialId}/eco-equivalent`)
        .send({ eco_material_id: mockEcoMaterialId })
        .expect(400);
    });
  });
});
