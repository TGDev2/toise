import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { Project } from '../projects/entities/project.entity';
import { CommunityProject } from '../community/entities/community-project.entity';
import { STORAGE_PROVIDER } from '../photos/storage/storage.interface';
import { DataRetentionService } from './data-retention.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Trace d'appel partagée : c'est l'**ordre** qui porte la garantie ici. */
let calls: string[] = [];

const queryBuilderMock = {
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  withDeleted: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getRawMany: jest.fn(),
};

const projectRepoMock = {
  createQueryBuilder: jest.fn(() => queryBuilderMock),
  delete: jest.fn(),
};

const communityRepoMock = {
  count: jest.fn(),
  softDelete: jest.fn(),
};

const storageMock = {
  save: jest.fn(),
  delete: jest.fn(),
  listPrefix: jest.fn(),
  deletePrefix: jest.fn(),
  getAbsolutePath: jest.fn(),
};

const queryRunnerMock = {
  connect: jest.fn(),
  query: jest.fn(),
  release: jest.fn(),
};

const dataSourceMock = {
  createQueryRunner: jest.fn(() => queryRunnerMock),
};

function grantLock(granted = true): void {
  queryRunnerMock.query.mockImplementation((sql: string) =>
    sql.includes('pg_try_advisory_lock')
      ? Promise.resolve([{ locked: granted }])
      : Promise.resolve([]),
  );
}

async function buildService(config: {
  days?: number;
  dryRun?: boolean;
}): Promise<DataRetentionService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      DataRetentionService,
      { provide: getRepositoryToken(Project), useValue: projectRepoMock },
      {
        provide: getRepositoryToken(CommunityProject),
        useValue: communityRepoMock,
      },
      { provide: STORAGE_PROVIDER, useValue: storageMock },
      { provide: getDataSourceToken(), useValue: dataSourceMock },
      {
        provide: ConfigService,
        useValue: {
          get: (key: string, fallback: unknown) =>
            key === 'dataRetention.days'
              ? (config.days ?? fallback)
              : (config.dryRun ?? fallback),
        },
      },
    ],
  }).compile();

  return module.get(DataRetentionService);
}

