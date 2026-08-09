import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  DataExportRequest,
  DataExportStatus,
} from './entities/data-export-request.entity';
import { STORAGE_PROVIDER } from '../photos/storage/storage.interface';
import { User } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { OrganizationMembership } from '../organizations/entities/organization-membership.entity';
import { OrganizationInvitation } from '../organizations/entities/organization-invitation.entity';
import { Client } from '../clients/entities/client.entity';
import { CompanyProfile } from '../company-profiles/entities/company-profile.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectWorkItem } from '../projects/entities/project-work-item.entity';
import { ProjectPhoto } from '../photos/entities/project-photo.entity';
import { EstimationResult } from '../estimations/entities/estimation-result.entity';
import { ShoppingList } from '../shopping-lists/entities/shopping-list.entity';
import { AnalysisJob } from '../analysis/entities/analysis-job.entity';
import { CvCorrectionLog } from '../analysis/entities/cv-correction-log.entity';
import { SiteMilestone } from '../site-tracking/entities/site-milestone.entity';
import { Quote } from '../quotes/entities/quote.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { CommunityProject } from '../community/entities/community-project.entity';
import { CommunityLike } from '../community/entities/community-like.entity';
import { CommunityComment } from '../community/entities/community-comment.entity';
import { ReferralCredit } from '../referrals/entities/referral-credit.entity';
import { RoomLogEntry } from '../logbook/entities/room-log-entry.entity';
import { LifecycleEmailSend } from '../lifecycle-emails/entities/lifecycle-email-send.entity';
import { AnalyticsEvent } from '../analytics/entities/analytics-event.entity';
import {
  Subscription,
  SubscriptionStatus,
} from '../subscriptions/entities/subscription.entity';
import { SubscriptionRefund } from '../subscriptions/entities/subscription-refund.entity';
import { QuantityValidation } from '../quantity-validation/entities/quantity-validation.entity';
import { QuantityCorrection } from '../quantity-validation/entities/quantity-correction.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { QuotePdfService } from '../quotes/quote-pdf.service';
import { InvoicePdfService } from '../invoices/invoice-pdf.service';
import { DataExportService } from './data-export.service';

function emptyRepoMock() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x: unknown) => x),
    save: jest.fn((x: unknown) => Promise.resolve(x)),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

const requestsRepoMock = emptyRepoMock();
const usersRepoMock = emptyRepoMock();
const organizationsRepoMock = emptyRepoMock();
const membershipsRepoMock = emptyRepoMock();
const invitationsRepoMock = emptyRepoMock();
const clientsRepoMock = emptyRepoMock();
const companyProfilesRepoMock = emptyRepoMock();
const projectsRepoMock = emptyRepoMock();
const workItemsRepoMock = emptyRepoMock();
const photosRepoMock = emptyRepoMock();
const estimationsRepoMock = emptyRepoMock();
const shoppingListsRepoMock = emptyRepoMock();
const analysisJobsRepoMock = emptyRepoMock();
const cvLogsRepoMock = emptyRepoMock();
const milestonesRepoMock = emptyRepoMock();
const quotesRepoMock = emptyRepoMock();
const invoicesRepoMock = emptyRepoMock();
const communityProjectsRepoMock = emptyRepoMock();
const communityLikesRepoMock = emptyRepoMock();
const communityCommentsRepoMock = emptyRepoMock();
const referralCreditsRepoMock = emptyRepoMock();
const logbookRepoMock = emptyRepoMock();
const lifecycleEmailsRepoMock = emptyRepoMock();
const analyticsEventsRepoMock = emptyRepoMock();
const subscriptionsRepoMock = emptyRepoMock();
const refundsRepoMock = emptyRepoMock();
const quantityValidationsRepoMock = emptyRepoMock();
const quantityCorrectionsRepoMock = emptyRepoMock();

const storageMock = {
  save: jest.fn(),
  saveStream: jest.fn(),
  delete: jest.fn().mockResolvedValue(undefined),
  listPrefix: jest.fn(),
  deletePrefix: jest.fn(),
  getAbsolutePath: jest.fn((p: string) => `/uploads/${p}`),
};

const subscriptionsServiceMock = {
  listBillingHistory: jest.fn(),
};

const quotePdfServiceMock = { generatePdf: jest.fn() };
const invoicePdfServiceMock = { generatePdf: jest.fn() };

