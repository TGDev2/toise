import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { OrganizationRole } from '../organizations/entities/organization-membership.entity';
import type { OrgScope } from '../organizations/org-context.service';
import { SubscriptionTier } from '../users/entities/user.entity';
import { ApiKey } from './entities/api-key.entity';
import { API_KEY_PREFIX, ApiKeysService } from './api-keys.service';

const ORG_ID = '00000000-0000-4000-8000-0000000000aa';
const OTHER_ORG_ID = '00000000-0000-4000-8000-0000000000bb';
const KEY_ID = '00000000-0000-4000-8000-00000000000c';

function makeScope(role = OrganizationRole.OWNER): OrgScope {
  return {
    user: { id: 'user-1' } as OrgScope['user'],
    userId: 'user-1',
    organization: { id: ORG_ID } as OrgScope['organization'],
    organizationId: ORG_ID,
    role,
    effectiveTier: SubscriptionTier.CONTRACTOR_PREMIUM,
  };
}

function makeKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: KEY_ID,
    organization_id: ORG_ID,
    name: 'Intégration ERP',
    key_prefix: 'chf_aaaaaaaa',
    key_hash: 'hash-courant',
    previous_key_hash: null,
    previous_key_expires_at: null,
    created_by_user_id: 'user-1',
    last_used_at: null,
    revoked_at: null,
    organization: null as never,
    created_at: new Date('2026-08-01T10:00:00Z'),
    updated_at: new Date('2026-08-01T10:00:00Z'),
    ...overrides,
  };
}

