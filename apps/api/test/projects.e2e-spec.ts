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
import { ProjectsController } from '../src/projects/projects.controller';
import { ProjectsService } from '../src/projects/projects.service';
import { UsersService } from '../src/users/users.service';
import { OrgContextService } from '../src/organizations/org-context.service';
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

const mockRoomId = '323e4567-e89b-12d3-a456-426614174000';
const mockRoom = {
  id: mockRoomId,
  name: 'Salon',
  sort_order: 0,
  dimensions: null,
  openings: [],
  workItems: [],
};

const mockWorkTypeId = '423e4567-e89b-12d3-a456-426614174000';
const mockWorkItemId = '523e4567-e89b-12d3-a456-426614174000';
const mockWorkItem = {
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
};

const mockOpeningId = '623e4567-e89b-12d3-a456-426614174000';
const mockCvOpening = {
  id: mockOpeningId,
  room_id: mockRoomId,
  type: 'door',
  width_cm: 90,
  height_cm: 204,
  count: 1,
  source: 'cv',
  cv_confidence: 0.8,
};
const cvOpeningSnapshot = {
  opening_id: mockOpeningId,
  type: 'door',
  width_cm: 90,
  height_cm: 204,
  count: 1,
  cv_confidence: 0.8,
};

const projectsServiceMock = {
  createProject: jest.fn().mockResolvedValue(mockProject),
  findByOrg: jest.fn().mockResolvedValue({
    data: [mockProject],
    meta: { total: 1, page: 1, limit: 12, totalPages: 1 },
  }),
  findOneForOrg: jest.fn().mockResolvedValue(mockProject),
  getWritableProjectIds: jest.fn().mockResolvedValue([mockProjectId]),
  isProjectWritable: jest.fn().mockResolvedValue(true),
  ensureProjectWritable: jest.fn().mockResolvedValue(undefined),
  updateDimensions: jest.fn().mockResolvedValue(mockDimensions),
  getDimensions: jest.fn().mockResolvedValue(mockDimensions),
  softDeleteProject: jest.fn().mockResolvedValue(undefined),
  saveWorkItems: jest.fn().mockResolvedValue([mockWorkItem]),
  getRooms: jest.fn().mockResolvedValue([mockRoom]),
  createRoom: jest.fn().mockResolvedValue(mockRoom),
  renameRoom: jest.fn().mockResolvedValue({ ...mockRoom, name: 'Cuisine' }),
  deleteRoom: jest.fn().mockResolvedValue(undefined),
  addOpening: jest.fn().mockResolvedValue(mockCvOpening),
  findOpeningForOrg: jest.fn().mockResolvedValue(mockCvOpening),
  updateOpening: jest.fn().mockResolvedValue(mockCvOpening),
  removeOpening: jest.fn().mockResolvedValue(undefined),
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
        { provide: OrgContextService, useValue: orgContextMock },
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
      mockOrgId,
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

  it('POST /projects/:id/work-items saves work items', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${mockProjectId}/work-items`)
      .send({
        items: [{ work_type_id: mockWorkTypeId, skill_level: 'intermediate' }],
      })
      .expect(201)
      .expect((res: request.Response) => {
        const body = res.body as Array<{ id: string; skill_level: string }>;
        expect(body[0].id).toBe(mockWorkItemId);
        expect(body[0].skill_level).toBe('intermediate');
      });

    expect(projectsServiceMock.saveWorkItems).toHaveBeenCalledWith(
      mockProjectId,
      mockOrgId,
      expect.objectContaining({
        items: [
          expect.objectContaining({
            work_type_id: mockWorkTypeId,
            skill_level: 'intermediate',
          }),
        ],
      }),
      undefined,
    );
  });

  it('POST /projects/:id/work-items rejects an empty items array', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${mockProjectId}/work-items`)
      .send({ items: [] })
      .expect(400);
  });

  it('POST /projects/:id/work-items rejects a non-UUID work_type_id', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${mockProjectId}/work-items`)
      .send({
        items: [{ work_type_id: 'not-a-uuid', skill_level: 'intermediate' }],
      })
      .expect(400);
  });

  it('POST /projects/:id/work-items rejects an invalid skill_level', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${mockProjectId}/work-items`)
      .send({
        items: [{ work_type_id: mockWorkTypeId, skill_level: 'wizard' }],
      })
      .expect(400);
  });

  it('GET /projects/:id/rooms lists the project rooms', async () => {
    await request(app.getHttpServer())
      .get(`/projects/${mockProjectId}/rooms`)
      .expect(200)
      .expect((res: request.Response) => {
        const body = res.body as Array<{ id: string; name: string }>;
        expect(Array.isArray(body)).toBe(true);
        expect(body[0].id).toBe(mockRoomId);
        expect(body[0].name).toBe('Salon');
      });
  });

  it('POST /projects/:id/rooms creates a room', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${mockProjectId}/rooms`)
      .send({ name: 'Chambre' })
      .expect(201)
      .expect((res: request.Response) => {
        expect((res.body as { id: string }).id).toBe(mockRoomId);
      });

    expect(projectsServiceMock.createRoom).toHaveBeenCalledWith(
      mockProjectId,
      mockOrgId,
      expect.objectContaining({ name: 'Chambre' }),
    );
  });

  it('PATCH /projects/:id/rooms/:roomId renames a room', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${mockProjectId}/rooms/${mockRoom.id}`)
      .send({ name: 'Cuisine' })
      .expect(200)
      .expect((res: request.Response) => {
        expect((res.body as { name: string }).name).toBe('Cuisine');
      });
  });

  it('DELETE /projects/:id/rooms/:roomId removes a room', async () => {
    await request(app.getHttpServer())
      .delete(`/projects/${mockProjectId}/rooms/${mockRoom.id}`)
      .expect(204);
  });

  it('DELETE /projects/:id/rooms/:roomId returns 400 for the last room', async () => {
    projectsServiceMock.deleteRoom.mockRejectedValueOnce(
      new BadRequestException('Un projet doit conserver au moins une pièce.'),
    );

    await request(app.getHttpServer())
      .delete(`/projects/${mockProjectId}/rooms/${mockRoom.id}`)
      .expect(400);
  });

  describe('corrections openings (CV-6)', () => {
    it('PUT /openings/:id logs one correction per modified field on a cv opening', async () => {
      projectsServiceMock.updateOpening.mockResolvedValueOnce({
        ...mockCvOpening,
        type: 'window',
        width_cm: 120,
      });

      await request(app.getHttpServer())
        .put(`/projects/${mockProjectId}/openings/${mockOpeningId}`)
        .send({ type: 'window', width_cm: 120 })
        .expect(200);

      expect(cvCorrectionServiceMock.logCorrection).toHaveBeenCalledTimes(2);
      expect(cvCorrectionServiceMock.logCorrection).toHaveBeenCalledWith(
        mockProjectId,
        'opening',
        'type',
        cvOpeningSnapshot,
        expect.objectContaining({ type: 'window' }),
      );
      expect(cvCorrectionServiceMock.logCorrection).toHaveBeenCalledWith(
        mockProjectId,
        'opening',
        'width_cm',
        cvOpeningSnapshot,
        expect.objectContaining({ width_cm: 120 }),
      );
    });

    it('PUT /openings/:id logs nothing on a manual opening', async () => {
      const manual = {
        ...mockCvOpening,
        source: 'manual',
        cv_confidence: null,
      };
      projectsServiceMock.findOpeningForOrg.mockResolvedValueOnce(manual);
      projectsServiceMock.updateOpening.mockResolvedValueOnce({
        ...manual,
        width_cm: 120,
      });

      await request(app.getHttpServer())
        .put(`/projects/${mockProjectId}/openings/${mockOpeningId}`)
        .send({ width_cm: 120 })
        .expect(200);

      expect(cvCorrectionServiceMock.logCorrection).not.toHaveBeenCalled();
    });

    it('DELETE /openings/:id logs a removed correction on a cv opening', async () => {
      await request(app.getHttpServer())
        .delete(`/projects/${mockProjectId}/openings/${mockOpeningId}`)
        .expect(204);

      expect(cvCorrectionServiceMock.logCorrection).toHaveBeenCalledWith(
        mockProjectId,
        'opening',
        'removed',
        cvOpeningSnapshot,
        { deleted: true },
      );
    });

    it('POST /openings on the default room logs an added report', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${mockProjectId}/openings`)
        .send({ type: 'door', width_cm: 90, height_cm: 204 })
        .expect(201);

      expect(cvCorrectionServiceMock.logCorrection).toHaveBeenCalledWith(
        mockProjectId,
        'opening',
        'added',
        { missed: true },
        cvOpeningSnapshot,
      );
    });

    it('POST /openings targeting an explicit room logs nothing', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${mockProjectId}/openings?room=${mockRoomId}`)
        .send({ type: 'door', width_cm: 90, height_cm: 204 })
        .expect(201);

      expect(cvCorrectionServiceMock.logCorrection).not.toHaveBeenCalled();
    });

    it('a failing correction log never breaks the mutation', async () => {
      cvCorrectionServiceMock.logCorrection.mockRejectedValueOnce(
        new Error('db down'),
      );

      await request(app.getHttpServer())
        .delete(`/projects/${mockProjectId}/openings/${mockOpeningId}`)
        .expect(204);
    });
  });
});
