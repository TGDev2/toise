import './instrument';
import { NestFactory } from '@nestjs/core';
import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import type { Request } from 'express';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { WidgetService } from './widget/widget.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    logger: new ConsoleLogger({
      json: process.env.NODE_ENV === 'production',
    }),
  });
  const config = app.get(ConfigService);

  // Doit précéder tout ce qui lit `req.ip` — au premier rang le rate limiting,
  // dont chaque compteur est indexé par IP. Cf. `parseTrustProxy`.
  const trustProxy = config.get<boolean | number | string>('trustProxy');
  if (trustProxy !== false && trustProxy !== undefined) {
    app.set('trust proxy', trustProxy);
  }

  app.use(helmet());
  app.use(compression());
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Le widget marque blanche (PLAT-7) est appelé depuis des origines tierces
  // que la liste blanche statique ci-dessous ne connaît jamais à l'avance :
  // pour ses seules routes, l'origine est validée dynamiquement contre les
  // configurations actives (`WidgetService.isOriginAllowedForCors`, mise en
  // cache — cf. son doc-comment). Toute autre route garde exactement le
  // comportement statique d'avant, à l'octet près. Cette vérification n'est
  // qu'une couche grossière qui décide si le navigateur restitue la réponse au
  // JS appelant ; `WidgetOriginGuard` reste la vérification précise, par clé.
  const widgetService = app.get(WidgetService);
  const corsOrigins = config.get<string[]>('corsOrigins');
  app.enableCors(
    (
      req: Request,
      // `options` non optionnel : `NestExpressApplication` type le délégué CORS
      // plus strictement que `INestApplication`, et tous les chemins ci-dessous
      // passent bien une valeur.
      callback: (
        err: Error | null,
        options: { origin: boolean | string[]; credentials: boolean },
      ) => void,
    ) => {
      if (!req.path.startsWith('/api/v1/widget/')) {
        callback(null, { origin: corsOrigins ?? [], credentials: true });
        return;
      }
      const origin = req.headers.origin;
      if (!origin) {
        callback(null, { origin: false, credentials: false });
        return;
      }
      widgetService
        .isOriginAllowedForCors(origin)
        .then((allowed) =>
          callback(null, { origin: allowed, credentials: false }),
        )
        .catch(() => callback(null, { origin: false, credentials: false }));
    },
  );

  const port = config.get<number>('port') ?? 3001;
  await app.listen(port);
}

void bootstrap();
