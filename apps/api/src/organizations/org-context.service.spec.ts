import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import {
  AuthProvider,
  SubscriptionTier,
  User,
  UserRole,
} from '../users/entities/user.entity';
import { Organization } from './entities/organization.entity';
import {
  OrganizationMembership,
  OrganizationRole,
} from './entities/organization-membership.entity';
import { OrgContextService } from './org-context.service';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'artisan@example.com',
    auth_provider: AuthProvider.EMAIL,
    subscription_tier: SubscriptionTier.FREE,
    role: UserRole.USER,
    email_verified: true,
    firebase_uid: 'fb-1',
    referral_code: null,
    referred_by_user_id: null,
    referral_converted_at: null,
    active_organization_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: 'org-perso',
    name: 'Mon espace',
    owner_user_id: 'user-1',
    is_personal: true,
    owner: null as never,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('OrgContextService', () => {
  let service: OrgContextService;
  const usersRepo = { findOne: jest.fn() };
  const orgsRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const membershipsRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    orgsRepo.create.mockImplementation((v: unknown) => v);
    membershipsRepo.create.mockImplementation((v: unknown) => v);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgContextService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(Organization), useValue: orgsRepo },
        {
          provide: getRepositoryToken(OrganizationMembership),
          useValue: membershipsRepo,
        },
      ],
    }).compile();

    service = module.get(OrgContextService);
  });

  describe('résolution de l’organisation active', () => {
    it('retombe sur l’espace personnel quand aucune organisation active n’est posée', async () => {
      const user = makeUser();
      orgsRepo.findOne.mockResolvedValue(makeOrg());

      const scope = await service.resolveForUser(user);

      expect(scope.organizationId).toBe('org-perso');
      expect(scope.role).toBe(OrganizationRole.OWNER);
      expect(membershipsRepo.findOne).not.toHaveBeenCalled();
    });

    it('utilise l’organisation active quand l’adhésion existe', async () => {
      const user = makeUser({ active_organization_id: 'org-employeur' });
      membershipsRepo.findOne.mockResolvedValue({
        organization_id: 'org-employeur',
        user_id: 'user-1',
        role: OrganizationRole.MEMBER,
        organization: makeOrg({
          id: 'org-employeur',
          name: 'Peinture Dupont',
          owner_user_id: 'patron-1',
          is_personal: false,
        }),
      });
      usersRepo.findOne.mockResolvedValue({
        id: 'patron-1',
        subscription_tier: SubscriptionTier.CONTRACTOR_PREMIUM,
      });

      const scope = await service.resolveForUser(user);

      expect(scope.organizationId).toBe('org-employeur');
      expect(scope.role).toBe(OrganizationRole.MEMBER);
    });

    it('retombe sur l’espace personnel quand l’adhésion a été révoquée', async () => {
      // Le pointeur `active_organization_id` survit à un retrait de membre : il
      // ne doit jamais suffire à conserver un accès.
      const user = makeUser({ active_organization_id: 'org-employeur' });
      membershipsRepo.findOne.mockResolvedValue(null);
      orgsRepo.findOne.mockResolvedValue(makeOrg());

      const scope = await service.resolveForUser(user);

      expect(scope.organizationId).toBe('org-perso');
      expect(scope.role).toBe(OrganizationRole.OWNER);
    });

    it('crée l’espace personnel à la volée pour un compte qui n’en a pas', async () => {
      const user = makeUser();
      orgsRepo.findOne.mockResolvedValueOnce(null);
      orgsRepo.save.mockResolvedValue(makeOrg({ id: 'org-neuve' }));

      const scope = await service.resolveForUser(user);

      expect(scope.organizationId).toBe('org-neuve');
      expect(membershipsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: 'org-neuve',
          user_id: 'user-1',
          role: OrganizationRole.OWNER,
        }),
      );
    });

    it('relit l’organisation gagnante quand deux requêtes concurrentes la créent', async () => {
      const user = makeUser();
      orgsRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeOrg({ id: 'org-gagnante' }));
      orgsRepo.save.mockRejectedValue(
        new QueryFailedError('insert', [], new Error('duplicate key')),
      );

      const scope = await service.resolveForUser(user);

      expect(scope.organizationId).toBe('org-gagnante');
    });
  });

  describe('palier effectif', () => {
    it('est celui de l’utilisateur dans son espace personnel', async () => {
      const user = makeUser({ subscription_tier: SubscriptionTier.PRO });
      orgsRepo.findOne.mockResolvedValue(makeOrg());

      const scope = await service.resolveForUser(user);

      expect(scope.effectiveTier).toBe(SubscriptionTier.PRO);
      expect(usersRepo.findOne).not.toHaveBeenCalled();
    });

    it('est celui du propriétaire dans l’organisation d’un employeur', async () => {
      // Cœur fonctionnel de PLAT-4 : un salarié `free` travaille avec les
      // capacités du Contractor Premium qui l'a invité.
      const user = makeUser({
        subscription_tier: SubscriptionTier.FREE,
        active_organization_id: 'org-employeur',
      });
      membershipsRepo.findOne.mockResolvedValue({
        organization_id: 'org-employeur',
        user_id: 'user-1',
        role: OrganizationRole.MEMBER,
        organization: makeOrg({
          id: 'org-employeur',
          owner_user_id: 'patron-1',
          is_personal: false,
        }),
      });
      usersRepo.findOne.mockResolvedValue({
        id: 'patron-1',
        subscription_tier: SubscriptionTier.CONTRACTOR_PREMIUM,
      });

      const scope = await service.resolveForUser(user);

      expect(scope.effectiveTier).toBe(SubscriptionTier.CONTRACTOR_PREMIUM);
    });

    it('retombe sur free si le propriétaire est introuvable (fail-closed)', async () => {
      const user = makeUser({ active_organization_id: 'org-employeur' });
      membershipsRepo.findOne.mockResolvedValue({
        organization_id: 'org-employeur',
        user_id: 'user-1',
        role: OrganizationRole.MEMBER,
        organization: makeOrg({
          id: 'org-employeur',
          owner_user_id: 'disparu',
          is_personal: false,
        }),
      });
      usersRepo.findOne.mockResolvedValue(null);

      const scope = await service.resolveForUser(user);

      expect(scope.effectiveTier).toBe(SubscriptionTier.FREE);
    });
  });
});
