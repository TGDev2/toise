import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { OrganizationRole } from '../organizations/entities/organization-membership.entity';
import type { OrgScope } from '../organizations/org-context.service';
import { SubscriptionTier, User } from '../users/entities/user.entity';
import { SsoSessionService } from '../auth/sso-session.service';
import {
  SsoConnection,
  SsoConnectionStatus,
  SsoProtocol,
} from './entities/sso-connection.entity';
import { SsoDomain } from './entities/sso-domain.entity';
import { SsoProviderProvisioner } from './sso-provider-provisioner';
import { DomainVerifier } from './domain-verifier';
import { SsoConnectionsService } from './sso-connections.service';

const ORG_ID = '00000000-0000-4000-8000-0000000000aa';
const OTHER_ORG_ID = '00000000-0000-4000-8000-0000000000dd';
const USER_ID = '00000000-0000-4000-8000-0000000000bb';

function makeScope(role: OrganizationRole, organizationId = ORG_ID): OrgScope {
  return {
    user: { id: USER_ID } as User,
    userId: USER_ID,
    organization: { id: organizationId, name: 'Acme' } as never,
    organizationId,
    role,
    effectiveTier: SubscriptionTier.ENTERPRISE,
  };
}

function makeConnection(overrides: Partial<SsoConnection> = {}): SsoConnection {
  return {
    id: 'conn-1',
    organization_id: ORG_ID,
    provider_id: 'saml.acme1a2b3c4d',
    protocol: SsoProtocol.SAML,
    display_name: 'Acme SSO',
    status: SsoConnectionStatus.ACTIVE,
    enforced: false,
    default_role: OrganizationRole.MEMBER,
    provisioning_error: null,
    created_by_user_id: null,
    organization: null as never,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeDomain(overrides: Partial<SsoDomain> = {}): SsoDomain {
  return {
    id: 'dom-1',
    sso_connection_id: 'conn-1',
    domain: 'acme.com',
    verification_token: 'a'.repeat(32),
    verified_at: null,
    connection: null as never,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

const samlDto = {
  organization_id: ORG_ID,
  protocol: SsoProtocol.SAML,
  display_name: 'Acme SSO',
  idp_entity_id: 'https://idp.acme.com/entity',
  sso_url: 'https://idp.acme.com/sso',
  x509_certificate: '-----BEGIN CERTIFICATE-----AAA-----END CERTIFICATE-----',
};

describe('SsoConnectionsService', () => {
  let service: SsoConnectionsService;
  const connectionsRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const domainsRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const provisioner = { create: jest.fn(), delete: jest.fn() };
  const domainVerifier = { hasVerificationRecord: jest.fn() };
  const ssoSession = { invalidateEnforcementCache: jest.fn() };
  const configMock = { get: jest.fn(() => 'chiffreo-test') };

  beforeEach(async () => {
    jest.clearAllMocks();
    connectionsRepo.create.mockImplementation((v: unknown) => v);
    connectionsRepo.save.mockImplementation((v: unknown) => v);
    domainsRepo.create.mockImplementation((v: unknown) => v);
    domainsRepo.save.mockImplementation((v: unknown) => v);
    domainsRepo.find.mockResolvedValue([]);
    domainsRepo.findOne.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SsoConnectionsService,
        {
          provide: getRepositoryToken(SsoConnection),
          useValue: connectionsRepo,
        },
        { provide: getRepositoryToken(SsoDomain), useValue: domainsRepo },
        { provide: SsoProviderProvisioner, useValue: provisioner },
        { provide: DomainVerifier, useValue: domainVerifier },
        { provide: ConfigService, useValue: configMock },
        { provide: SsoSessionService, useValue: ssoSession },
      ],
    }).compile();

    service = module.get(SsoConnectionsService);
  });

  describe('createConnection — ordonné pour échouer du bon côté (D12)', () => {
    it('écrit la ligne AVANT d’appeler GCIP, puis la passe active', async () => {
      // Le statut est relevé à l'instant de l'écriture : `save` rend la même
      // instance, qui sera mutée ensuite — lire `mock.calls` après coup
      // montrerait l'état final, pas celui qui a été persisté en premier.
      const statusesAtSaveTime: string[] = [];
      connectionsRepo.save.mockImplementation((c: SsoConnection) => {
        statusesAtSaveTime.push(c.status);
        return c;
      });

      const view = await service.createConnection(samlDto, USER_ID);

      expect(statusesAtSaveTime[0]).toBe(SsoConnectionStatus.PENDING);
      expect(provisioner.create).toHaveBeenCalledTimes(1);
      expect(statusesAtSaveTime[1]).toBe(SsoConnectionStatus.ACTIVE);
      expect(view.status).toBe(SsoConnectionStatus.ACTIVE);
      expect(view.provisioning_error).toBeNull();
    });

    it('émet un provider_id préfixé par le protocole et non devinable', async () => {
      const view = await service.createConnection(samlDto, USER_ID);

      expect(view.provider_id).toMatch(/^saml\.[0-9a-f]{16}$/);
      expect(view.provider_id).not.toContain('acme');
    });

    it('marque « failed » et conserve le motif quand GCIP refuse', async () => {
      provisioner.create.mockRejectedValue(
        new Error('Identity Platform is not enabled'),
      );

      const view = await service.createConnection(samlDto, USER_ID);

      expect(view.status).toBe(SsoConnectionStatus.FAILED);
      expect(view.provisioning_error).toContain('Identity Platform');
    });

    it('ne persiste jamais le certificat ni le client_secret (D5)', async () => {
      await service.createConnection(
        {
          organization_id: ORG_ID,
          protocol: SsoProtocol.OIDC,
          display_name: 'Acme OIDC',
          issuer: 'https://idp.acme.com',
          client_id: 'client-abc',
          client_secret: 'super-secret-value',
        },
        USER_ID,
      );

      const persisted = JSON.stringify(connectionsRepo.save.mock.calls);
      expect(persisted).not.toContain('super-secret-value');
      expect(persisted).not.toContain('client-abc');
    });

    it('déduit callback et entity ID du projet Firebase, sans les faire saisir', async () => {
      await service.createConnection(samlDto, USER_ID);

      const [, , , settings] = provisioner.create.mock.calls[0] as [
        string,
        SsoProtocol,
        string,
        { rp_entity_id: string; callback_url: string },
      ];
      expect(settings.rp_entity_id).toBe('chiffreo-test.firebaseapp.com');
      expect(settings.callback_url).toBe(
        'https://chiffreo-test.firebaseapp.com/__/auth/handler',
      );
    });

    it('refuse une seconde connexion sur la même organisation', async () => {
      connectionsRepo.save.mockRejectedValueOnce(
        new QueryFailedError(
          'insert',
          [],
          new Error('unique constraint "UQ_sso_connections_organization"'),
        ),
      );

      await expect(
        service.createConnection(samlDto, USER_ID),
      ).rejects.toMatchObject({
        response: { error: 'SSO_CONNECTION_EXISTS' },
      });
    });
  });

  describe('deleteConnection', () => {
    it('supprime chez GCIP avant la ligne', async () => {
      connectionsRepo.findOne.mockResolvedValue(makeConnection());

      await service.deleteConnection('conn-1');

      expect(provisioner.delete).toHaveBeenCalledWith('saml.acme1a2b3c4d');
      expect(connectionsRepo.delete).toHaveBeenCalledWith({ id: 'conn-1' });
    });

    it('conserve la ligne si GCIP refuse — pas de fournisseur orphelin non tracé', async () => {
      connectionsRepo.findOne.mockResolvedValue(makeConnection());
      provisioner.delete.mockRejectedValue(new Error('permission denied'));

      await expect(service.deleteConnection('conn-1')).rejects.toMatchObject({
        response: { error: 'SSO_PROVIDER_DELETION_FAILED' },
      });
      expect(connectionsRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('enforcement', () => {
    it('refuse l’enforcement sur une connexion non opérationnelle', async () => {
      connectionsRepo.findOne.mockResolvedValue(
        makeConnection({ status: SsoConnectionStatus.FAILED }),
      );

      await expect(
        service.updateForOrganization(makeScope(OrganizationRole.OWNER), {
          enforced: true,
        }),
      ).rejects.toMatchObject({
        response: { error: 'SSO_CONNECTION_NOT_ACTIVE' },
      });
    });

    it('invalide le cache du guard pour que la bascule prenne effet tout de suite', async () => {
      connectionsRepo.findOne.mockResolvedValue(makeConnection());

      await service.updateForOrganization(makeScope(OrganizationRole.OWNER), {
        enforced: true,
      });

      expect(ssoSession.invalidateEnforcementCache).toHaveBeenCalled();
    });

    it('refuse à un membre simple de toucher à la politique SSO', async () => {
      await expect(
        service.updateForOrganization(makeScope(OrganizationRole.MEMBER), {
          enforced: true,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('addDomain', () => {
    it('normalise le domaine et rend l’enregistrement TXT attendu', async () => {
      connectionsRepo.findOne.mockResolvedValue(makeConnection());

      const view = await service.addDomain(makeScope(OrganizationRole.ADMIN), {
        domain: '  ACME.COM  ',
      });

      expect(view.domain).toBe('acme.com');
      expect(view.verified).toBe(false);
      expect(view.expected_dns_record).toMatch(
        /^chiffreo-verification=[0-9a-f]{32}$/,
      );
    });

    it('refuse un domaine de messagerie grand public', async () => {
      connectionsRepo.findOne.mockResolvedValue(makeConnection());

      await expect(
        service.addDomain(makeScope(OrganizationRole.OWNER), {
          domain: 'gmail.com',
        }),
      ).rejects.toMatchObject({
        response: { error: 'PUBLIC_EMAIL_DOMAIN_REFUSED' },
      });
    });

    it('refuse un domaine syntaxiquement inexploitable', async () => {
      connectionsRepo.findOne.mockResolvedValue(makeConnection());

      await expect(
        service.addDomain(makeScope(OrganizationRole.OWNER), { domain: 'fr' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuse un domaine déjà vérifié ailleurs', async () => {
      connectionsRepo.findOne.mockResolvedValue(makeConnection());
      domainsRepo.findOne.mockResolvedValueOnce(
        makeDomain({
          sso_connection_id: 'conn-autre',
          verified_at: new Date(),
        }),
      );

      await expect(
        service.addDomain(makeScope(OrganizationRole.OWNER), {
          domain: 'acme.com',
        }),
      ).rejects.toMatchObject({
        response: { error: 'DOMAIN_ALREADY_VERIFIED' },
      });
    });

    it('est idempotent sur un domaine déjà déclaré', async () => {
      connectionsRepo.findOne.mockResolvedValue(makeConnection());
      domainsRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeDomain());

      const view = await service.addDomain(makeScope(OrganizationRole.OWNER), {
        domain: 'acme.com',
      });

      expect(view.id).toBe('dom-1');
      expect(domainsRepo.save).not.toHaveBeenCalled();
    });

    it('refuse à un membre simple d’ajouter un domaine', async () => {
      await expect(
        service.addDomain(makeScope(OrganizationRole.MEMBER), {
          domain: 'acme.com',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('verifyDomain', () => {
    it('marque vérifié quand le TXT est publié', async () => {
      connectionsRepo.findOne.mockResolvedValue(makeConnection());
      domainsRepo.findOne.mockResolvedValue(makeDomain());
      domainVerifier.hasVerificationRecord.mockResolvedValue(true);

      const view = await service.verifyDomain(
        makeScope(OrganizationRole.OWNER),
        'dom-1',
      );

      expect(view.verified).toBe(true);
      expect(view.expected_dns_record).toBeNull();
    });

    it('reste rejouable quand le TXT n’est pas encore propagé', async () => {
      connectionsRepo.findOne.mockResolvedValue(makeConnection());
      domainsRepo.findOne.mockResolvedValue(makeDomain());
      domainVerifier.hasVerificationRecord.mockResolvedValue(false);

      await expect(
        service.verifyDomain(makeScope(OrganizationRole.OWNER), 'dom-1'),
      ).rejects.toMatchObject({
        response: { error: 'SSO_DOMAIN_NOT_VERIFIED' },
      });
      // Le jeton n'est pas regénéré : l'enregistrement déjà publié reste valable.
      expect(domainsRepo.save).not.toHaveBeenCalled();
    });

    it('filtre par connexion — un id deviné ne suffit pas (anti-IDOR)', async () => {
      connectionsRepo.findOne.mockResolvedValue(makeConnection());
      domainsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.verifyDomain(makeScope(OrganizationRole.OWNER), 'dom-autre'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(domainsRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'dom-autre', sso_connection_id: 'conn-1' },
      });
    });

    it('traduit la course sur l’index partiel en conflit lisible', async () => {
      connectionsRepo.findOne.mockResolvedValue(makeConnection());
      domainsRepo.findOne.mockResolvedValue(makeDomain());
      domainVerifier.hasVerificationRecord.mockResolvedValue(true);
      domainsRepo.save.mockRejectedValue(
        new QueryFailedError(
          'update',
          [],
          new Error('unique constraint "UQ_sso_domains_verified"'),
        ),
      );

      await expect(
        service.verifyDomain(makeScope(OrganizationRole.OWNER), 'dom-1'),
      ).rejects.toMatchObject({
        response: { error: 'DOMAIN_ALREADY_VERIFIED' },
      });
    });
  });

  describe('removeDomain', () => {
    it('supprime en filtrant sur la connexion de l’appelant', async () => {
      connectionsRepo.findOne.mockResolvedValue(makeConnection());
      domainsRepo.delete.mockResolvedValue({ affected: 1 });

      await service.removeDomain(makeScope(OrganizationRole.OWNER), 'dom-1');

      expect(domainsRepo.delete).toHaveBeenCalledWith({
        id: 'dom-1',
        sso_connection_id: 'conn-1',
      });
    });

    it('rend 404 quand rien n’a été supprimé', async () => {
      connectionsRepo.findOne.mockResolvedValue(makeConnection());
      domainsRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(
        service.removeDomain(makeScope(OrganizationRole.OWNER), 'dom-x'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findForOrganization', () => {
    it('ne lit que la connexion de l’organisation de la portée', async () => {
      connectionsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findForOrganization(OTHER_ORG_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(connectionsRepo.findOne).toHaveBeenCalledWith({
        where: { organization_id: OTHER_ORG_ID },
      });
    });
  });

  describe('discoverByDomain (D13)', () => {
    it('n’expose que le fournisseur et le protocole', async () => {
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          provider_id: 'saml.acme1a2b3c4d',
          protocol: SsoProtocol.SAML,
        }),
      };
      domainsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.discoverByDomain('acme.com');

      expect(result).toEqual({
        provider_id: 'saml.acme1a2b3c4d',
        protocol: SsoProtocol.SAML,
      });
      // Domaines non vérifiés et connexions inactives exclus en SQL.
      expect(qb.andWhere).toHaveBeenCalledWith('d.verified_at IS NOT NULL');
      expect(qb.andWhere).toHaveBeenCalledWith('c.status = :status', {
        status: SsoConnectionStatus.ACTIVE,
      });
    });
  });
});
