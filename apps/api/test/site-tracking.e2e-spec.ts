import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { SiteTrackingController } from '../src/site-tracking/site-tracking.controller';
import { SiteTrackingService } from '../src/site-tracking/site-tracking.service';
import { MilestoneStatus } from '../src/site-tracking/entities/site-milestone.entity';
import { UsersService } from '../src/users/users.service';
import { FeatureGatesService } from '../src/feature-gates/feature-gates.service';
import { FirebaseAuthGuard } from '../src/auth/guards/firebase-auth.guard';
import { SubscriptionTier } from '../src/users/entities/user.entity';

const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockProjectId = '223e4567-e89b-12d3-a456-426614174000';
const mockMilestoneId = '323e4567-e89b-12d3-a456-426614174000';
const mockFirebaseUid = 'firebase-uid-123';

const mockMilestone = {
  id: mockMilestoneId,
  project_id: mockProjectId,
  label: 'Démolition',
  status: MilestoneStatus.PENDING,
  planned_date: '2026-08-15',
  actual_date: null,
  sort_order: 0,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
};

const siteTrackingServiceMock = {
  findAllForProject: jest.fn().mockResolvedValue([mockMilestone]),
  create: jest.fn().mockResolvedValue(mockMilestone),
  update: jest.fn().mockResolvedValue(mockMilestone),
  remove: jest.fn().mockResolvedValue(undefined),
};

const usersServiceMock = {
  findByFirebaseUid: jest.fn().mockResolvedValue({
    id: mockUserId,
    subscription_tier: SubscriptionTier.CONTRACTOR_STANDARD,
  }),
};

const featureGatesServiceMock = {
  isFeatureAllowed: jest.fn().mockResolvedValue(true),
  getGateConfig: jest.fn().mockResolvedValue({
    feature_key: 'site_tracking',
    min_tier: 'contractor_standard',
  }),
};

describe('SiteTrackingController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    jest.clearAllMocks();
    siteTrackingServiceMock.findAllForProject.mockResolvedValue([
      mockMilestone,
    ]);
    siteTrackingServiceMock.create.mockResolvedValue(mockMilestone);
    siteTrackingServiceMock.update.mockResolvedValue(mockMilestone);
    siteTrackingServiceMock.remove.mockResolvedValue(undefined);
    usersServiceMock.findByFirebaseUid.mockResolvedValue({
      id: mockUserId,
      subscription_tier: SubscriptionTier.CONTRACTOR_STANDARD,
    });
    featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(true);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SiteTrackingController],
      providers: [
        { provide: SiteTrackingService, useValue: siteTrackingServiceMock },
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

  describe('GET /projects/:id/milestones', () => {
    it('returns the milestones for the authenticated contractor', async () => {
      await request(app.getHttpServer())
        .get(`/projects/${mockProjectId}/milestones`)
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body).toEqual([mockMilestone]);
        });

      expect(siteTrackingServiceMock.findAllForProject).toHaveBeenCalledWith(
        mockProjectId,
        mockUserId,
      );
    });

    it('rejects with 403 when the feature gate refuses the user tier', async () => {
      featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(false);
      usersServiceMock.findByFirebaseUid.mockResolvedValue({
        id: mockUserId,
        subscription_tier: SubscriptionTier.CONTRACTOR_ESSENTIEL,
      });

      await request(app.getHttpServer())
        .get(`/projects/${mockProjectId}/milestones`)
        .expect(403)
        .expect((res: request.Response) => {
          expect(
            (res.body as { error: string; feature_key: string }).error,
          ).toBe('FEATURE_GATED');
          expect((res.body as { feature_key: string }).feature_key).toBe(
            'site_tracking',
          );
        });

      expect(siteTrackingServiceMock.findAllForProject).not.toHaveBeenCalled();
    });
  });

  describe('POST /projects/:id/milestones', () => {
    it('creates a milestone for the authenticated contractor', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${mockProjectId}/milestones`)
        .send({ label: 'Démolition', planned_date: '2026-08-15' })
        .expect(201)
        .expect((res: request.Response) => {
          expect(res.body).toEqual(mockMilestone);
        });

      expect(siteTrackingServiceMock.create).toHaveBeenCalledWith(
        mockProjectId,
        mockUserId,
        { label: 'Démolition', planned_date: '2026-08-15' },
      );
    });

    it('rejects an empty label', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${mockProjectId}/milestones`)
        .send({ label: '' })
        .expect(400);

      expect(siteTrackingServiceMock.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid planned_date', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${mockProjectId}/milestones`)
        .send({ label: 'Démolition', planned_date: 'not-a-date' })
        .expect(400);

      expect(siteTrackingServiceMock.create).not.toHaveBeenCalled();
    });

    it('rejects with 403 when the feature gate refuses the user tier', async () => {
      featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(false);
      usersServiceMock.findByFirebaseUid.mockResolvedValue({
        id: mockUserId,
        subscription_tier: SubscriptionTier.CONTRACTOR_ESSENTIEL,
      });

      await request(app.getHttpServer())
        .post(`/projects/${mockProjectId}/milestones`)
        .send({ label: 'Démolition' })
        .expect(403);

      expect(siteTrackingServiceMock.create).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /projects/:id/milestones/:milestoneId', () => {
    it('updates the milestone status', async () => {
      await request(app.getHttpServer())
        .patch(`/projects/${mockProjectId}/milestones/${mockMilestoneId}`)
        .send({ status: 'done' })
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body).toEqual(mockMilestone);
        });

      expect(siteTrackingServiceMock.update).toHaveBeenCalledWith(
        mockProjectId,
        mockUserId,
        mockMilestoneId,
        { status: 'done' },
      );
    });

    it('rejects an invalid status value', async () => {
      await request(app.getHttpServer())
        .patch(`/projects/${mockProjectId}/milestones/${mockMilestoneId}`)
        .send({ status: 'not-a-status' })
        .expect(400);

      expect(siteTrackingServiceMock.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /projects/:id/milestones/:milestoneId', () => {
    it('removes the milestone', async () => {
      await request(app.getHttpServer())
        .delete(`/projects/${mockProjectId}/milestones/${mockMilestoneId}`)
        .expect(204);

      expect(siteTrackingServiceMock.remove).toHaveBeenCalledWith(
        mockProjectId,
        mockUserId,
        mockMilestoneId,
      );
    });

    it('rejects with 403 when the feature gate refuses the user tier', async () => {
      featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(false);
      usersServiceMock.findByFirebaseUid.mockResolvedValue({
        id: mockUserId,
        subscription_tier: SubscriptionTier.CONTRACTOR_ESSENTIEL,
      });

      await request(app.getHttpServer())
        .delete(`/projects/${mockProjectId}/milestones/${mockMilestoneId}`)
        .expect(403);

      expect(siteTrackingServiceMock.remove).not.toHaveBeenCalled();
    });
  });
});
