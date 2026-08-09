import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { LogbookController } from '../src/logbook/logbook.controller';
import { LogbookService } from '../src/logbook/logbook.service';
import { UserContextService } from '../src/users/user-context.service';
import { FeatureGatesService } from '../src/feature-gates/feature-gates.service';
import { FirebaseAuthGuard } from '../src/auth/guards/firebase-auth.guard';
import { SubscriptionTier } from '../src/users/entities/user.entity';

/**
 * PLAT-1 / DATA-5 — le carnet du logement ne renvoyait rien à personne.
 *
 * `room_log_entries.user_id` est écrit avec `scope.userId` par
 * `recordChantierCompletion`, et le contrôleur interrogeait
 * `findAllByUser(scope.userId)`. Deux UUID de deux tables différentes :
 * le filtre ne pouvait jamais rendre une ligne.
 *
 * Le défaut a survécu parce que `logbook.service.spec.ts` teste le service
 * seul, à qui l'on passe un `userId` correct — l'erreur était dans le
 * contrôleur, que rien n'exerçait. C'est le seul étage où elle est visible.
 */
const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockFirebaseUid = 'firebase-uid-123';

const logbookServiceMock = {
  findAllByUser: jest.fn().mockResolvedValue([]),
};

const userContextMock = {
  resolveForFirebaseUid: jest.fn().mockResolvedValue({
    user: { id: mockUserId, subscription_tier: SubscriptionTier.FREE },
    userId: mockUserId,
    effectiveTier: SubscriptionTier.FREE,
  }),
};

const featureGatesServiceMock = {
  isFeatureAllowed: jest.fn().mockResolvedValue(true),
  getGateConfig: jest.fn().mockResolvedValue(null),
};

describe('LogbookController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    jest.clearAllMocks();
    logbookServiceMock.findAllByUser.mockResolvedValue([]);
    featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(true);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [LogbookController],
      providers: [
        { provide: LogbookService, useValue: logbookServiceMock },
        { provide: UserContextService, useValue: userContextMock },
        { provide: FeatureGatesService, useValue: featureGatesServiceMock },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext): boolean {
          const req = context.switchToHttp().getRequest<{
            firebaseUser?: { uid: string };
          }>();
          req.firebaseUser = { uid: mockFirebaseUid };
          return true;
        },
      } satisfies CanActivate)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("interroge le carnet avec l'identifiant de l'utilisateur", async () => {
    await request(app.getHttpServer()).get('/api/v1/logbook').expect(200);

    // Ce test opposait l'identifiant de l'utilisateur à celui de son
    // organisation : le carnet du logement était délibérément la seule
    // ressource restée scopée à la personne. E4-1 ayant fait de la portée
    // utilisateur la règle générale, l'opposition n'a plus d'objet — reste que
    // la route doit passer l'identifiant du compte appelant.
    expect(logbookServiceMock.findAllByUser).toHaveBeenCalledWith(mockUserId);
  });

  it('rend les entrées du carnet telles que le service les fournit', async () => {
    logbookServiceMock.findAllByUser.mockResolvedValue([
      { id: 'entry-1', room_name: 'Salon', user_id: mockUserId },
    ]);

    const response = await request(app.getHttpServer())
      .get('/api/v1/logbook')
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect((response.body as { room_name: string }[])[0].room_name).toBe(
      'Salon',
    );
  });
});
