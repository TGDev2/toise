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
    it('renvoie {status: "ok"} quand la base répond', async () => {
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      await expect(appController.health()).resolves.toEqual({
        status: 'ok',
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