const configMock = {
  get: jest.fn((_key: string, fallback: unknown) => fallback),
};

async function buildService(): Promise<DataExportService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      DataExportService,
      {
        provide: getRepositoryToken(DataExportRequest),
        useValue: requestsRepoMock,
      },
      { provide: getRepositoryToken(User), useValue: usersRepoMock },
      {
        provide: getRepositoryToken(Organization),
        useValue: organizationsRepoMock,
      },
      {
        provide: getRepositoryToken(OrganizationMembership),
        useValue: membershipsRepoMock,
      },
      {
        provide: getRepositoryToken(OrganizationInvitation),
        useValue: invitationsRepoMock,
      },
      { provide: getRepositoryToken(Client), useValue: clientsRepoMock },
      {
        provide: getRepositoryToken(CompanyProfile),
        useValue: companyProfilesRepoMock,
      },
      { provide: getRepositoryToken(Project), useValue: projectsRepoMock },
      {
        provide: getRepositoryToken(ProjectWorkItem),
        useValue: workItemsRepoMock,
      },
      { provide: getRepositoryToken(ProjectPhoto), useValue: photosRepoMock },
      {
        provide: getRepositoryToken(EstimationResult),
        useValue: estimationsRepoMock,
      },
      {
        provide: getRepositoryToken(ShoppingList),
        useValue: shoppingListsRepoMock,
      },
      {
        provide: getRepositoryToken(AnalysisJob),
        useValue: analysisJobsRepoMock,
      },
      {
        provide: getRepositoryToken(CvCorrectionLog),
        useValue: cvLogsRepoMock,
      },
      {
        provide: getRepositoryToken(SiteMilestone),
        useValue: milestonesRepoMock,
      },
      { provide: getRepositoryToken(Quote), useValue: quotesRepoMock },
      { provide: getRepositoryToken(Invoice), useValue: invoicesRepoMock },
      {
        provide: getRepositoryToken(CommunityProject),
        useValue: communityProjectsRepoMock,
      },
      {
        provide: getRepositoryToken(CommunityLike),
        useValue: communityLikesRepoMock,
      },
      {
        provide: getRepositoryToken(CommunityComment),
        useValue: communityCommentsRepoMock,
      },
      {
        provide: getRepositoryToken(ReferralCredit),
        useValue: referralCreditsRepoMock,
      },
      { provide: getRepositoryToken(RoomLogEntry), useValue: logbookRepoMock },
      {
        provide: getRepositoryToken(LifecycleEmailSend),
        useValue: lifecycleEmailsRepoMock,
      },
      {
        provide: getRepositoryToken(AnalyticsEvent),
        useValue: analyticsEventsRepoMock,
      },
      {
        provide: getRepositoryToken(Subscription),
        useValue: subscriptionsRepoMock,
      },
      {
        provide: getRepositoryToken(SubscriptionRefund),
        useValue: refundsRepoMock,
      },
      {
        provide: getRepositoryToken(QuantityValidation),
        useValue: quantityValidationsRepoMock,
      },
      {
        provide: getRepositoryToken(QuantityCorrection),
        useValue: quantityCorrectionsRepoMock,
      },
      { provide: STORAGE_PROVIDER, useValue: storageMock },
      { provide: SubscriptionsService, useValue: subscriptionsServiceMock },
      { provide: QuotePdfService, useValue: quotePdfServiceMock },
      { provide: InvoicePdfService, useValue: invoicePdfServiceMock },
      { provide: ConfigService, useValue: configMock },
    ],
  }).compile();

  return module.get(DataExportService);
}