describe('DataRetentionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    calls = [];

    grantLock();
    queryBuilderMock.getRawMany.mockResolvedValue([]);
    communityRepoMock.count.mockResolvedValue(0);
    communityRepoMock.softDelete.mockImplementation(() => {
      calls.push('community.softDelete');
      return Promise.resolve({ affected: 1 });
    });
    storageMock.deletePrefix.mockImplementation(() => {
      calls.push('storage.deletePrefix');
      return Promise.resolve([{ path: 'p/a.jpg', bytes: 1024 }]);
    });
    storageMock.listPrefix.mockImplementation(() => {
      calls.push('storage.listPrefix');
      return Promise.resolve([{ path: 'p/a.jpg', bytes: 1024 }]);
    });
    projectRepoMock.delete.mockImplementation(() => {
      calls.push('project.delete');
      return Promise.resolve({ affected: 1 });
    });
  });

  const expiredRow = {
    id: 'project-1',
    user_id: 'user-1',
    deleted_at: new Date('2026-06-01T00:00:00.000Z'),
  };

  describe('purgeExpiredProjects', () => {
    it('applies the configured retention as the cutoff date', async () => {
      const service = await buildService({ days: 30 });
      const before = Date.now();

      await service.purgeExpiredProjects();

      const [, params] = queryBuilderMock.andWhere.mock.calls[0] as [
        string,
        { cutoff: Date },
      ];
      const expected = before - 30 * DAY_MS;
      // Tolérance large : seule compte la distance en jours, pas la milliseconde.
      expect(Math.abs(params.cutoff.getTime() - expected)).toBeLessThan(
        60 * 1000,
      );
    });

    it('erases files before the row — the only order a crash leaves recoverable', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([expiredRow]);
      const service = await buildService({ days: 30 });

      await service.purgeExpiredProjects();

      expect(calls).toEqual(['storage.deletePrefix', 'project.delete']);
      expect(storageMock.deletePrefix).toHaveBeenCalledWith('project-1');
      expect(projectRepoMock.delete).toHaveBeenCalledWith('project-1');
    });

    it('withdraws a surviving community publication before erasing anything', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([expiredRow]);
      communityRepoMock.count.mockResolvedValue(1);
      const service = await buildService({ days: 30 });

      const summary = await service.purgeExpiredProjects();

      expect(calls).toEqual([
        'community.softDelete',
        'storage.deletePrefix',
        'project.delete',
      ]);
      expect(communityRepoMock.softDelete).toHaveBeenCalledWith({
        project_id: 'project-1',
      });
      expect(summary.projects[0].community_withdrawn).toBe(true);
    });

    it('leaves the community table alone when no publication survives', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([expiredRow]);
      const service = await buildService({ days: 30 });

      const summary = await service.purgeExpiredProjects();

      expect(communityRepoMock.softDelete).not.toHaveBeenCalled();
      expect(summary.projects[0].community_withdrawn).toBe(false);
    });

    it('reports what it would erase in dry run and writes nothing', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([expiredRow]);
      communityRepoMock.count.mockResolvedValue(1);
      const service = await buildService({ days: 30 });

      const summary = await service.purgeExpiredProjects({ dryRun: true });

      expect(calls).toEqual(['storage.listPrefix']);
      expect(storageMock.deletePrefix).not.toHaveBeenCalled();
      expect(projectRepoMock.delete).not.toHaveBeenCalled();
      expect(communityRepoMock.softDelete).not.toHaveBeenCalled();
      expect(summary).toMatchObject({
        dry_run: true,
        files: 1,
        bytes: 1024,
        failed: [],
      });
      // La simulation doit annoncer le retrait à venir, pas le taire.
      expect(summary.projects[0].community_withdrawn).toBe(true);
    });

    it('honours DATA_RETENTION_DRY_RUN without an explicit argument', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([expiredRow]);
      const service = await buildService({ days: 30, dryRun: true });

      const summary = await service.purgeExpiredProjects();

      expect(summary.dry_run).toBe(true);
      expect(storageMock.deletePrefix).not.toHaveBeenCalled();
    });

    it.each([0, -1, NaN])(
      'refuses to run with a retention of %p rather than purging everything',
      async (days) => {
        const service = await buildService({ days });

        await expect(service.purgeExpiredProjects()).rejects.toThrow(
          /Rétention invalide/,
        );
        expect(queryBuilderMock.getRawMany).not.toHaveBeenCalled();
      },
    );

    it('skips the pass when another one holds the lock', async () => {
      grantLock(false);
      queryBuilderMock.getRawMany.mockResolvedValue([expiredRow]);
      const service = await buildService({ days: 30 });

      const summary = await service.purgeExpiredProjects();

      expect(summary.skipped).toBe(true);
      expect(queryBuilderMock.getRawMany).not.toHaveBeenCalled();
      expect(queryRunnerMock.release).toHaveBeenCalled();
    });

    it('releases the lock and the connection even when the pass throws', async () => {
      queryBuilderMock.getRawMany.mockRejectedValue(new Error('boom'));
      const service = await buildService({ days: 30 });

      await expect(service.purgeExpiredProjects()).rejects.toThrow('boom');

      expect(queryRunnerMock.query).toHaveBeenCalledWith(
        'SELECT pg_advisory_unlock($1)',
        expect.any(Array),
      );
      expect(queryRunnerMock.release).toHaveBeenCalled();
    });

    it('carries on after a project fails and names it in the summary', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([
        { ...expiredRow, id: 'broken' },
        { ...expiredRow, id: 'fine' },
      ]);
      storageMock.deletePrefix.mockImplementation((prefix: string) =>
        prefix === 'broken'
          ? Promise.reject(new Error('EACCES'))
          : Promise.resolve([{ path: 'fine/a.jpg', bytes: 10 }]),
      );
      const service = await buildService({ days: 30 });

      const summary = await service.purgeExpiredProjects();

      expect(summary.failed).toEqual(['broken']);
      expect(summary.projects).toHaveLength(1);
      // Le projet en échec reste marqué supprimé : la passe suivante le reprend.
      expect(projectRepoMock.delete).toHaveBeenCalledTimes(1);
      expect(projectRepoMock.delete).toHaveBeenCalledWith('fine');
    });
  });

  describe('eraseUserFiles', () => {
    it('erases the files of every project of the account, deleted ones included', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([
        expiredRow,
        { ...expiredRow, id: 'project-2', deleted_at: null },
      ]);
      const service = await buildService({ days: 30 });

      const summary = await service.eraseUserFiles('user-1');

      expect(queryBuilderMock.withDeleted).toHaveBeenCalled();
      expect(storageMock.deletePrefix).toHaveBeenCalledWith('project-1');
      expect(storageMock.deletePrefix).toHaveBeenCalledWith('project-2');
      expect(summary.files).toBe(2);
    });

    it('never deletes the project rows — the account deletion transaction owns that', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([expiredRow]);
      const service = await buildService({ days: 30 });

      await service.eraseUserFiles('user-1');

      expect(projectRepoMock.delete).not.toHaveBeenCalled();
    });

    it('propagates a storage failure instead of reporting an erasure it did not perform', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([expiredRow]);
      storageMock.deletePrefix.mockRejectedValue(new Error('EACCES'));
      const service = await buildService({ days: 30 });

      await expect(service.eraseUserFiles('user-1')).rejects.toThrow('EACCES');
    });

    it('runs whatever the configured retention is — it is not a retention pass', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([expiredRow]);
      const service = await buildService({ days: 0 });

      await expect(service.eraseUserFiles('user-1')).resolves.toMatchObject({
        files: 1,
        cutoff: null,
      });
    });
  });

  describe('runDailyPurge', () => {
    it('swallows the failure — an unhandled rejection in a cron kills the process', async () => {
      queryBuilderMock.getRawMany.mockRejectedValue(new Error('boom'));
      const service = await buildService({ days: 30 });

      await expect(service.runDailyPurge()).resolves.toBeUndefined();
    });
  });
});
