import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { OrganizationRole } from '../organizations/entities/organization-membership.entity';
import type { OrgScope } from '../organizations/org-context.service';
import { SubscriptionTier } from '../users/entities/user.entity';
import { EstimationsService } from '../estimations/estimations.service';
import { WidgetConfig } from './entities/widget-config.entity';
import { WIDGET_KEY_PREFIX, WidgetService } from './widget.service';

const ORG_ID = '00000000-0000-4000-8000-0000000000aa';
const CONFIG_ID = '00000000-0000-4000-8000-00000000000c';

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

function makeConfig(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
  return {
    id: CONFIG_ID,
    organization_id: ORG_ID,
    widget_key: 'wgt_existant',
    allowed_origins: [],
    enabled: true,
    display_name: null,
    accent_color: null,
    organization: null as never,
    created_at: new Date('2026-08-01T10:00:00Z'),
    updated_at: new Date('2026-08-01T10:00:00Z'),
    ...overrides,
  };
}

describe('WidgetService', () => {
  let service: WidgetService;

  const widgetConfigsRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const estimationsService = {
    estimatePublicMulti: jest.fn(),
    listWorkTypes: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    widgetConfigsRepo.create.mockImplementation((v: unknown) => v);
    widgetConfigsRepo.save.mockImplementation((v: unknown) =>
      Promise.resolve(makeConfig(v as Partial<WidgetConfig>)),
    );
    widgetConfigsRepo.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WidgetService,
        {
          provide: getRepositoryToken(WidgetConfig),
          useValue: widgetConfigsRepo,
        },
        { provide: EstimationsService, useValue: estimationsService },
      ],
    }).compile();

    service = module.get(WidgetService);
  });

  describe('getOrCreate', () => {
    it('crée une configuration avec une clé wgt_ et aucune origine si aucune n’existe', async () => {
      widgetConfigsRepo.findOne.mockResolvedValue(null);

      const view = await service.getOrCreate(makeScope());

      const [saved] = widgetConfigsRepo.save.mock.calls[0] as [
        Partial<WidgetConfig>,
      ];
      expect(saved.organization_id).toBe(ORG_ID);
      expect(saved.widget_key!.startsWith(WIDGET_KEY_PREFIX)).toBe(true);
      expect(saved.allowed_origins).toEqual([]);
      expect(view.widget_key).toBe(saved.widget_key);
    });

    it('renvoie la configuration existante sans en recréer une', async () => {
      widgetConfigsRepo.findOne.mockResolvedValue(makeConfig());
      const view = await service.getOrCreate(makeScope());
      expect(view.widget_key).toBe('wgt_existant');
      expect(widgetConfigsRepo.save).not.toHaveBeenCalled();
    });

    it('relit la ligne gagnante si deux créations concurrentes se percutent', async () => {
      widgetConfigsRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeConfig());
      widgetConfigsRepo.save.mockRejectedValueOnce(
        new QueryFailedError('insert', [], new Error('duplicate key')),
      );

      const view = await service.getOrCreate(makeScope());
      expect(view.widget_key).toBe('wgt_existant');
    });

    it('refuse à un membre simple', async () => {
      await expect(
        service.getOrCreate(makeScope(OrganizationRole.MEMBER)),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(widgetConfigsRepo.findOne).not.toHaveBeenCalled();
    });

    it('accepte un administrateur', async () => {
      widgetConfigsRepo.findOne.mockResolvedValue(makeConfig());
      await expect(
        service.getOrCreate(makeScope(OrganizationRole.ADMIN)),
      ).resolves.toBeDefined();
    });
  });

  describe('update', () => {
    it('ne modifie que les champs fournis', async () => {
      widgetConfigsRepo.findOne.mockResolvedValue(
        makeConfig({ display_name: 'Ancien nom' }),
      );

      await service.update(makeScope(), {
        allowed_origins: ['https://exemple.fr'],
      });

      const [saved] = widgetConfigsRepo.save.mock.calls[0] as [WidgetConfig];
      expect(saved.allowed_origins).toEqual(['https://exemple.fr']);
      expect(saved.display_name).toBe('Ancien nom');
    });
  });

  describe('regenerateKey', () => {
    it('remplace la clé immédiatement, sans fenêtre de grâce', async () => {
      widgetConfigsRepo.findOne.mockResolvedValue(
        makeConfig({ widget_key: 'wgt_ancienne' }),
      );

      const view = await service.regenerateKey(makeScope());

      const [saved] = widgetConfigsRepo.save.mock.calls[0] as [WidgetConfig];
      expect(saved.widget_key).not.toBe('wgt_ancienne');
      expect(saved.widget_key.startsWith(WIDGET_KEY_PREFIX)).toBe(true);
      expect(view.widget_key).toBe(saved.widget_key);
    });
  });

  describe('findActiveByKey', () => {
    it('cherche par widget_key', async () => {
      widgetConfigsRepo.findOne.mockResolvedValue(makeConfig());
      await service.findActiveByKey('wgt_existant');
      expect(widgetConfigsRepo.findOne).toHaveBeenCalledWith({
        where: { widget_key: 'wgt_existant' },
      });
    });
  });

  describe('isOriginAllowedForCors', () => {
    it('autorise une origine présente dans une configuration active', async () => {
      widgetConfigsRepo.find.mockResolvedValue([
        makeConfig({ allowed_origins: ['https://exemple.fr'] }),
      ]);
      await expect(
        service.isOriginAllowedForCors('https://exemple.fr'),
      ).resolves.toBe(true);
    });

    it('refuse une origine absente de toute configuration active', async () => {
      widgetConfigsRepo.find.mockResolvedValue([
        makeConfig({ allowed_origins: ['https://exemple.fr'] }),
      ]);
      await expect(
        service.isOriginAllowedForCors('https://autre-site.fr'),
      ).resolves.toBe(false);
    });

    it('ne relit la base qu’une seule fois pour deux appels rapprochés (cache)', async () => {
      widgetConfigsRepo.find.mockResolvedValue([]);
      await service.isOriginAllowedForCors('https://exemple.fr');
      await service.isOriginAllowedForCors('https://exemple.fr');
      expect(widgetConfigsRepo.find).toHaveBeenCalledTimes(1);
    });

    it('invalide le cache après une mise à jour', async () => {
      widgetConfigsRepo.findOne.mockResolvedValue(makeConfig());
      widgetConfigsRepo.find.mockResolvedValue([]);

      await service.isOriginAllowedForCors('https://exemple.fr');
      await service.update(makeScope(), {
        allowed_origins: ['https://exemple.fr'],
      });
      widgetConfigsRepo.find.mockResolvedValue([
        makeConfig({ allowed_origins: ['https://exemple.fr'] }),
      ]);

      await expect(
        service.isOriginAllowedForCors('https://exemple.fr'),
      ).resolves.toBe(true);
      expect(widgetConfigsRepo.find).toHaveBeenCalledTimes(2);
    });
  });

  describe('publicConfig', () => {
    it('n’expose que les champs de marque, jamais allowed_origins', () => {
      const view = service.publicConfig(
        makeConfig({
          display_name: 'Bricolage Dupont',
          accent_color: '#0369a1',
        }),
      );
      expect(view).toEqual({
        display_name: 'Bricolage Dupont',
        accent_color: '#0369a1',
        powered_by: 'Chiffréo',
      });
    });
  });

  describe('délégation à EstimationsService', () => {
    it('estimate() délègue à estimatePublicMulti', async () => {
      estimationsService.estimatePublicMulti.mockResolvedValue({
        rooms_count: 1,
      });
      const dto = { rooms: [] } as never;
      await service.estimate(dto);
      expect(estimationsService.estimatePublicMulti).toHaveBeenCalledWith(dto);
    });

    it('listWorkTypes() délègue à listWorkTypes', async () => {
      estimationsService.listWorkTypes.mockResolvedValue([]);
      await service.listWorkTypes();
      expect(estimationsService.listWorkTypes).toHaveBeenCalled();
    });
  });
});