describe('ApiKeysService', () => {
  let service: ApiKeysService;

  const keysRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    query: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    keysRepo.create.mockImplementation((v: unknown) => v);
    keysRepo.save.mockImplementation((v: unknown) =>
      Promise.resolve(makeKey(v as Partial<ApiKey>)),
    );
    keysRepo.count.mockResolvedValue(0);
    keysRepo.query.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        { provide: getRepositoryToken(ApiKey), useValue: keysRepo },
      ],
    }).compile();

    service = module.get(ApiKeysService);
  });

  describe('création', () => {
    it('ne persiste que le SHA-256 et ne rend le secret qu’une fois', async () => {
      const { secret } = await service.create(makeScope(), { name: 'ERP' });

      const [saved] = keysRepo.save.mock.calls[0] as [Partial<ApiKey>];
      expect(secret.startsWith(API_KEY_PREFIX)).toBe(true);
      expect(saved.key_hash).toBe(
        createHash('sha256').update(secret).digest('hex'),
      );
      // Le secret ne doit apparaître nulle part dans la ligne persistée.
      expect(JSON.stringify(saved)).not.toContain(
        secret.slice(API_KEY_PREFIX.length),
      );
    });

    it('attache la clé à l’organisation, l’utilisateur n’étant que l’auteur', async () => {
      await service.create(makeScope(), { name: 'ERP' });
      const [saved] = keysRepo.save.mock.calls[0] as [Partial<ApiKey>];
      expect(saved.organization_id).toBe(ORG_ID);
      expect(saved.created_by_user_id).toBe('user-1');
    });

    it('refuse au-delà du plafond de clés actives', async () => {
      keysRepo.count.mockResolvedValue(10);
      await expect(
        service.create(makeScope(), { name: 'ERP' }),
      ).rejects.toMatchObject({
        response: { error: 'API_KEY_LIMIT_REACHED' },
      });
      expect(keysRepo.save).not.toHaveBeenCalled();
    });

    it('refuse à un membre simple', async () => {
      await expect(
        service.create(makeScope(OrganizationRole.MEMBER), { name: 'ERP' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(keysRepo.save).not.toHaveBeenCalled();
    });

    it('accepte un administrateur', async () => {
      await expect(
        service.create(makeScope(OrganizationRole.ADMIN), { name: 'ERP' }),
      ).resolves.toBeDefined();
    });
  });

  describe('liste', () => {
    it('n’expose jamais les empreintes', async () => {
      keysRepo.find.mockResolvedValue([
        makeKey({ key_hash: 'secret-hash', previous_key_hash: 'ancien-hash' }),
      ]);

      const [view] = await service.list(makeScope());

      expect(view).toEqual({
        id: KEY_ID,
        name: 'Intégration ERP',
        key_prefix: 'chf_aaaaaaaa',
        created_at: expect.any(Date) as Date,
        last_used_at: null,
        revoked_at: null,
        rotation_grace_until: null,
      });
      expect(JSON.stringify(view)).not.toContain('secret-hash');
      expect(JSON.stringify(view)).not.toContain('ancien-hash');
    });
  });

  describe('rotation', () => {
    it('conserve l’id, décale l’empreinte et ouvre la fenêtre de grâce', async () => {
      keysRepo.findOne.mockResolvedValue(makeKey({ key_hash: 'ancien' }));

      const { secret, key } = await service.rotate(makeScope(), KEY_ID);

      const [saved] = keysRepo.save.mock.calls[0] as [ApiKey];
      expect(key.id).toBe(KEY_ID);
      expect(saved.previous_key_hash).toBe('ancien');
      expect(saved.key_hash).toBe(
        createHash('sha256').update(secret).digest('hex'),
      );
      expect(saved.previous_key_expires_at!.getTime()).toBeGreaterThan(
        Date.now(),
      );
    });

    it('refuse une seconde rotation pendant la grâce, qui tuerait une clé encore déployée', async () => {
      keysRepo.findOne.mockResolvedValue(
        makeKey({
          previous_key_hash: 'ancien',
          previous_key_expires_at: new Date(Date.now() + 3_600_000),
        }),
      );

      await expect(service.rotate(makeScope(), KEY_ID)).rejects.toMatchObject({
        response: { error: 'ROTATION_IN_PROGRESS' },
      });
      expect(keysRepo.save).not.toHaveBeenCalled();
    });

    it('autorise à nouveau une rotation une fois la grâce expirée', async () => {
      keysRepo.findOne.mockResolvedValue(
        makeKey({
          previous_key_hash: 'ancien',
          previous_key_expires_at: new Date(Date.now() - 1_000),
        }),
      );
      await expect(service.rotate(makeScope(), KEY_ID)).resolves.toBeDefined();
    });

    it('refuse à un membre simple', async () => {
      await expect(
        service.rotate(makeScope(OrganizationRole.MEMBER), KEY_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(keysRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('révocation', () => {
    it('horodate la révocation et efface l’empreinte de rotation', async () => {
      keysRepo.findOne.mockResolvedValue(
        makeKey({
          previous_key_hash: 'ancien',
          previous_key_expires_at: new Date(Date.now() + 3_600_000),
        }),
      );

      await service.revoke(makeScope(), KEY_ID);

      const [saved] = keysRepo.save.mock.calls[0] as [ApiKey];
      expect(saved.revoked_at).toBeInstanceOf(Date);
      // Sans cet effacement, un second secret resterait valide après révocation.
      expect(saved.previous_key_hash).toBeNull();
      expect(saved.previous_key_expires_at).toBeNull();
    });
  });

  describe('cloisonnement entre organisations', () => {
    it.each([
      ['rotate', (s: ApiKeysService) => s.rotate(makeScope(), KEY_ID)],
      ['revoke', (s: ApiKeysService) => s.revoke(makeScope(), KEY_ID)],
    ])(
      '%s filtre toujours sur organization_id et refuse une clé étrangère',
      async (_name, call) => {
        // Le dépôt ne rend rien parce que le filtre organisation ne matche pas :
        // c'est la barrière qui empêche d'agir sur la clé d'un autre client.
        keysRepo.findOne.mockResolvedValue(null);

        await expect(call(service)).rejects.toBeInstanceOf(NotFoundException);

        const [args] = keysRepo.findOne.mock.calls[0] as [
          { where: { organization_id: string; revoked_at: unknown } },
        ];
        expect(args.where.organization_id).toBe(ORG_ID);
        expect(args.where.organization_id).not.toBe(OTHER_ORG_ID);
        expect(args.where.revoked_at).toBeDefined();
      },
    );

    it('liste uniquement les clés de l’organisation de l’appelant', async () => {
      keysRepo.find.mockResolvedValue([]);
      await service.list(makeScope());
      expect(keysRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organization_id: ORG_ID } }),
      );
    });
  });

  describe('recherche par secret', () => {
    it('cherche l’empreinte courante ET l’empreinte de rotation', async () => {
      keysRepo.findOne.mockResolvedValue(null);
      const secret = `${API_KEY_PREFIX}abc`;
      const hash = createHash('sha256').update(secret).digest('hex');

      await service.findBySecret(secret);

      expect(keysRepo.findOne).toHaveBeenCalledWith({
        where: [{ key_hash: hash }, { previous_key_hash: hash }],
      });
    });

    it('reconnaît un secret correspondant à l’empreinte de rotation', () => {
      const secret = `${API_KEY_PREFIX}abc`;
      const key = makeKey({
        previous_key_hash: createHash('sha256').update(secret).digest('hex'),
      });
      expect(service.matchesRotatedHash(key, secret)).toBe(true);
      expect(service.matchesRotatedHash(makeKey(), secret)).toBe(false);
    });
  });

  describe('last_used_at', () => {
    it('s’auto-limite en SQL et absorbe les erreurs (appel fire-and-forget)', async () => {
      keysRepo.query.mockRejectedValue(new Error('db down'));

      expect(() => service.touchLastUsed(KEY_ID)).not.toThrow();
      await Promise.resolve();

      const [sql] = keysRepo.query.mock.calls[0] as [string];
      expect(sql).toContain('last_used_at');
      expect(sql).toContain('interval');
    });
  });
});
