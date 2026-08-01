import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { EnterpriseController } from '../src/enterprise/enterprise.controller';
import { AdminEnterpriseController } from '../src/enterprise/admin-enterprise.controller';
import { SsoDiscoveryController } from '../src/enterprise/sso-discovery.controller';
import { EnterpriseAgreementsService } from '../src/enterprise/enterprise-agreements.service';
import { SsoConnectionsService } from '../src/enterprise/sso-connections.service';
import { SsoProtocol } from '../src/enterprise/entities/sso-connection.entity';
import { FeatureGateGuard } from '../src/feature-gates/guards/feature-gate.guard';
import { FeatureGatesService } from '../src/feature-gates/feature-gates.service';
import { OrgContextService } from '../src/organizations/org-context.service';
import { FirebaseAuthGuard } from '../src/auth/guards/firebase-auth.guard';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { SubscriptionTier } from '../src/users/entities/user.entity';
import { OrganizationRole } from '../src/organizations/entities/organization-membership.entity';

const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
const mockFirebaseUid = 'firebase-uid-123';
const mockOrgId = '00000000-0000-4000-8000-0000000000aa';
const mockAgreementId = '00000000-0000-4000-8000-0000000000cc';
const mockDomainId = '00000000-0000-4000-8000-0000000000dd';
const mockConnectionId = '00000000-0000-4000-8000-0000000000ee';

const agreementView = {
  id: mockAgreementId,
  status: 'active',
  starts_at: new Date('2026-01-01'),
  ends_at: new Date('2026-12-31'),
  is_current: true,
  days_until_expiry: 151,
  annual_amount_cents: 1_200_000,
  currency: 'EUR',
  quote_reference: 'DEV-2026-014',
  purchase_order_reference: null,
  billing_contact_email: 'compta@acme.com',
  sla: {
    uptime_target: 99.9,
    support_response_hours: 4,
    support_email: 'support@chiffreo.fr',
  },
  dedicated_environment: false,
  dedicated_environment_region: null,
};

const connectionView = {
  id: mockConnectionId,
  provider_id: 'saml.acme1a2b3c4d',
  protocol: SsoProtocol.SAML,
  display_name: 'Acme SSO',
  status: 'active',
  enforced: false,
  default_role: OrganizationRole.MEMBER,
  provisioning_error: null,
  domains: [],
  created_at: new Date(),
};

const agreementsServiceMock = {
  create: jest.fn(),
  update: jest.fn(),
  terminate: jest.fn(),
  listForAdmin: jest.fn(),
  findCurrentForOrganization: jest.fn(),
  toView: jest.fn(),
};

const ssoConnectionsServiceMock = {
  createConnection: jest.fn(),
  listConnections: jest.fn(),
  deleteConnection: jest.fn(),
  findForOrganization: jest.fn(),
  updateForOrganization: jest.fn(),
  addDomain: jest.fn(),
  verifyDomain: jest.fn(),
  removeDomain: jest.fn(),
  discoverByDomain: jest.fn(),
};

const orgContextMock = { resolveForFirebaseUid: jest.fn() };
const featureGatesServiceMock = {
  isFeatureAllowed: jest.fn(),
  getGateConfig: jest.fn(),
};

const validSamlBody = {
  organization_id: mockOrgId,
  protocol: 'saml',
  display_name: 'Acme SSO',
  idp_entity_id: 'https://idp.acme.com/entity',
  sso_url: 'https://idp.acme.com/sso',
  x509_certificate: '-----BEGIN CERTIFICATE-----AAA-----END CERTIFICATE-----',
};

const validAgreementBody = {
  organization_id: mockOrgId,
  starts_at: '2026-09-01T00:00:00.000Z',
  ends_at: '2027-08-31T00:00:00.000Z',
  annual_amount_cents: 1_200_000,
  quote_reference: 'DEV-2026-014',
  billing_contact_email: 'compta@acme.com',
};

