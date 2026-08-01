import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SubscriptionTier } from '../users/entities/user.entity';
import { ApiUsageCounter } from './entities/api-usage-counter.entity';
import { ApiUsageService, monthlyQuotaFor } from './api-usage.service';

const ORG_ID = '00000000-0000-4000-8000-0000000000aa';

describe('ApiUsageService', () => {
  let service: ApiUsageService;

  const countersRepo = { query: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiUsageService,
        {
          provide: getRepositoryToken(ApiUsageCounter),
          useValue: countersRepo,
        },
      ],
    }).compile();

    service = module.get(ApiUsageService);
  });

  describe('consume', () => {
    it('incrémente et décide dans la même instruction atomique', async () => {
      countersRepo.query.mockResolvedValue([
        {
          period: '2026-08',
          request_count: '42',
          reset_at: new Date('2026-09-01T00:00:00+02:00'),
        },
      ]);

      const usage = await service.consume(ORG_ID);

      const [sql, params] = countersRepo.query.mock.calls[0] as [
        string,
        unknown[],
      ];
      // Sans ON CONFLICT … RETURNING, deux requêtes simultanées pourraient
      // franchir la limite ensemble : c'est la garantie qu'on teste ici.
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('RETURNING');
      expect(sql).toContain('"request_count" + 1');
      expect(sql).toContain('"updated_at" = now()');
      expect(params).toEqual([ORG_ID]);
      expect(usage.count).toBe(42);
      expect(usage.period).toBe('2026-08');
    });

    it('calcule la période et la remise à zéro côté SQL, en Europe/Paris', async () => {
      countersRepo.query.mockResolvedValue([
        { period: '2026-08', request_count: 1, reset_at: new Date() },
      ]);

      await service.consume(ORG_ID);

      const [sql] = countersRepo.query.mock.calls[0] as [string];
      // Calculer le mois en Node l'exposerait au fuseau du process : deux
      // instances mal configurées scinderaient le quota d'un même client.
      expect(sql).toContain("AT TIME ZONE 'Europe/Paris'");
      expect(sql).toContain('to_char');
      expect(sql).toContain("date_trunc('month'");
    });
  });

  describe('peek', () => {
    it('ne consomme rien et rend 0 sur un mois jamais entamé', async () => {
      countersRepo.query.mockResolvedValue([
        { period: '2026-08', request_count: '0', reset_at: new Date() },
      ]);

      const usage = await service.peek(ORG_ID);

      const [sql] = countersRepo.query.mock.calls[0] as [string];
      expect(sql).not.toContain('INSERT');
      expect(sql).toContain('COALESCE');
      expect(usage.count).toBe(0);
    });
  });

  describe('monthlyQuotaFor', () => {
    it('n’accorde de quota qu’au palier Contractor Premium', () => {
      expect(monthlyQuotaFor(SubscriptionTier.CONTRACTOR_PREMIUM)).toBe(10_000);
      expect(monthlyQuotaFor(SubscriptionTier.CONTRACTOR_STANDARD)).toBe(0);
      expect(monthlyQuotaFor(SubscriptionTier.PRO)).toBe(0);
      expect(monthlyQuotaFor(SubscriptionTier.FREE)).toBe(0);
    });

    it('retombe sur 0 pour un palier inconnu (fail-closed)', () => {
      expect(monthlyQuotaFor('palier_inexistant' as SubscriptionTier)).toBe(0);
    });
  });
});
