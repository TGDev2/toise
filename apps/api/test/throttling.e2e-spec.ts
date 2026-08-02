import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { THROTTLER_CONFIG } from '../src/config/throttler.config';

/**
 * Non-régression du plafond global de rate limiting.
 *
 * Contexte : une configuration à deux limiteurs nommés (`short` 100/min et
 * `auth` 5 req/15 min) plafonnait en réalité *toute* l'API à 5 requêtes par
 * quart d'heure — `ThrottlerGuard` applique tous les limiteurs déclarés à
 * toutes les routes. Le symptôme se mesurait en six requêtes : ouvrir une
 * liste de courses en émet cinq.
 *
 * Ce test exerce `THROTTLER_CONFIG` — la configuration réellement montée par
 * `AppModule` — sur un contrôleur nu, c'est-à-dire un contrôleur qui n'a pas
 * pensé à se protéger. C'est exactement le cas des 27 contrôleurs concernés.
 */
@Controller('plain')
class PlainController {
  @Get()
  read() {
    return { ok: true };
  }
}

/** Une route qui *veut* un plafond strict le déclare, et lui seul le subit. */
@Controller('strict')
class StrictController {
  @Get()
  @Throttle({ default: { ttl: 900_000, limit: 2 } })
  sensitive() {
    return { ok: true };
  }
}

@Module({
  imports: [ThrottlerModule.forRoot(THROTTLER_CONFIG)],
  controllers: [PlainController, StrictController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class ThrottlingTestModule {}

describe('Rate limiting global (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ThrottlingTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("laisse passer bien plus de 5 requêtes sur un contrôleur qui n'a rien déclaré", async () => {
    for (let i = 0; i < 20; i++) {
      await request(app.getHttpServer()).get('/plain').expect(200);
    }
  });

  it('applique le plafond de route quand une route en déclare un', async () => {
    await request(app.getHttpServer()).get('/strict').expect(200);
    await request(app.getHttpServer()).get('/strict').expect(200);
    await request(app.getHttpServer()).get('/strict').expect(429);
  });

  it("n'expose qu'un seul limiteur : un second s'appliquerait à toutes les routes", () => {
    expect(Array.isArray(THROTTLER_CONFIG)).toBe(true);
    expect(THROTTLER_CONFIG as unknown[]).toHaveLength(1);
  });
});
