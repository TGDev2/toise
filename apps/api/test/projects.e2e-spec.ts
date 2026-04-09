import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ProjectsController } from '../src/projects/projects.controller';
import { ProjectsService } from '../src/projects/projects.service';
import { UsersService } from '../src/users/users.service';
import { FeatureGatesService } from '../src/feature-gates/feature-gates.service';
import { CvCorrectionService } from '../src/analysis/cv-correction.service';
import { FirebaseAuthGuard } from '../src/auth/guards/firebase-auth.guard';
import {
  WorkType,
  ProjectStatus,
} from '../src/projects/entities/project.entity';
import {
  ConfidenceScore,
  DimensionSource,
} from '../src/projects/entities/room-dimensions.entity';
import { SubscriptionTier } from '../src/users/entities/user.entity';

const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockProjectId = '223e4567-e89b-12d3-a456-426614174000';
const mockFirebaseUid = 'firebase-uid-123';

const mockProject = {
  id: mockProjectId,
  user_id: mockUserId,
  name: 'Renovation salon',
  room_name: 'Salon',
  work_type: WorkType.PAINTING,
  status: ProjectStatus.DRAFT,
  dimensions: null,
  openings: [],
  created_at: new Date('2026-03-27T00:00:00.000Z'),
  updated_at: new Date('2026-03-27T00:00:00.000Z'),
};

const mockDimensions = {
  id: 'dim-uuid',
  project_id: mockProjectId,
  length_cm: 500,
  width_cm: 400,
  height_cm: 250,
  confidence_score: ConfidenceScore.HIGH,
  source: DimensionSource.MANUAL,
  created_at: new Date('2026-03-27T00:00:00.000Z'),
  updated_at: new Date('2026-03-27T00:00:00.000Z'),
};

const projectsServiceMock = {
  createProject: jest.fn().mockResolvedValue(mockProject),
  findByUser: jest.fn().mockResolvedValue({
    data: [mockProject],
    meta: { total: 1, page: 1, limit: 12, totalPages: 1 },
  }),
  findOneByUser: jest.fn().mockResolvedValue(mockProject),
  getWritableProjectIds: jest.fn().mockResolvedValue([mockProjectId]),
  isProjectWritable: jest.fn().mockResolvedValue(true),
  ensureProjectWritable: jest.fn().mockResolvedValue(undefined),
  updateDimensions: jest.fn().mockResolvedValue(mockDimensions),
  getDimensions: jest.fn().mockResolvedValue(mockDimensions),
  softDeleteProject: jest.fn().mockResolvedValue(undefined),
};

const usersServiceMock = {
  findByFirebaseUid: jest.fn().mockResolvedValue({
    id: mockUserId,
    subscription_tier: SubscriptionTier.FREE,
  }),
};

const featureGatesServiceMock = {
  isFeatureAllowed: jest.fn().mockResolvedValue(true),
};

const cvCorrectionServiceMock = {
  logCorrection: jest.fn().mockResolvedValue(undefined),
};

describe('ProjectsController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        { provide: ProjectsService, useValue: projectsServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
        {
          provide: FeatureGatesService,
          useValue: featureGatesServiceMock,
        },
        {
          provide: CvCorrectionService,
          useValue: cvCorrectionServiceMock,
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

  it('POST /projects creates a project', async () => {
    await request(app.getHttpServer())
      .post('/projects')
      .send({
        name: 'Renovation salon',
        room_name: 'Salon',
        work_type: 'painting',
      })
      .expect(201)
      .expect((res: request.Response) => {
        expect((res.body as { id: string }).id).toBe(mockProjectId);
        expect((res.body as { name: string }).name).toBe('Renovation salon');
      });

    expect(projectsServiceMock.createProject).toHaveBeenCalledWith(
      mockUserId,
      expect.objectContaining({ name: 'Renovation salon' }),
      SubscriptionTier.FREE,
    );
  });

  it('POST /projects rejects invalid payload', async () => {
    await request(app.getHttpServer())
      .post('/projects')
      .send({ work_type: 'invalid' })
      .expect(400);
  });

  it('GET /projects returns user projects', async () => {
    await request(app.getHttpServer())
      .get('/projects')
      .expect(200)
      .expect((res: request.Response) => {
        const body = res.body as {
          data: Array<{ id: string }>;
          meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
          };
        };
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.data).toHaveLength(1);
        expect(body.data[0].id).toBe(mockProjectId);
        expect(body.meta).toBeDefined();
        expect(body.meta.total).toBe(1);
        expect(body.meta.page).toBe(1);
      });
  });

  it('GET /projects/:id returns a single project', async () => {
    await request(app.getHttpServer())
      .get(`/projects/${mockProjectId}`)
      .expect(200)
      .expect((res: request.Response) => {
        expect((res.body as { id: string }).id).toBe(mockProjectId);
      });
  });

  it('PUT /projects/:id/dimensions updates dimensions', async () => {
    await request(app.getHttpServer())
      .put(`/projects/${mockProjectId}/dimensions`)
      .send({ length_cm: 500, width_cm: 400, height_cm: 250 })
      .expect(200)
      .expect((res: request.Response) => {
        const body = res.body as {
          length_cm: number;
          width_cm: number;
          height_cm: number;
        };
        expect(body.length_cm).toBe(500);
        expect(body.width_cm).toBe(400);
        expect(body.height_cm).toBe(250);
      });
  });

  it('PUT /projects/:id/dimensions rejects non-integer values', async () => {
    await request(app.getHttpServer())
      .put(`/projects/${mockProjectId}/dimensions`)
      .send({ length_cm: 5.5, width_cm: 400, height_cm: 250 })
      .expect(400);
  });

  it('PUT /projects/:id/dimensions rejects values out of range', async () => {
    await request(app.getHttpServer())
      .put(`/projects/${mockProjectId}/dimensions`)
      .send({ length_cm: 0, width_cm: 400, height_cm: 250 })
      .expect(400);
  });

  it('GET /projects/:id/dimensions returns dimensions', async () => {
    await request(app.getHttpServer())
      .get(`/projects/${mockProjectId}/dimensions`)
      .expect(200)
      .expect((res: request.Response) => {
        expect((res.body as { length_cm: number }).length_cm).toBe(500);
      });
  });

  it('GET /projects/:id/dimensions returns null when none exist', async () => {
    projectsServiceMock.getDimensions.mockResolvedValueOnce(null);

    await request(app.getHttpServer())
      .get(`/projects/${mockProjectId}/dimensions`)
      .expect(200);
  });
});
