import './instrument';
import { NestFactory } from '@nestjs/core';
import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

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
  app.enableCors({
    origin: config.get<string[]>('corsOrigins'),
    credentials: true,
  });

  const port = config.get<number>('port') ?? 3001;
  await app.listen(port);
}

void bootstrap();
