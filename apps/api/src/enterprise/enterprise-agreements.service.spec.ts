import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import {
  EnterpriseAgreement,
  EnterpriseAgreementStatus,
} from './entities/enterprise-agreement.entity';
import { EnterpriseAgreementsService } from './enterprise-agreements.service';

const ORG_ID = '00000000-0000-4000-8000-0000000000aa';
const ADMIN_ID = '00000000-0000-4000-8000-0000000000bb';
const DAY_MS = 24 * 60 * 60 * 1000;

function makeAgreement(
  overrides: Partial<EnterpriseAgreement> = {},
): EnterpriseAgreement {
  return {
    id: 'agr-1',
    organization_id: ORG_ID,
    status: EnterpriseAgreementStatus.ACTIVE,
    starts_at: new Date(Date.now() - 30 * DAY_MS),
    ends_at: new Date(Date.now() + 335 * DAY_MS),
    annual_amount_cents: 1_200_000,
    currency: 'EUR',
    quote_reference: 'DEV-2026-014',
    purchase_order_reference: null,
    billing_contact_email: 'compta@acme.com',
    sla_uptime_target: '99.90',
    sla_support_response_hours: 4,
    sla_support_email: 'support@chiffreo.fr',
    dedicated_environment: false,
    dedicated_environment_region: null,
    notes: null,
    created_by_user_id: ADMIN_ID,
    organization: null as never,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

const validDto = {
  organization_id: ORG_ID,
  starts_at: '2026-09-01T00:00:00.000Z',
  ends_at: '2027-08-31T23:59:59.000Z',
  annual_amount_cents: 1_200_000,
  quote_reference: '  DEV-2026-014  ',
  billing_contact_email: 'Compta@ACME.com',
};

describe('EnterpriseAgreementsService', () => {
  let service: EnterpriseAgreementsService;
  const agreementsRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    agreementsRepo.create.mockImplementation((v: unknown) => v);
    agreementsRepo.save.mockImplementation((v: unknown) => v);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnterpriseAgreementsService,
        {
          provide: getRepositoryToken(EnterpriseAgreement),
          useValue: agreementsRepo,
        },
      ],
    }).compile();

    service = module.get(EnterpriseAgreementsService);
  });

  describe('create', () => {
    it('crée en « draft » : un contrat en rédaction n’habilite rien', async () => {
      await service.create(validDto, ADMIN_ID);

      const [saved] = agreementsRepo.save.mock.calls[0] as [
        Partial<EnterpriseAgreement>,
      ];
      expect(saved.status).toBe(EnterpriseAgreementStatus.DRAFT);
      expect(saved.created_by_user_id).toBe(ADMIN_ID);
    });

    it('normalise références, devise et adresses', async () => {
      await service.create({ ...validDto, currency: 'eur' }, ADMIN_ID);

      const [saved] = agreementsRepo.save.mock.calls[0] as [
        Partial<EnterpriseAgreement>,
      ];
      expect(saved.quote_reference).toBe('DEV-2026-014');
      expect(saved.currency).toBe('EUR');
      expect(saved.billing_contact_email).toBe('compta@acme.com');
    });

    it('stocke le SLA d’uptime avec deux décimales', async () => {
      await service.create({ ...validDto, sla_uptime_target: 99.9 }, ADMIN_ID);

      const [saved] = agreementsRepo.save.mock.calls[0] as [
        Partial<EnterpriseAgreement>,
      ];
      expect(saved.sla_uptime_target).toBe('99.90');
    });

    it('refuse une période inversée', async () => {
      await expect(
        service.create(
          { ...validDto, ends_at: '2026-01-01T00:00:00.000Z' },
          ADMIN_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(agreementsRepo.save).not.toHaveBeenCalled();
    });

    it('traduit la collision d’index en motif actionnable', async () => {
      agreementsRepo.save.mockRejectedValue(
        new QueryFailedError(
          'insert',
          [],
          new Error(
            'duplicate key value violates unique constraint "UQ_enterprise_agreements_active_org"',
          ),
        ),
      );

      await expect(service.create(validDto, ADMIN_ID)).rejects.toMatchObject({
        response: { error: 'ENTERPRISE_AGREEMENT_OVERLAP' },
      });
    });
  });

  describe('update / terminate', () => {
    it('active un contrat existant sans toucher aux champs non fournis', async () => {
      const agreement = makeAgreement({
        status: EnterpriseAgreementStatus.DRAFT,
      });
      agreementsRepo.findOne.mockResolvedValue(agreement);

      const updated = await service.update('agr-1', {
        status: EnterpriseAgreementStatus.ACTIVE,
      });

      expect(updated.status).toBe(EnterpriseAgreementStatus.ACTIVE);
      expect(updated.quote_reference).toBe('DEV-2026-014');
    });

    it('renouvelle en repoussant la fin, sans créer de second contrat', async () => {
      agreementsRepo.findOne.mockResolvedValue(makeAgreement());

      const updated = await service.update('agr-1', {
        ends_at: '2028-08-31T00:00:00.000Z',
      });

      expect(updated.ends_at.getFullYear()).toBe(2028);
      expect(agreementsRepo.create).not.toHaveBeenCalled();
    });

    it('refuse une mise à jour qui inverserait la période', async () => {
      agreementsRepo.findOne.mockResolvedValue(makeAgreement());

      await expect(
        service.update('agr-1', { ends_at: '2000-01-01T00:00:00.000Z' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('résilie sans supprimer la ligne', async () => {
      agreementsRepo.findOne.mockResolvedValue(makeAgreement());

      const terminated = await service.terminate('agr-1');

      expect(terminated.status).toBe(EnterpriseAgreementStatus.TERMINATED);
      expect(agreementsRepo.save).toHaveBeenCalled();
    });

    it('rend 404 sur un contrat inconnu', async () => {
      agreementsRepo.findOne.mockResolvedValue(null);

      await expect(service.terminate('inconnu')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('lectures', () => {
    it('scope la lecture de l’organisation sur son propre contrat actif', async () => {
      agreementsRepo.findOne.mockResolvedValue(makeAgreement());

      await service.findCurrentForOrganization(ORG_ID);

      expect(agreementsRepo.findOne).toHaveBeenCalledWith({
        where: {
          organization_id: ORG_ID,
          status: EnterpriseAgreementStatus.ACTIVE,
        },
      });
    });

    it('rend 404 quand l’organisation n’a pas de contrat', async () => {
      agreementsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findCurrentForOrganization(ORG_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('ne filtre que les contrats actifs dans la file de renouvellement', async () => {
      agreementsRepo.find.mockResolvedValue([]);

      await service.listForAdmin(30);

      const [args] = agreementsRepo.find.mock.calls[0] as [
        { where: { status: string } },
      ];
      expect(args.where.status).toBe(EnterpriseAgreementStatus.ACTIVE);
    });
  });

  describe('toView — l’expiration se dérive, elle n’est pas stockée (D14)', () => {
    it('marque courant un contrat actif dans sa période', () => {
      expect(service.toView(makeAgreement()).is_current).toBe(true);
    });

    it('marque non courant un contrat actif mais expiré', () => {
      const view = service.toView(
        makeAgreement({ ends_at: new Date(Date.now() - DAY_MS) }),
      );
      expect(view.is_current).toBe(false);
      expect(view.days_until_expiry).toBe(0);
    });

    it('marque non courant un contrat actif pas encore démarré', () => {
      const view = service.toView(
        makeAgreement({
          starts_at: new Date(Date.now() + 10 * DAY_MS),
          ends_at: new Date(Date.now() + 300 * DAY_MS),
        }),
      );
      expect(view.is_current).toBe(false);
    });

    it('marque non courant un contrat résilié', () => {
      const view = service.toView(
        makeAgreement({ status: EnterpriseAgreementStatus.TERMINATED }),
      );
      expect(view.is_current).toBe(false);
    });

    it('rend le SLA en nombre, pas en chaîne du driver pg', () => {
      expect(service.toView(makeAgreement()).sla.uptime_target).toBe(99.9);
    });

    it('n’expose ni notes internes ni auteur à l’organisation', () => {
      const view = service.toView(makeAgreement({ notes: 'négocié à -15 %' }));

      expect(JSON.stringify(view)).not.toContain('négocié');
      expect(view).not.toHaveProperty('created_by_user_id');
    });
  });
});
