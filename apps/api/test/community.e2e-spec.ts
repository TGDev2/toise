import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { CommunityController } from '../src/community/community.controller';
import { CommunityService } from '../src/community/community.service';
import { UsersService } from '../src/users/users.service';
import { PhotosService } from '../src/photos/photos.service';
import { FirebaseConfig } from '../src/config/firebase.config';
import { FeatureGatesService } from '../src/feature-gates/feature-gates.service';

const mockCommunityProjectId = '323e4567-e89b-12d3-a456-426614174000';

const mockSummary = {
  id: mockCommunityProjectId,
  title: 'Carrelage salle de bain 8 m²',
  work_type: 'tiling',
  thumbnail_url: `/community/${mockCommunityProjectId}/photos/photo-1/thumbnail`,
  likes_count: 3,
  comments_count: 1,
  user_display_name: 'g***',
  published_at: '2026-07-01T00:00:00.000Z',
};

const mockDetail = {
  ...mockSummary,
  description: 'Rénovation complète de la salle de bain.',
  purchase_list: { material_items: [], complementary_items: [] },
  budget_summary: {
    total_real_cost: 850,
    savings_amount: 50,
    savings_percent: 5.6,
  },
  total_cost_cents: 85000,
  duration_days: 4,
  length_cm: 400,
  width_cm: 200,
  height_cm: 250,
  before_photo_ids: ['photo-0'],
  after_photo_ids: ['photo-1'],
  has_liked: false,
  is_owner: false,
};

// Pas de tokens à vérifier ici : ce doublon n'a pas besoin d'appeler l'admin
// SDK Firebase puisque toutes les requêtes de ce fichier n'envoient jamais
// d'en-tête Authorization (c'est justement ce qui est testé).
const firebaseConfigMock = {
  getAuth: () => ({ verifyIdToken: jest.fn() }),
};

const communityServiceMock = {
  listApproved: jest.fn().mockResolvedValue({
    data: [mockSummary],
    meta: { total: 1, page: 1, limit: 12, totalPages: 1 },
  }),
  getApprovedDetail: jest.fn().mockResolvedValue(mockDetail),
};

const usersServiceMock = {
  findByFirebaseUid: jest.fn(),
};

const photosServiceMock = {
  getFileAbsolutePath: jest.fn(),
};

// Requis pour que Nest puisse instancier FeatureGateGuard (appliqué à la
// route POST /community, hors périmètre des tests d'accès anonyme ci-dessous).
const featureGatesServiceMock = {
  isFeatureAllowed: jest.fn().mockResolvedValue(true),
  getGateConfig: jest.fn().mockResolvedValue(null),
};

describe('CommunityController (e2e) — accès sans compte (COM-2)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    jest.clearAllMocks();
    communityServiceMock.listApproved.mockResolvedValue({
      data: [mockSummary],
      meta: { total: 1, page: 1, limit: 12, totalPages: 1 },
    });
    communityServiceMock.getApprovedDetail.mockResolvedValue(mockDetail);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CommunityController],
      providers: [
        { provide: CommunityService, useValue: communityServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: PhotosService, useValue: photosServiceMock },
        { provide: FirebaseConfig, useValue: firebaseConfigMock },
        { provide: FeatureGatesService, useValue: featureGatesServiceMock },
      ],
    }).compile();

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

  it('GET /community returns the approved gallery with no Authorization header', async () => {
    await request(app.getHttpServer())
      .get('/community')
      .expect(200)
      .expect((res: request.Response) => {
        const body = res.body as { data: Array<{ id: string }> };
        expect(body.data).toHaveLength(1);
        expect(body.data[0].id).toBe(mockCommunityProjectId);
      });

    expect(usersServiceMock.findByFirebaseUid).not.toHaveBeenCalled();
  });

  it('GET /community/:id returns project detail anonymously (real cost from COM-1)', async () => {
    await request(app.getHttpServer())
      .get(`/community/${mockCommunityProjectId}`)
      .expect(200)
      .expect((res: request.Response) => {
        const body = res.body as {
          id: string;
          total_cost_cents: number;
          is_owner: boolean;
        };
        expect(body.id).toBe(mockCommunityProjectId);
        expect(body.total_cost_cents).toBe(85000);
        expect(body.is_owner).toBe(false);
      });

    // Aucun jeton envoyé => aucune tentative de résolution d'utilisateur.
    expect(usersServiceMock.findByFirebaseUid).not.toHaveBeenCalled();
  });

  it('GET /community/:id returns 404 for a non-approved or unknown project', async () => {
    communityServiceMock.getApprovedDetail.mockRejectedValueOnce(
      new NotFoundException('Publication communautaire non trouvee'),
    );

    await request(app.getHttpServer())
      .get(`/community/${mockCommunityProjectId}`)
      .expect(404);
  });

  it('GET /community/:id rejects a non-UUID id', async () => {
    await request(app.getHttpServer()).get('/community/not-a-uuid').expect(400);
  });

  it('GET /community rejects an unknown query parameter', async () => {
    await request(app.getHttpServer()).get('/community?bogus=1').expect(400);
  });
});
