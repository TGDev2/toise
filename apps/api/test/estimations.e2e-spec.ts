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
import { EstimationsController } from '../src/estimations/estimations.controller';
import { EstimationsService } from '../src/estimations/estimations.service';
import { UsersService } from '../src/users/users.service';
import { FirebaseAuthGuard } from '../src/auth/guards/firebase-auth.guard';
import { SubscriptionTier } from '../src/users/entities/user.entity';
import { EstimationLineItem } from '../src/estimations/entities/estimation-result.entity';

const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockProjectId = '223e4567-e89b-12d3-a456-426614174000';
const mockFirebaseUid = 'firebase-uid-123';
const mockEstimationId = '623e4567-e89b-12d3-a456-426614174000';
const mockRoomId = '323e4567-e89b-12d3-a456-426614174000';

const mockLineItem: EstimationLineItem = {
  work_item_id: 'work-item-1',
  work_type_code: 'painting_walls',
  work_type_label: 'Peinture murs',
  material_id: 'material-1',
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
};

const mockEstimationResult = {
  id: mockEstimationId,
  project_id: mockProjectId,
  skill_level: 'intermediate',
  items_json: [mockLineItem],
  aggregated_json: null,
  total_items: 1,
  created_at: new Date('2026-03-27T00:00:00.000Z'),
};

const estimationsServiceMock = {
  estimate: jest.fn().mockResolvedValue(mockEstimationResult),
  getLatest: jest.fn().mockResolvedValue(mockEstimationResult),
  getHistory: jest.fn().mockResolvedValue([mockEstimationResult]),
};

const usersServiceMock = {
  findByFirebaseUid: jest.fn().mockResolvedValue({
    id: mockUserId,
    subscription_tier: SubscriptionTier.FREE,
  }),
};

describe('EstimationsController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    jest.clearAllMocks();
    estimationsServiceMock.estimate.mockResolvedValue(mockEstimationResult);
    estimationsServiceMock.getLatest.mockResolvedValue(mockEstimationResult);
    estimationsServiceMock.getHistory.mockResolvedValue([mockEstimationResult]);
    usersServiceMock.findByFirebaseUid.mockResolvedValue({
      id: mockUserId,
      subscription_tier: SubscriptionTier.FREE,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [EstimationsController],
      providers: [
        { provide: EstimationsService, useValue: estimationsServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
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

  it('POST /projects/:id/estimate creates an estimation', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${mockProjectId}/estimate`)
      .send({})
      .expect(201)
      .expect((res: request.Response) => {
        const body = res.body as {
          id: string;
          project_id: string;
          skill_level: string;
          total_items: number;
          items: EstimationLineItem[];
        };
        expect(body.id).toBe(mockEstimationId);
        expect(body.project_id).toBe(mockProjectId);
        expect(body.total_items).toBe(1);
        expect(body.items).toHaveLength(1);
      });

    expect(estimationsServiceMock.estimate).toHaveBeenCalledWith(
      mockProjectId,
      mockUserId,
      undefined,
    );
  });

  it('POST /projects/:id/estimate forwards a skill_level override', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${mockProjectId}/estimate`)
      .send({ skill_level: 'expert' })
      .expect(201);

    expect(estimationsServiceMock.estimate).toHaveBeenCalledWith(
      mockProjectId,
      mockUserId,
      'expert',
    );
  });

  it('POST /projects/:id/estimate rejects an invalid skill_level', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${mockProjectId}/estimate`)
      .send({ skill_level: 'wizard' })
      .expect(400);
  });

  it('POST /projects/:id/estimate rejects a non-UUID project id', async () => {
    await request(app.getHttpServer())
      .post('/projects/not-a-uuid/estimate')
      .send({})
      .expect(400);
  });

  it('POST /projects/:id/estimate returns 400 when the project has no dimensions', async () => {
    estimationsServiceMock.estimate.mockRejectedValueOnce(
      new BadRequestException(
        'Project must have room dimensions before estimation',
      ),
    );

    await request(app.getHttpServer())
      .post(`/projects/${mockProjectId}/estimate`)
      .send({})
      .expect(400)
      .expect((res: request.Response) => {
        expect((res.body as { message: string }).message).toBe(
          'Project must have room dimensions before estimation',
        );
      });
  });

  it('POST /projects/:id/estimate returns 400 when no room has a work item', async () => {
    estimationsServiceMock.estimate.mockRejectedValueOnce(
      new BadRequestException(
        'Project must have at least one work item before estimation',
      ),
    );

    await request(app.getHttpServer())
      .post(`/projects/${mockProjectId}/estimate`)
      .send({})
      .expect(400)
      .expect((res: request.Response) => {
        expect((res.body as { message: string }).message).toBe(
          'Project must have at least one work item before estimation',
        );
      });
  });

  it('GET /projects/:id/estimates/latest returns the latest estimation', async () => {
    await request(app.getHttpServer())
      .get(`/projects/${mockProjectId}/estimates/latest`)
      .expect(200)
      .expect((res: request.Response) => {
        expect((res.body as { id: string }).id).toBe(mockEstimationId);
      });
  });

  it('GET /projects/:id/estimates/latest returns 404 when none exists', async () => {
    estimationsServiceMock.getLatest.mockRejectedValueOnce(
      new NotFoundException('No estimation found for this project'),
    );

    await request(app.getHttpServer())
      .get(`/projects/${mockProjectId}/estimates/latest`)
      .expect(404)
      .expect((res: request.Response) => {
        expect((res.body as { message: string }).message).toBe(
          'No estimation found for this project',
        );
      });
  });

  it('GET /projects/:id/estimates/latest rejects a non-UUID project id', async () => {
    await request(app.getHttpServer())
      .get('/projects/not-a-uuid/estimates/latest')
      .expect(400);
  });

  it('GET /projects/:id/estimates returns the estimation history', async () => {
    await request(app.getHttpServer())
      .get(`/projects/${mockProjectId}/estimates`)
      .expect(200)
      .expect((res: request.Response) => {
        const body = res.body as Array<{ id: string }>;
        expect(body).toHaveLength(1);
        expect(body[0].id).toBe(mockEstimationId);
      });

    expect(estimationsServiceMock.getHistory).toHaveBeenCalledWith(
      mockProjectId,
      mockUserId,
    );
  });

  it('GET /projects/:id/estimates returns an empty array when there is no history', async () => {
    estimationsServiceMock.getHistory.mockResolvedValueOnce([]);

    await request(app.getHttpServer())
      .get(`/projects/${mockProjectId}/estimates`)
      .expect(200)
      .expect([]);
  });
});