describe('DataExportService', () => {
  let service: DataExportService;

  beforeEach(async () => {
    jest.clearAllMocks();
    for (const repo of [
      requestsRepoMock,
      usersRepoMock,
      organizationsRepoMock,
      membershipsRepoMock,
      invitationsRepoMock,
      clientsRepoMock,
      companyProfilesRepoMock,
      projectsRepoMock,
      workItemsRepoMock,
      photosRepoMock,
      estimationsRepoMock,
      shoppingListsRepoMock,
      analysisJobsRepoMock,
      cvLogsRepoMock,
      milestonesRepoMock,
      quotesRepoMock,
      invoicesRepoMock,
      communityProjectsRepoMock,
      communityLikesRepoMock,
      communityCommentsRepoMock,
      referralCreditsRepoMock,
      logbookRepoMock,
      lifecycleEmailsRepoMock,
      analyticsEventsRepoMock,
      subscriptionsRepoMock,
      refundsRepoMock,
    ]) {
      repo.find.mockResolvedValue([]);
      repo.findOne.mockResolvedValue(null);
    }
    configMock.get.mockImplementation(
      (_key: string, fallback: unknown) => fallback,
    );
    service = await buildService();
  });

  describe('requestExport', () => {
    it("crée une nouvelle demande quand aucune n'est en cours", async () => {
      requestsRepoMock.findOne.mockResolvedValueOnce(null);
      usersRepoMock.findOne.mockResolvedValue({ id: 'user-1' } as User);

      const request = await service.requestExport('user-1');

      expect(requestsRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          status: DataExportStatus.PENDING,
        }),
      );
      expect(request.user_id).toBe('user-1');
    });

    it("renvoie la demande existante plutôt que d'en empiler une seconde", async () => {
      const existing = {
        id: 'req-1',
        user_id: 'user-1',
        status: DataExportStatus.PROCESSING,
      } as DataExportRequest;
      requestsRepoMock.findOne.mockResolvedValueOnce(existing);

      const request = await service.requestExport('user-1');

      expect(request).toBe(existing);
      expect(requestsRepoMock.save).not.toHaveBeenCalled();
    });
  });

  describe('getForUser', () => {
    it("renvoie null pour une demande d'un autre compte", async () => {
      requestsRepoMock.findOne.mockResolvedValueOnce(null);
      const result = await service.getForUser('user-1', 'req-of-someone-else');
      expect(result).toBeNull();
      expect(requestsRepoMock.findOne).toHaveBeenCalledWith({
        where: { id: 'req-of-someone-else', user_id: 'user-1' },
      });
    });
  });

  describe('buildManifest', () => {
    it('échoue explicitement si le compte est introuvable', async () => {
      usersRepoMock.findOne.mockResolvedValueOnce(null);
      await expect(service.buildManifest('missing-user')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('déclare un historique de facturation vide sans client Stripe', async () => {
      usersRepoMock.findOne.mockResolvedValueOnce({ id: 'user-1' } as User);
      subscriptionsRepoMock.findOne.mockResolvedValueOnce(null);

      const { manifest } = await service.buildManifest('user-1');
      const profile = manifest.profile as Record<string, unknown>;
      expect(profile.billing_history).toEqual({
        available: false,
        reason: 'no_stripe_customer',
        entries: [],
      });
    });

    it('inclut les factures Stripe quand le compte en a un', async () => {
      usersRepoMock.findOne.mockResolvedValueOnce({ id: 'user-1' } as User);
      subscriptionsRepoMock.findOne.mockResolvedValueOnce({
        user_id: 'user-1',
        stripe_customer_id: 'cus_123',
        status: SubscriptionStatus.ACTIVE,
      } as Subscription);
      subscriptionsServiceMock.listBillingHistory.mockResolvedValueOnce([
        { id: 'in_1', amount_paid: 2900 },
      ]);

      const { manifest } = await service.buildManifest('user-1');
      const profile = manifest.profile as Record<string, unknown>;
      expect(profile.billing_history).toEqual({
        available: true,
        entries: [{ id: 'in_1', amount_paid: 2900 }],
      });
    });

    it("dégrade sans faire échouer l'export si Stripe est indisponible", async () => {
      usersRepoMock.findOne.mockResolvedValueOnce({ id: 'user-1' } as User);
      subscriptionsRepoMock.findOne.mockResolvedValueOnce({
        user_id: 'user-1',
        stripe_customer_id: 'cus_123',
      } as Subscription);
      subscriptionsServiceMock.listBillingHistory.mockRejectedValueOnce(
        new Error('stripe down'),
      );

      const { manifest } = await service.buildManifest('user-1');
      const profile = manifest.profile as Record<string, unknown>;
      expect(profile.billing_history).toEqual({
        available: false,
        reason: 'stripe_unavailable',
        entries: [],
      });
    });

    it("énumère toutes les organisations dont le compte est membre, pas seulement celles qu'il possède", async () => {
      usersRepoMock.findOne.mockResolvedValueOnce({ id: 'user-1' } as User);
      membershipsRepoMock.find.mockResolvedValueOnce([
        {
          organization_id: 'org-owned',
          user_id: 'user-1',
        } as OrganizationMembership,
        {
          organization_id: 'org-member-only',
          user_id: 'user-1',
        } as OrganizationMembership,
      ]);
      organizationsRepoMock.findOne.mockResolvedValue({
        id: 'org-x',
      } as Organization);

      const { manifest } = await service.buildManifest('user-1');
      const organizations = manifest.organizations as Record<string, unknown>[];
      expect(organizations).toHaveLength(2);
    });

    it('documente les entités exclues dans le JSON livré', async () => {
      usersRepoMock.findOne.mockResolvedValueOnce({ id: 'user-1' } as User);
      const { manifest } = await service.buildManifest('user-1');
      const documentation = manifest._documentation as Record<string, unknown>;
      expect(
        (documentation.excluded_entities as { table: string }[]).some(
          (e) => e.table === 'stripe_events',
        ),
      ).toBe(true);
    });
  });

  describe('purgeExpiredExports', () => {
    it('efface fichier et ligne des exports ready expirés', async () => {
      const expired = {
        id: 'req-1',
        file_path: 'exports/user-1/req-1.zip',
        status: DataExportStatus.READY,
      } as DataExportRequest;
      requestsRepoMock.find.mockImplementation(
        (opts: { where: { status: DataExportStatus } }) =>
          Promise.resolve(
            opts.where.status === DataExportStatus.READY ? [expired] : [],
          ),
      );

      await service.purgeExpiredExports();

      expect(storageMock.delete).toHaveBeenCalledWith(
        'exports/user-1/req-1.zip',
      );
      expect(requestsRepoMock.delete).toHaveBeenCalledWith('req-1');
    });

    it('échoue les demandes processing bloquées trop longtemps', async () => {
      const stuck = {
        id: 'req-2',
        status: DataExportStatus.PROCESSING,
      } as DataExportRequest;
      requestsRepoMock.find.mockImplementation(
        (opts: { where: { status: DataExportStatus } }) =>
          Promise.resolve(
            opts.where.status === DataExportStatus.PROCESSING ? [stuck] : [],
          ),
      );

      await service.purgeExpiredExports();

      expect(requestsRepoMock.update).toHaveBeenCalledWith(
        'req-2',
        expect.objectContaining({ status: DataExportStatus.FAILED }),
      );
    });

    it('ne lève jamais — une passe échouée ne doit pas tuer le process du cron', async () => {
      requestsRepoMock.find.mockRejectedValueOnce(new Error('db down'));
      await expect(service.purgeExpiredExports()).resolves.toBeUndefined();
    });
  });

  describe('processExport', () => {
    it('produit une archive et marque la demande ready', async () => {
      const request = {
        id: 'req-1',
        user_id: 'user-1',
        status: DataExportStatus.PENDING,
      } as DataExportRequest;
      requestsRepoMock.findOne.mockResolvedValueOnce(request);
      usersRepoMock.findOne.mockResolvedValueOnce({ id: 'user-1' } as User);
      storageMock.saveStream.mockImplementation(
        async (stream: NodeJS.ReadableStream) => {
          // Consomme le flux : sans lecteur, `archiver` reste en pause et
          // `finalize()` ne se résout jamais — comme un vrai `pipeline`.
          for await (const _chunk of stream) {
            void _chunk;
          }
          return { path: 'exports/user-1/req-1.zip', bytes: 42 };
        },
      );

      await service.processExport('req-1');

      expect(requestsRepoMock.update).toHaveBeenCalledWith(
        'req-1',
        expect.objectContaining({ status: DataExportStatus.PROCESSING }),
      );
      expect(requestsRepoMock.update).toHaveBeenCalledWith(
        'req-1',
        expect.objectContaining({
          status: DataExportStatus.READY,
          file_path: 'exports/user-1/req-1.zip',
          file_size_bytes: '42',
        }),
      );
    });

    it('marque la demande failed sans lever si la génération échoue', async () => {
      const request = {
        id: 'req-2',
        user_id: 'user-1',
        status: DataExportStatus.PENDING,
      } as DataExportRequest;
      requestsRepoMock.findOne.mockResolvedValueOnce(request);
      usersRepoMock.findOne.mockRejectedValueOnce(new Error('db down'));

      await expect(service.processExport('req-2')).resolves.toBeUndefined();

      expect(requestsRepoMock.update).toHaveBeenCalledWith(
        'req-2',
        expect.objectContaining({ status: DataExportStatus.FAILED }),
      );
    });
  });
});
