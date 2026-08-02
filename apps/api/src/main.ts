import './instrument';
import { NestFactory } from '@nestjs/core';
import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import type { Request } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { WidgetService } from './widget/widget.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: new ConsoleLogger({
      json: process.env.NODE_ENV === 'production',
    }),
  });
  const config = app.get(ConfigService);

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
      callback: (
        err: Error | null,
        options?: { origin: boolean | string[]; credentials: boolean },
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
