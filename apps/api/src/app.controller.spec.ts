import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    dataSource = { query: jest.fn() };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: DataSource, useValue: dataSource }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    const initialVersion = process.env.APP_VERSION;

    afterEach(() => {
      if (initialVersion === undefined) {
        delete process.env.APP_VERSION;
      } else {
        process.env.APP_VERSION = initialVersion;
      }
    });

    it('renvoie {status: "ok"} quand la base répond', async () => {
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      await expect(appController.health()).resolves.toEqual({
        status: 'ok',
        version: expect.any(String) as unknown as string,
      });
    });

    it('rapporte la version figée dans l’image', async () => {
      process.env.APP_VERSION = 'v1.2.3';
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      await expect(appController.health()).resolves.toEqual({
        status: 'ok',
        version: 'v1.2.3',
      });
    });

    it('retombe sur "dev" hors image de production', async () => {
      delete process.env.APP_VERSION;
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      await expect(appController.health()).resolves.toEqual({
        status: 'ok',
        version: 'dev',
      });
    });

    it('propage l’erreur quand la base est injoignable', async () => {
      dataSource.query.mockRejectedValue(new Error('connection refused'));
      await expect(appController.health()).rejects.toThrow(
        'connection refused',
      );
    });
  });
});
