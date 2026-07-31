import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PriceComparisonController } from '../src/price-comparison/price-comparison.controller';
import { PriceComparisonService } from '../src/price-comparison/price-comparison.service';
import { UsersService } from '../src/users/users.service';
import { FeatureGatesService } from '../src/feature-gates/feature-gates.service';
import { FirebaseAuthGuard } from '../src/auth/guards/firebase-auth.guard';
import { SubscriptionTier } from '../src/users/entities/user.entity';

const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockProjectId = '223e4567-e89b-12d3-a456-426614174000';
const mockFirebaseUid = 'firebase-uid-123';
const mockMaterialId = '823e4567-e89b-12d3-a456-426614174000';

const mockComparisonResponse = {
  items: [
    {
      material_id: mockMaterialId,
      material_name: 'Peinture acrylique mate',
      material_unit: 'L',
      units_needed: 2,
      prices: [
        {
          supplier_key: 'manomano',
          supplier_name: 'ManoMano',
          product_name: 'Peinture acrylique mate 10L',
          unit_price: 29.9,
          currency: 'EUR',
          availability: 'in_stock',
          fetched_at: '2026-08-01T00:00:00.000Z',
        },
      ],
      best_supplier_key: 'manomano',
    },
  ],
  supplier_totals: [
    {
      supplier_key: 'manomano',
      supplier_name: 'ManoMano',
      total_cost: 59.8,
      items_available: 1,
      items_total: 1,
    },
  ],
  optimized_total: 59.8,
  fetched_at: '2026-08-01T00:00:00.000Z',
  cache_expires_at: '2026-08-02T00:00:00.000Z',
};

const priceComparisonServiceMock = {
  comparePrices: jest.fn().mockResolvedValue(mockComparisonResponse),
  applySelections: jest.fn().mockResolvedValue(undefined),
};

const usersServiceMock = {
  findByFirebaseUid: jest.fn().mockResolvedValue({
    id: mockUserId,
    subscription_tier: SubscriptionTier.PRO,
  }),
};

const featureGatesServiceMock = {
  isFeatureAllowed: jest.fn().mockResolvedValue(true),
  getGateConfig: jest.fn().mockResolvedValue({
    feature_key: 'price_comparison',
    min_tier: 'pro',
  }),
};

describe('PriceComparisonController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    jest.clearAllMocks();
    priceComparisonServiceMock.comparePrices.mockResolvedValue(
      mockComparisonResponse,
    );
    priceComparisonServiceMock.applySelections.mockResolvedValue(undefined);
    usersServiceMock.findByFirebaseUid.mockResolvedValue({
      id: mockUserId,
      subscription_tier: SubscriptionTier.PRO,
    });
    featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(true);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PriceComparisonController],
      providers: [
        {
          provide: PriceComparisonService,
          useValue: priceComparisonServiceMock,
        },
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

  describe('POST /projects/:id/shopping-list/compare-prices', () => {
    it('returns the price comparison for the authenticated owner', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${mockProjectId}/shopping-list/compare-prices`)
        .send({ postal_code: '75001' })
        .expect(201)
        .expect((res: request.Response) => {
          expect(res.body).toEqual(mockComparisonResponse);
        });

      expect(priceComparisonServiceMock.comparePrices).toHaveBeenCalledWith(
        mockProjectId,
        mockUserId,
        '75001',
      );
    });

    it('rejects with 403 when the feature gate refuses the user tier', async () => {
      featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(false);
      usersServiceMock.findByFirebaseUid.mockResolvedValue({
        id: mockUserId,
        subscription_tier: SubscriptionTier.FREE,
      });

      await request(app.getHttpServer())
        .post(`/projects/${mockProjectId}/shopping-list/compare-prices`)
        .send({})
        .expect(403)
        .expect((res: request.Response) => {
          expect(
            (res.body as { error: string; feature_key: string }).error,
          ).toBe('FEATURE_GATED');
          expect((res.body as { feature_key: string }).feature_key).toBe(
            'price_comparison',
          );
        });

      expect(priceComparisonServiceMock.comparePrices).not.toHaveBeenCalled();
    });
  });

  describe('POST /projects/:id/shopping-list/compare-prices/apply', () => {
    it('applies a selection on a mutualized item (no work_item_id, ENG-2)', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${mockProjectId}/shopping-list/compare-prices/apply`)
        .send({
          selections: [
            { material_id: mockMaterialId, supplier_key: 'manomano' },
          ],
        })
        .expect(201)
        .expect((res: request.Response) => {
          expect(res.body).toEqual({ applied: true });
        });

      expect(priceComparisonServiceMock.applySelections).toHaveBeenCalledWith(
        mockProjectId,
        mockUserId,
        [{ material_id: mockMaterialId, supplier_key: 'manomano' }],
      );
    });

    it('still accepts a legacy work_item_id without failing validation', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${mockProjectId}/shopping-list/compare-prices/apply`)
        .send({
          selections: [
            {
              material_id: mockMaterialId,
              work_item_id: 'legacy-work-item-1',
              supplier_key: 'manomano',
            },
          ],
        })
        .expect(201);
    });

    it('rejects an empty selections array', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${mockProjectId}/shopping-list/compare-prices/apply`)
        .send({ selections: [] })
        .expect(400);

      expect(priceComparisonServiceMock.applySelections).not.toHaveBeenCalled();
    });

    it('rejects a selection with a non-UUID material_id', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${mockProjectId}/shopping-list/compare-prices/apply`)
        .send({
          selections: [{ material_id: 'not-a-uuid', supplier_key: 'manomano' }],
        })
        .expect(400);
    });

    it('rejects with 403 when the feature gate refuses the user tier', async () => {
      featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(false);
      usersServiceMock.findByFirebaseUid.mockResolvedValue({
        id: mockUserId,
        subscription_tier: SubscriptionTier.FREE,
      });

      await request(app.getHttpServer())
        .post(`/projects/${mockProjectId}/shopping-list/compare-prices/apply`)
        .send({
          selections: [
            { material_id: mockMaterialId, supplier_key: 'manomano' },
          ],
        })
        .expect(403);

      expect(priceComparisonServiceMock.applySelections).not.toHaveBeenCalled();
    });
  });
});