describe('Offre Enterprise (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    jest.clearAllMocks();

    agreementsServiceMock.findCurrentForOrganization.mockResolvedValue({
      id: mockAgreementId,
      organization_id: mockOrgId,
      notes: null,
    });
    agreementsServiceMock.toView.mockReturnValue(agreementView);
    agreementsServiceMock.create.mockResolvedValue({
      id: mockAgreementId,
      organization_id: mockOrgId,
    });
    agreementsServiceMock.update.mockResolvedValue({
      id: mockAgreementId,
      organization_id: mockOrgId,
    });
    agreementsServiceMock.terminate.mockResolvedValue({
      id: mockAgreementId,
      organization_id: mockOrgId,
    });
    agreementsServiceMock.listForAdmin.mockResolvedValue([]);

    ssoConnectionsServiceMock.findForOrganization.mockResolvedValue(
      connectionView,
    );
    ssoConnectionsServiceMock.updateForOrganization.mockResolvedValue({
      ...connectionView,
      enforced: true,
    });
    ssoConnectionsServiceMock.createConnection.mockResolvedValue(
      connectionView,
    );
    ssoConnectionsServiceMock.listConnections.mockResolvedValue([
      connectionView,
    ]);
    ssoConnectionsServiceMock.deleteConnection.mockResolvedValue(undefined);
    ssoConnectionsServiceMock.addDomain.mockResolvedValue({
      id: mockDomainId,
      domain: 'acme.com',
      verified: false,
      verified_at: null,
      expected_dns_record: `chiffreo-verification=${'a'.repeat(32)}`,
    });
    ssoConnectionsServiceMock.verifyDomain.mockResolvedValue({
      id: mockDomainId,
      domain: 'acme.com',
      verified: true,
      verified_at: new Date(),
      expected_dns_record: null,
    });
    ssoConnectionsServiceMock.removeDomain.mockResolvedValue(undefined);
    ssoConnectionsServiceMock.discoverByDomain.mockResolvedValue({
      provider_id: 'saml.acme1a2b3c4d',
      protocol: SsoProtocol.SAML,
    });

    orgContextMock.resolveForFirebaseUid.mockResolvedValue({
      user: { id: mockUserId, subscription_tier: SubscriptionTier.FREE },
      userId: mockUserId,
      organization: { id: mockOrgId, name: 'Acme', is_personal: false },
      organizationId: mockOrgId,
      role: OrganizationRole.OWNER,
      effectiveTier: SubscriptionTier.ENTERPRISE,
    });

    featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(true);
    featureGatesServiceMock.getGateConfig.mockResolvedValue({
      feature_key: 'enterprise_sso',
      min_tier: SubscriptionTier.ENTERPRISE,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        EnterpriseController,
        AdminEnterpriseController,
        SsoDiscoveryController,
      ],
      providers: [
        // `FeatureGateGuard` est laissé RÉEL : c'est lui qui prouve que la
        // surface SSO est bien réservée au palier Enterprise.
        FeatureGateGuard,
        {
          provide: EnterpriseAgreementsService,
          useValue: agreementsServiceMock,
        },
        { provide: SsoConnectionsService, useValue: ssoConnectionsServiceMock },
        { provide: OrgContextService, useValue: orgContextMock },
        { provide: FeatureGatesService, useValue: featureGatesServiceMock },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext): boolean {
          const req = context.switchToHttp().getRequest<{
            firebaseUser?: { uid: string };
          }>();
          req.firebaseUser = { uid: mockFirebaseUid };
          return true;
        },
      } satisfies CanActivate)
      .overrideGuard(AdminGuard)
      .useValue({
        canActivate(context: ExecutionContext): boolean {
          const req = context
            .switchToHttp()
            .getRequest<{ appUser?: { id: string } }>();
          req.appUser = { id: mockUserId };
          return true;
        },
      } satisfies CanActivate)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  // ---------------------------------------------------------------------------

  describe('GET /sso/discover — flux SP-initiated (PLAT-6 D13)', () => {
    it('rend le fournisseur et rien d’autre', async () => {
      const res = await request(app.getHttpServer())
        .get('/sso/discover')
        .query({ email: 'salarie@acme.com' })
        .expect(200);

      expect(res.body).toEqual({
        provider_id: 'saml.acme1a2b3c4d',
        protocol: 'saml',
      });
      expect(ssoConnectionsServiceMock.discoverByDomain).toHaveBeenCalledWith(
        'acme.com',
      );
    });

    it('n’expose ni nom d’organisation ni état de contrat', async () => {
      const res = await request(app.getHttpServer())
        .get('/sso/discover')
        .query({ email: 'salarie@acme.com' })
        .expect(200);

      expect(Object.keys(res.body as object).sort()).toEqual([
        'protocol',
        'provider_id',
      ]);
    });

    it('rend 404 pour un domaine sans SSO — même réponse qu’un domaine inconnu', async () => {
      ssoConnectionsServiceMock.discoverByDomain.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/sso/discover')
        .query({ email: 'jean@sans-sso.fr' })
        .expect(404);
    });

    it.each([
      ['sans paramètre', {}],
      ['adresse vide', { email: '' }],
      ['adresse sans arobase', { email: 'pasunemail' }],
      ['domaine inexploitable', { email: 'jean@fr' }],
    ])('rend 400 %s', async (_label, query) => {
      await request(app.getHttpServer())
        .get('/sso/discover')
        .query(query)
        .expect(400);
    });
  });

  describe('GET /enterprise/agreement', () => {
    it('rend le contrat courant de l’organisation résolue côté serveur', async () => {
      const res = await request(app.getHttpServer())
        .get('/enterprise/agreement')
        .expect(200);

      expect(res.body).toMatchObject({
        quote_reference: 'DEV-2026-014',
        is_current: true,
        sla: { uptime_target: 99.9, support_response_hours: 4 },
      });
      expect(
        agreementsServiceMock.findCurrentForOrganization,
      ).toHaveBeenCalledWith(mockOrgId);
    });

    it('rend 404 — et non 403 — quand il n’y a pas de contrat', async () => {
      // Une organisation dont le contrat vient d'expirer doit pouvoir constater
      // pourquoi elle a perdu ses capacités.
      agreementsServiceMock.findCurrentForOrganization.mockRejectedValue(
        new NotFoundException(
          'Aucun contrat Enterprise pour cette organisation',
        ),
      );

      await request(app.getHttpServer())
        .get('/enterprise/agreement')
        .expect(404);
    });
  });

  describe('Surface SSO de l’organisation — gate enterprise_sso', () => {
    it('rend la connexion au palier Enterprise', async () => {
      const res = await request(app.getHttpServer())
        .get('/enterprise/sso/connection')
        .expect(200);

      expect(res.body).toMatchObject({ provider_id: 'saml.acme1a2b3c4d' });
    });

    it('refuse la surface SSO à un palier inférieur', async () => {
      featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(false);
      orgContextMock.resolveForFirebaseUid.mockResolvedValue({
        user: { id: mockUserId },
        userId: mockUserId,
        organization: { id: mockOrgId, name: 'Acme', is_personal: false },
        organizationId: mockOrgId,
        role: OrganizationRole.OWNER,
        effectiveTier: SubscriptionTier.CONTRACTOR_PREMIUM,
      });

      const res = await request(app.getHttpServer())
        .get('/enterprise/sso/connection')
        .expect(403);

      expect(res.body).toMatchObject({
        error: 'FEATURE_GATED',
        feature_key: 'enterprise_sso',
        current_tier: SubscriptionTier.CONTRACTOR_PREMIUM,
      });
    });

    it('bascule l’enforcement', async () => {
      const res = await request(app.getHttpServer())
        .patch('/enterprise/sso/connection')
        .send({ enforced: true })
        .expect(200);

      expect(res.body).toMatchObject({ enforced: true });
    });

    it('refuse un champ hors DTO — la surface reste la politique, pas l’IdP', async () => {
      await request(app.getHttpServer())
        .patch('/enterprise/sso/connection')
        .send({ enforced: true, x509_certificate: 'AAA' })
        .expect(400);
    });

    it('ajoute un domaine et rend l’enregistrement TXT à publier', async () => {
      const res = await request(app.getHttpServer())
        .post('/enterprise/sso/domains')
        .send({ domain: 'acme.com' })
        .expect(201);

      expect(
        (res.body as { expected_dns_record: string }).expected_dns_record,
      ).toMatch(/^chiffreo-verification=/);
    });

    it('refuse un ajout de domaine sans domaine', async () => {
      await request(app.getHttpServer())
        .post('/enterprise/sso/domains')
        .send({})
        .expect(400);
    });

    it('vérifie un domaine en 200 (rejouable), pas en 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/enterprise/sso/domains/${mockDomainId}/verify`)
        .expect(200);

      expect(res.body).toMatchObject({ verified: true });
    });

    it('refuse un identifiant de domaine qui n’est pas un UUID', async () => {
      await request(app.getHttpServer())
        .post('/enterprise/sso/domains/pas-un-uuid/verify')
        .expect(400);
    });

    it('supprime un domaine en 204', async () => {
      await request(app.getHttpServer())
        .delete(`/enterprise/sso/domains/${mockDomainId}`)
        .expect(204);
    });
  });

  describe('Administration plateforme', () => {
    it('crée un contrat et trace son auteur', async () => {
      await request(app.getHttpServer())
        .post('/admin/enterprise/agreements')
        .send(validAgreementBody)
        .expect(201);

      expect(agreementsServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ quote_reference: 'DEV-2026-014' }),
        mockUserId,
      );
    });

    it.each([
      [
        'organisation manquante',
        { ...validAgreementBody, organization_id: undefined },
      ],
      ['montant négatif', { ...validAgreementBody, annual_amount_cents: -1 }],
      ['date non ISO', { ...validAgreementBody, starts_at: '01/09/2026' }],
      [
        'e-mail de facturation invalide',
        { ...validAgreementBody, billing_contact_email: 'pas-un-email' },
      ],
      [
        'SLA d’uptime hors bornes',
        { ...validAgreementBody, sla_uptime_target: 101 },
      ],
    ])('refuse un contrat avec %s', async (_label, body) => {
      await request(app.getHttpServer())
        .post('/admin/enterprise/agreements')
        .send(body)
        .expect(400);
    });

    it('n’accepte pas de déplacer un contrat vers une autre organisation', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/enterprise/agreements/${mockAgreementId}`)
        .send({ organization_id: mockOrgId })
        .expect(400);
    });

    it('résilie un contrat en 200', async () => {
      await request(app.getHttpServer())
        .post(`/admin/enterprise/agreements/${mockAgreementId}/terminate`)
        .expect(200);

      expect(agreementsServiceMock.terminate).toHaveBeenCalledWith(
        mockAgreementId,
      );
    });

    it('transmet la fenêtre de renouvellement', async () => {
      await request(app.getHttpServer())
        .get('/admin/enterprise/agreements')
        .query({ expiring_within_days: 30 })
        .expect(200);

      expect(agreementsServiceMock.listForAdmin).toHaveBeenCalledWith(30);
    });

    it('crée une connexion SAML complète', async () => {
      await request(app.getHttpServer())
        .post('/admin/enterprise/sso/connections')
        .send(validSamlBody)
        .expect(201);

      expect(ssoConnectionsServiceMock.createConnection).toHaveBeenCalledWith(
        expect.objectContaining({ protocol: 'saml' }),
        mockUserId,
      );
    });

    it.each([
      ['certificat', 'x509_certificate'],
      ['URL de SSO', 'sso_url'],
      ['entity ID de l’IdP', 'idp_entity_id'],
    ])('refuse une connexion SAML sans %s', async (_label, field) => {
      const body: Record<string, unknown> = { ...validSamlBody };
      delete body[field];

      await request(app.getHttpServer())
        .post('/admin/enterprise/sso/connections')
        .send(body)
        .expect(400);
    });

    it('refuse une URL de SSO en clair (http)', async () => {
      await request(app.getHttpServer())
        .post('/admin/enterprise/sso/connections')
        .send({ ...validSamlBody, sso_url: 'http://idp.acme.com/sso' })
        .expect(400);
    });

    it('refuse une connexion OIDC sans client_secret', async () => {
      await request(app.getHttpServer())
        .post('/admin/enterprise/sso/connections')
        .send({
          organization_id: mockOrgId,
          protocol: 'oidc',
          display_name: 'Acme OIDC',
          issuer: 'https://idp.acme.com',
          client_id: 'client-abc',
        })
        .expect(400);
    });

    it('refuse de provisionner une adhésion « owner » par défaut', async () => {
      await request(app.getHttpServer())
        .post('/admin/enterprise/sso/connections')
        .send({ ...validSamlBody, default_role: 'owner' })
        .expect(400);
    });

    it('supprime une connexion en 204', async () => {
      await request(app.getHttpServer())
        .delete(`/admin/enterprise/sso/connections/${mockConnectionId}`)
        .expect(204);

      expect(ssoConnectionsServiceMock.deleteConnection).toHaveBeenCalledWith(
        mockConnectionId,
      );
    });
  });
});
