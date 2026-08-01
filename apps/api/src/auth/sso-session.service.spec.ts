import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  AuthProvider,
  SubscriptionTier,
  User,
  UserRole,
} from '../users/entities/user.entity';
import {
  OrganizationMembership,
  OrganizationRole,
} from '../organizations/entities/organization-membership.entity';
import {
  SsoConnection,
  SsoConnectionStatus,
  SsoProtocol,
} from '../enterprise/entities/sso-connection.entity';
import { SsoSessionService } from './sso-session.service';

const ORG_ID = '00000000-0000-4000-8000-0000000000aa';
const OWNER_ID = '00000000-0000-4000-8000-0000000000bb';
const MEMBER_ID = '00000000-0000-4000-8000-0000000000cc';
const PROVIDER_ID = 'saml.acme1a2b3c4d';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: MEMBER_ID,
    email: 'salarie@acme.com',
    auth_provider: AuthProvider.SSO,
    subscription_tier: SubscriptionTier.FREE,
    role: UserRole.USER,
    email_verified: true,
    firebase_uid: 'fb-member',
    referral_code: null,
    referred_by_user_id: null,
    referral_converted_at: null,
    active_organization_id: ORG_ID,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeConnection(overrides: Partial<SsoConnection> = {}): SsoConnection {
  return {
    id: 'conn-1',
    organization_id: ORG_ID,
    provider_id: PROVIDER_ID,
    protocol: SsoProtocol.SAML,
    display_name: 'Acme SSO',
    status: SsoConnectionStatus.ACTIVE,
    enforced: true,
    default_role: OrganizationRole.MEMBER,
    provisioning_error: null,
    created_by_user_id: null,
    organization: {
      id: ORG_ID,
      name: 'Acme',
      owner_user_id: OWNER_ID,
      is_personal: false,
      owner: null as never,
      created_at: new Date(),
      updated_at: new Date(),
    },
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeToken(signInProvider: string, uid = 'fb-member'): DecodedIdToken {
  return {
    aud: 'chiffreo-test',
    auth_time: 0,
    exp: 0,
    iat: 0,
    iss: 'https://securetoken.google.com/chiffreo-test',
    uid,
    sub: uid,
    firebase: { identities: {}, sign_in_provider: signInProvider },
  } as DecodedIdToken;
}

describe('SsoSessionService', () => {
  let service: SsoSessionService;
  const connectionsRepo = { findOne: jest.fn(), count: jest.fn() };
  const membershipsRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const usersRepo = { findOne: jest.fn(), update: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    membershipsRepo.create.mockImplementation((v: unknown) => v);
    // Par défaut, au moins une organisation est en enforcement : sans quoi le
    // chemin rapide court-circuiterait tous les cas ci-dessous.
    connectionsRepo.count.mockResolvedValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SsoSessionService,
        {
          provide: getRepositoryToken(SsoConnection),
          useValue: connectionsRepo,
        },
        {
          provide: getRepositoryToken(OrganizationMembership),
          useValue: membershipsRepo,
        },
        { provide: getRepositoryToken(User), useValue: usersRepo },
      ],
    }).compile();

    service = module.get(SsoSessionService);
  });

  describe('isSsoProvider', () => {
    it.each(['saml.acme', 'oidc.acme'])('reconnaît %s', (provider) => {
      expect(SsoSessionService.isSsoProvider(provider)).toBe(true);
    });

    it.each(['password', 'google.com', 'apple.com', 'anonymous', undefined])(
      'ne reconnaît pas %s',
      (provider) => {
        expect(SsoSessionService.isSsoProvider(provider)).toBe(false);
      },
    );
  });

  describe('provisionFromSsoLogin — rattachement JIT (D6)', () => {
    it('crée l’adhésion manquante avec le rôle par défaut de la connexion', async () => {
      const user = makeUser({ active_organization_id: null });
      connectionsRepo.findOne.mockResolvedValue(
        makeConnection({ default_role: OrganizationRole.ADMIN }),
      );
      membershipsRepo.findOne.mockResolvedValue(null);

      await service.provisionFromSsoLogin(user, PROVIDER_ID);

      const [saved] = membershipsRepo.save.mock.calls[0] as [
        Partial<OrganizationMembership>,
      ];
      expect(saved).toMatchObject({
        organization_id: ORG_ID,
        user_id: MEMBER_ID,
        role: OrganizationRole.ADMIN,
      });
      expect(usersRepo.update).toHaveBeenCalledWith(MEMBER_ID, {
        active_organization_id: ORG_ID,
      });
      expect(user.active_organization_id).toBe(ORG_ID);
    });

    it('ne touche pas une adhésion existante — le propriétaire ne doit pas être rétrogradé', async () => {
      const owner = makeUser({ id: OWNER_ID, active_organization_id: ORG_ID });
      connectionsRepo.findOne.mockResolvedValue(makeConnection());
      membershipsRepo.findOne.mockResolvedValue({
        organization_id: ORG_ID,
        user_id: OWNER_ID,
        role: OrganizationRole.OWNER,
      });

      await service.provisionFromSsoLogin(owner, PROVIDER_ID);

      expect(membershipsRepo.save).not.toHaveBeenCalled();
      expect(usersRepo.update).not.toHaveBeenCalled();
    });

    it('ne rattache rien si le fournisseur est inconnu ou inactif (fail-closed)', async () => {
      const user = makeUser({ active_organization_id: null });
      connectionsRepo.findOne.mockResolvedValue(null);

      await service.provisionFromSsoLogin(user, 'saml.inconnu');

      expect(membershipsRepo.save).not.toHaveBeenCalled();
      expect(usersRepo.update).not.toHaveBeenCalled();
      expect(user.active_organization_id).toBeNull();
    });

    it('ne cherche que les connexions actives', async () => {
      connectionsRepo.findOne.mockResolvedValue(null);

      await service.provisionFromSsoLogin(makeUser(), PROVIDER_ID);

      expect(connectionsRepo.findOne).toHaveBeenCalledWith({
        where: {
          provider_id: PROVIDER_ID,
          status: SsoConnectionStatus.ACTIVE,
        },
      });
    });

    it('absorbe la course sur l’index unique d’adhésion', async () => {
      connectionsRepo.findOne.mockResolvedValue(makeConnection());
      membershipsRepo.findOne.mockResolvedValue(null);
      membershipsRepo.save.mockRejectedValue(
        new QueryFailedError(
          'insert',
          [],
          new Error('UQ_organization_memberships'),
        ),
      );

      await expect(
        service.provisionFromSsoLogin(makeUser(), PROVIDER_ID),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertSessionAllowed — enforcement (D8, D9, D10)', () => {
    it('ne fait aucune requête tant qu’aucune connexion n’est en enforcement', async () => {
      connectionsRepo.count.mockResolvedValue(0);

      await service.assertSessionAllowed(makeToken('password'));

      expect(usersRepo.findOne).not.toHaveBeenCalled();
      expect(connectionsRepo.findOne).not.toHaveBeenCalled();
    });

    it('laisse passer une session issue du fournisseur exigé', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: MEMBER_ID,
        active_organization_id: ORG_ID,
      });
      connectionsRepo.findOne.mockResolvedValue(makeConnection());
      membershipsRepo.findOne.mockResolvedValue({
        role: OrganizationRole.MEMBER,
      });

      await expect(
        service.assertSessionAllowed(makeToken(PROVIDER_ID)),
      ).resolves.toBeUndefined();
    });

    it('refuse une session mot de passe avec un motif exploitable', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: MEMBER_ID,
        active_organization_id: ORG_ID,
      });
      connectionsRepo.findOne.mockResolvedValue(makeConnection());
      membershipsRepo.findOne.mockResolvedValue({
        role: OrganizationRole.MEMBER,
      });

      await expect(
        service.assertSessionAllowed(makeToken('password')),
      ).rejects.toMatchObject({
        response: {
          error: 'SSO_REQUIRED',
          provider_id: PROVIDER_ID,
          protocol: SsoProtocol.SAML,
        },
      });
    });

    it('refuse une session issue du fournisseur d’une AUTRE organisation', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: MEMBER_ID,
        active_organization_id: ORG_ID,
      });
      connectionsRepo.findOne.mockResolvedValue(makeConnection());
      membershipsRepo.findOne.mockResolvedValue({
        role: OrganizationRole.MEMBER,
      });

      await expect(
        service.assertSessionAllowed(makeToken('saml.concurrent')),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('exempte le propriétaire — bris de glace contre un IdP mal configuré (D9)', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: OWNER_ID,
        active_organization_id: ORG_ID,
      });
      connectionsRepo.findOne.mockResolvedValue(makeConnection());
      membershipsRepo.findOne.mockResolvedValue({
        role: OrganizationRole.OWNER,
      });

      await expect(
        service.assertSessionAllowed(makeToken('password', 'fb-owner')),
      ).resolves.toBeUndefined();
    });

    it('n’enferme personne dans son espace personnel', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: MEMBER_ID,
        active_organization_id: null,
      });

      await expect(
        service.assertSessionAllowed(makeToken('password')),
      ).resolves.toBeUndefined();
      expect(connectionsRepo.findOne).not.toHaveBeenCalled();
    });

    it('n’enferme pas au nom d’une organisation quittée (adhésion révoquée)', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: MEMBER_ID,
        active_organization_id: ORG_ID,
      });
      connectionsRepo.findOne.mockResolvedValue(makeConnection());
      membershipsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.assertSessionAllowed(makeToken('password')),
      ).resolves.toBeUndefined();
    });

    it('laisse passer un compte pas encore synchronisé', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.assertSessionAllowed(makeToken('saml.acme')),
      ).resolves.toBeUndefined();
    });

    it('ne considère que les connexions actives ET en enforcement', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: MEMBER_ID,
        active_organization_id: ORG_ID,
      });
      connectionsRepo.findOne.mockResolvedValue(null);

      await service.assertSessionAllowed(makeToken('password'));

      expect(connectionsRepo.findOne).toHaveBeenCalledWith({
        where: {
          organization_id: ORG_ID,
          enforced: true,
          status: SsoConnectionStatus.ACTIVE,
        },
        relations: ['organization'],
      });
    });
  });

  describe('cache du chemin rapide', () => {
    it('ne recompte pas à chaque requête', async () => {
      connectionsRepo.count.mockResolvedValue(0);

      await service.assertSessionAllowed(makeToken('password'));
      await service.assertSessionAllowed(makeToken('password'));

      expect(connectionsRepo.count).toHaveBeenCalledTimes(1);
    });

    it('recompte immédiatement après une invalidation explicite', async () => {
      connectionsRepo.count.mockResolvedValue(0);
      await service.assertSessionAllowed(makeToken('password'));

      service.invalidateEnforcementCache();
      await service.assertSessionAllowed(makeToken('password'));

      expect(connectionsRepo.count).toHaveBeenCalledTimes(2);
    });
  });
});
