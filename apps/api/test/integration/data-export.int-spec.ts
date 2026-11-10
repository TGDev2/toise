import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { mkdtemp, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { DataSource } from 'typeorm';
import AdmZip from 'adm-zip';
import { migratedDataSource, truncateUserData } from './test-database';
import { User } from '../../src/users/entities/user.entity';
import {
  Project,
  ProjectStatus,
  WorkType as ProjectWorkTypeEnum,
} from '../../src/projects/entities/project.entity';
import { Room } from '../../src/projects/entities/room.entity';
import {
  RoomDimensions,
  ConfidenceScore,
  DimensionSource,
  ExclusionType,
} from '../../src/projects/entities/room-dimensions.entity';
import {
  Opening,
  OpeningType,
  OpeningSource,
} from '../../src/projects/entities/opening.entity';
import { WorkType } from '../../src/projects/entities/work-type.entity';
import {
  ProjectWorkItem,
  SkillLevel,
} from '../../src/projects/entities/project-work-item.entity';
import { ProjectPhoto } from '../../src/photos/entities/project-photo.entity';
import { Client } from '../../src/clients/entities/client.entity';
import { CompanyProfile } from '../../src/company-profiles/entities/company-profile.entity';
import { EstimationResult } from '../../src/estimations/entities/estimation-result.entity';
import { ShoppingList } from '../../src/shopping-lists/entities/shopping-list.entity';
import {
  AnalysisJob,
  AnalysisJobStatus,
} from '../../src/analysis/entities/analysis-job.entity';
import { CvCorrectionLog } from '../../src/analysis/entities/cv-correction-log.entity';
import {
  SiteMilestone,
  MilestoneStatus,
} from '../../src/site-tracking/entities/site-milestone.entity';
import { Quote, QuoteStatus } from '../../src/quotes/entities/quote.entity';
import {
  Invoice,
  InvoiceStatus,
  InvoiceType,
  OperationCategory,
} from '../../src/invoices/entities/invoice.entity';
import {
  CommunityProject,
  ModerationStatus,
} from '../../src/community/entities/community-project.entity';
import { CommunityLike } from '../../src/community/entities/community-like.entity';
import { CommunityComment } from '../../src/community/entities/community-comment.entity';
import {
  ReferralCredit,
  ReferralCreditStatus,
} from '../../src/referrals/entities/referral-credit.entity';
import { RoomLogEntry } from '../../src/logbook/entities/room-log-entry.entity';
import { LifecycleEmailSend } from '../../src/lifecycle-emails/entities/lifecycle-email-send.entity';
import { LifecycleEmailType } from '../../src/lifecycle-emails/lifecycle-email-type.enum';
import { AnalyticsEvent } from '../../src/analytics/entities/analytics-event.entity';
import {
  Subscription,
  SubscriptionStatus,
} from '../../src/subscriptions/entities/subscription.entity';
import { SubscriptionRefund } from '../../src/subscriptions/entities/subscription-refund.entity';
import { QuantityValidation } from '../../src/quantity-validation/entities/quantity-validation.entity';
import {
  QuantityCorrection,
  QuantityCorrectionSource,
} from '../../src/quantity-validation/entities/quantity-correction.entity';
import { LocalStorageService } from '../../src/photos/storage/local-storage.service';
import { QuotePdfService } from '../../src/quotes/quote-pdf.service';
import { InvoicePdfService } from '../../src/invoices/invoice-pdf.service';
import { DataExportService } from '../../src/data-export/data-export.service';
import {
  DataExportRequest,
  DataExportStatus,
} from '../../src/data-export/entities/data-export-request.entity';
import type { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';

/**
 * E6-2 — portabilité RGPD, vérifiée là où l'exhaustivité se joue : un compte
 * réellement peuplé, un second compte voisin pour éprouver la frontière, et
 * une archive réellement rouverte.
 *
 * Firebase et Stripe sont les seules doublures ici (dépendances externes que
 * ce test n'a pas vocation à exercer) ; `QuotePdfService`/`InvoicePdfService`
 * tournent pour de vrai, ce qui prouve au passage que les PDF se génèrent sans
 * exception contre des fixtures réelles.
 */
describe('Export RGPD (intégration, PostgreSQL et volume réels)', () => {
  let dataSource: DataSource;
  let uploadsPath: string;
  let storage: LocalStorageService;
  let service: DataExportService;
  const listBillingHistory = jest.fn();

  async function seedPhoto(projectId: string): Promise<ProjectPhoto> {
    const storageUrl = await storage.save(
      Buffer.from('contenu-photo'),
      `${projectId}/photo.jpg`,
      'image/jpeg',
    );
    return dataSource.getRepository(ProjectPhoto).save({
      project_id: projectId,
      storage_url: storageUrl,
      original_filename: 'chantier.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 14,
    });
  }

  beforeAll(async () => {
    dataSource = await migratedDataSource();
    uploadsPath = await mkdtemp(join(tmpdir(), 'toise-export-'));

    const config = {
      get: (key: string, fallback?: unknown) => {
        if (key === 'storage.localPath') return uploadsPath;
        if (key === 'dataExport.retentionHours') return 48;
        return fallback;
      },
    } as unknown as ConfigService;

    storage = new LocalStorageService(config);

    service = new DataExportService(
      dataSource.getRepository(DataExportRequest),
      dataSource.getRepository(User),
      dataSource.getRepository(Client),
      dataSource.getRepository(CompanyProfile),
      dataSource.getRepository(Project),
      dataSource.getRepository(ProjectWorkItem),
      dataSource.getRepository(ProjectPhoto),
      dataSource.getRepository(EstimationResult),
      dataSource.getRepository(ShoppingList),
      dataSource.getRepository(AnalysisJob),
      dataSource.getRepository(CvCorrectionLog),
      dataSource.getRepository(SiteMilestone),
      dataSource.getRepository(Quote),
      dataSource.getRepository(Invoice),
      dataSource.getRepository(CommunityProject),
      dataSource.getRepository(CommunityLike),
      dataSource.getRepository(CommunityComment),
      dataSource.getRepository(ReferralCredit),
      dataSource.getRepository(RoomLogEntry),
      dataSource.getRepository(LifecycleEmailSend),
      dataSource.getRepository(AnalyticsEvent),
      dataSource.getRepository(Subscription),
      dataSource.getRepository(SubscriptionRefund),
      dataSource.getRepository(QuantityValidation),
      dataSource.getRepository(QuantityCorrection),
      storage,
      { listBillingHistory } as unknown as SubscriptionsService,
      new QuotePdfService(),
      new InvoicePdfService(),
      config,
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    await rm(uploadsPath, { recursive: true, force: true });
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    listBillingHistory.mockResolvedValue([
      { id: 'in_test_1', amount_paid: 4900, currency: 'eur' },
    ]);
    await truncateUserData(dataSource);
    for (const entry of await readdir(uploadsPath)) {
      await rm(join(uploadsPath, entry), { recursive: true, force: true });
    }
  });

  /**
   * Compte peuplé : chaque entité exportable de l'inventaire représentée au
   * moins une fois, et un second compte doté de ses propres projet, devis et
   * publication — c'est lui qui prouve la frontière de portée (E6-2 : rien
   * d'un autre compte ; activité communautaire d'autrui non énumérée
   * nominativement).
   */
  async function seedPopulatedAccount() {
    const [user1, user2, user3]: User[] = await dataSource
      .getRepository(User)
      .save([
        { email: 'export-1@toise.test', firebase_uid: 'firebase-export-1' },
        { email: 'export-2@toise.test', firebase_uid: 'firebase-export-2' },
        { email: 'export-3@toise.test', firebase_uid: 'firebase-export-3' },
      ]);

    // ── Compte A : le compte exporté ──
    const companyProfile = await dataSource.getRepository(CompanyProfile).save({
      user_id: user1.id,
      raison_sociale: 'Toisé Test SARL',
      siret: '12345678900011',
      address_line1: '1 rue du Test',
      postal_code: '75000',
      city: 'Paris',
      iban: 'FR7630006000011234567890189',
      bic: 'AGRIFRPP',
    });
    const client = await dataSource.getRepository(Client).save({
      user_id: user1.id,
      name: 'Client Test',
      email: 'client@example.com',
    });

    // work_types n'est pas remis à zéro entre les tests (truncateUserData ne
    // touche que ce qui référence users) : un code fixe entrerait en conflit
    // dès le second test de la suite.
    const workType = await dataSource.getRepository(WorkType).save({
      code: `test-export-${randomUUID()}`,
      label_fr: 'Ouvrage de test',
      category: 'peinture',
      surface_target: 'wall',
    });

    const projectA = await dataSource.getRepository(Project).save({
      user_id: user1.id,
      name: 'Chantier A',
      room_name: 'Salon',
      work_type: ProjectWorkTypeEnum.PAINTING,
      status: ProjectStatus.ESTIMATED,
    });
    const roomA = await dataSource.getRepository(Room).save({
      project_id: projectA.id,
      name: 'Salon',
    });
    await dataSource.getRepository(RoomDimensions).save({
      room_id: roomA.id,
      length_cm: 400,
      width_cm: 300,
      height_cm: 250,
      confidence_score: ConfidenceScore.HIGH,
      source: DimensionSource.MANUAL,
      exclusions_json: [
        { surface_target: 'wall', type: ExclusionType.CREDENCE, area_m2: 1.2 },
      ],
    });
    await dataSource.getRepository(Opening).save({
      room_id: roomA.id,
      type: OpeningType.DOOR,
      width_cm: 80,
      height_cm: 200,
      source: OpeningSource.MANUAL,
    });
    const workItem = await dataSource.getRepository(ProjectWorkItem).save({
      room_id: roomA.id,
      work_type_id: workType.id,
      skill_level: SkillLevel.INTERMEDIATE,
    });
    const photoA = await seedPhoto(projectA.id);
    const estimation = await dataSource.getRepository(EstimationResult).save({
      project_id: projectA.id,
      skill_level: 'intermediate',
      items_json: [],
      total_items: 0,
    });
    const shoppingList = await dataSource.getRepository(ShoppingList).save({
      project_id: projectA.id,
      estimation_id: estimation.id,
      items_json: { material_items: [], complementary_items: [] },
    });
    const analysisJob = await dataSource.getRepository(AnalysisJob).save({
      project_id: projectA.id,
      status: AnalysisJobStatus.COMPLETED,
    });
    const cvLog = await dataSource.getRepository(CvCorrectionLog).save({
      project_id: projectA.id,
      analysis_job_id: analysisJob.id,
      entity_type: 'dimension',
      cv_value: { length_cm: 390 },
      user_value: { length_cm: 400 },
    });
    const milestone = await dataSource.getRepository(SiteMilestone).save({
      project_id: projectA.id,
      label: 'Prépa chantier',
      status: MilestoneStatus.DONE,
    });
    const quote = await dataSource.getRepository(Quote).save({
      user_id: user1.id,
      project_id: projectA.id,
      client_id: client.id,
      estimation_id: estimation.id,
      quote_number: 'D-TEST-1',
      status: QuoteStatus.DRAFT,
      items_json: [],
    });
    const invoice = await dataSource.getRepository(Invoice).save({
      user_id: user1.id,
      project_id: projectA.id,
      client_id: client.id,
      invoice_number: 'F-TEST-1',
      invoice_type: InvoiceType.SOLDE,
      status: InvoiceStatus.ISSUED,
      issued_on: '2026-08-01',
      due_on: '2026-08-31',
      seller_snapshot: { name: 'Toisé Test SARL', country: 'FR' },
      buyer_snapshot: { name: 'Client Test', country: 'FR' },
      operation_category: OperationCategory.SERVICES,
      items_json: [],
      vat_breakdown: [],
    });
    const communityA = await dataSource.getRepository(CommunityProject).save({
      project_id: projectA.id,
      user_id: user1.id,
      work_type: 'painting',
      title: 'Salon repeint',
      total_cost_cents: 10_000,
      duration_days: 2,
      length_cm: 400,
      width_cm: 300,
      moderation_status: ModerationStatus.APPROVED,
      gdpr_consent: true,
    });
    // user2 interagit avec la publication de user1 : ne doit PAS apparaître
    // nominativement dans l'export de user1.
    await dataSource.getRepository(CommunityLike).save({
      community_project_id: communityA.id,
      user_id: user2.id,
    });
    await dataSource.getRepository(CommunityComment).save({
      community_project_id: communityA.id,
      user_id: user2.id,
      content: 'Beau chantier',
    });

    // ── Compte B : un autre compte, sa frontière ──
    // Jusqu'à E4-1 ce bloc était « l'organisation B, où user1 n'est que
    // membre », et l'export de user1 devait la contenir *en entier*. Sans
    // organisation, la règle s'inverse et devient celle qui protège
    // réellement : l'export de user1 ne doit rien contenir de user2.
    // Le compte B n'a délibérément pas de profil d'entreprise — c'est lui qui
    // porte la démonstration de la dégradation « pdf_file: null ».
    const projectB = await dataSource.getRepository(Project).save({
      user_id: user2.id,
      name: 'Chantier B',
      room_name: 'Cuisine',
      status: ProjectStatus.DRAFT,
    });
    const quoteB = await dataSource.getRepository(Quote).save({
      user_id: user2.id,
      project_id: projectB.id,
      estimation_id: (
        await dataSource.getRepository(EstimationResult).save({
          project_id: projectB.id,
          skill_level: 'beginner',
          items_json: [],
          total_items: 0,
        })
      ).id,
      quote_number: 'D-TEST-2',
      status: QuoteStatus.DRAFT,
      items_json: [],
    });
    const communityB = await dataSource.getRepository(CommunityProject).save({
      project_id: projectB.id,
      user_id: user2.id,
      work_type: 'painting',
      title: 'Cuisine repeinte',
      total_cost_cents: 5_000,
      duration_days: 1,
      length_cm: 200,
      width_cm: 200,
      moderation_status: ModerationStatus.APPROVED,
      gdpr_consent: true,
    });
    // user1 like/commente le chantier publié par user2 : DOIT apparaître dans
    // sa propre activité communautaire (community_activity), pas ailleurs.
    const ownLike = await dataSource.getRepository(CommunityLike).save({
      community_project_id: communityB.id,
      user_id: user1.id,
    });
    const ownComment = await dataSource.getRepository(CommunityComment).save({
      community_project_id: communityB.id,
      user_id: user1.id,
      content: 'Beau travail',
    });

    // ── Hors organisation : parrainage, carnet, emails, analytics, abonnement ──
    const asReferrer = await dataSource.getRepository(ReferralCredit).save({
      referrer_user_id: user1.id,
      referred_user_id: user2.id,
      amount_cents: 900,
      status: ReferralCreditStatus.PENDING,
    });
    const asReferred = await dataSource.getRepository(ReferralCredit).save({
      referrer_user_id: user3.id,
      referred_user_id: user1.id,
      amount_cents: 900,
      status: ReferralCreditStatus.APPLIED,
    });
    const logbookEntry = await dataSource.getRepository(RoomLogEntry).save({
      user_id: user1.id,
      project_id: projectA.id,
      project_name: 'Chantier A',
      room_id: roomA.id,
      room_name: 'Salon',
      dimensions_snapshot: {
        length_cm: 400,
        width_cm: 300,
        height_cm: 250,
        source: 'manual',
        segments_json: null,
      },
      materials_snapshot: [],
      recorded_at: new Date(),
    });
    const lifecycleEmail = await dataSource
      .getRepository(LifecycleEmailSend)
      .save({
        user_id: user1.id,
        project_id: null,
        email_type: LifecycleEmailType.ONBOARDING_D1,
      });
    const analyticsEvent = await dataSource.getRepository(AnalyticsEvent).save({
      user_id: user1.id,
      event_name: 'account_created',
      properties: {},
    });
    // Événement d'un AUTRE compte : ne doit jamais apparaître dans l'export de user1.
    await dataSource.getRepository(AnalyticsEvent).save({
      user_id: user2.id,
      event_name: 'account_created',
      properties: {},
    });
    const subscription = await dataSource.getRepository(Subscription).save({
      user_id: user1.id,
      stripe_customer_id: 'cus_test_1',
      stripe_subscription_id: 'sub_test_1',
      status: SubscriptionStatus.ACTIVE,
    });

    // E2-4 : la trace probatoire de la validation des quantités et l'écart
    // déclaré avant achat. Rattachées au projet, donc au périmètre du compte.
    const quantityValidation = await dataSource
      .getRepository(QuantityValidation)
      .save({
        project_id: projectA.id,
        user_id: user1.id,
        user_email: user1.email,
        quantities_fingerprint: 'b'.repeat(64),
        quantities_json: [
          {
            material_id: 'mat-paint',
            material_name: 'Peinture acrylique mate',
            work_type_code: 'wall_painting',
            work_type_label: 'Peinture murale',
            packaging_label: 'Pot 10 L',
            units_needed: 2,
          },
        ],
        line_count: 1,
      });
    const quantityCorrection = await dataSource
      .getRepository(QuantityCorrection)
      .save({
        project_id: projectA.id,
        user_id: user1.id,
        material_id: '00000000-0000-4000-8000-0000000000f1',
        material_name: 'Mortier-colle C2',
        material_unit: 'kg',
        packaging_label: 'Sac 25 kg',
        work_type_code: 'floor_tiling',
        work_type_label: 'Carrelage sol',
        skill_level: 'expert',
        computed_units: 4,
        previous_units: 4,
        corrected_units: 5,
        relative_deviation: 0.25,
        source: QuantityCorrectionSource.QUOTE_VALIDATION,
      });

    return {
      user1,
      user2,
      user3,
      companyProfile,
      client,
      projectA,
      roomA,
      workItem,
      photoA,
      estimation,
      shoppingList,
      analysisJob,
      cvLog,
      milestone,
      quote,
      invoice,
      communityA,
      projectB,
      quoteB,
      communityB,
      ownLike,
      ownComment,
      asReferrer,
      asReferred,
      logbookEntry,
      lifecycleEmail,
      analyticsEvent,
      subscription,
      quantityValidation,
      quantityCorrection,
    };
  }

  it('rassemble, dans le manifeste, chaque identifiant seedé pour ce compte', async () => {
    const fixture = await seedPopulatedAccount();

    const { manifest } = await service.buildManifest(fixture.user1.id);
    const serialized = JSON.stringify(manifest);

    const expectedIds: string[] = [
      fixture.companyProfile.id,
      fixture.client.id,
      fixture.projectA.id,
      fixture.roomA.id,
      fixture.workItem.id,
      fixture.photoA.id,
      fixture.estimation.id,
      fixture.shoppingList.id,
      fixture.analysisJob.id,
      fixture.cvLog.id,
      fixture.milestone.id,
      fixture.quote.id,
      fixture.invoice.id,
      fixture.communityA.id,
      fixture.ownLike.id,
      fixture.ownComment.id,
      fixture.asReferrer.id,
      fixture.asReferred.id,
      fixture.logbookEntry.id,
      fixture.lifecycleEmail.id,
      fixture.analyticsEvent.id,
      fixture.subscription.id,
      fixture.quantityValidation.id,
      fixture.quantityCorrection.id,
    ];

    for (const id of expectedIds) {
      expect(serialized.includes(id)).toBe(true);
    }
  });

  it("n'énumère pas l'identité d'un tiers ayant liké/commenté une publication de ce compte", async () => {
    const fixture = await seedPopulatedAccount();
    const { manifest } = await service.buildManifest(fixture.user1.id);

    const projectAManifest = (
      manifest.projects as Record<string, unknown>[]
    ).find((p) => p.id === fixture.projectA.id)!;
    const publication = projectAManifest.community_publication as Record<
      string,
      unknown
    >;

    expect(publication).not.toHaveProperty('likes');
    expect(publication).not.toHaveProperty('comments');
    expect(JSON.stringify(publication)).not.toContain(fixture.user2.id);

    // La propre activité de user1 (son like/commentaire sur la publication de
    // user2), elle, doit apparaître.
    const community = manifest.community_activity as {
      likes: { id: string }[];
      comments: { id: string }[];
    };
    expect(community.likes.map((l) => l.id)).toContain(fixture.ownLike.id);
    expect(community.comments.map((c) => c.id)).toContain(
      fixture.ownComment.id,
    );
  });

  it("n'inclut aucun événement analytics d'un autre compte", async () => {
    const fixture = await seedPopulatedAccount();
    const { manifest } = await service.buildManifest(fixture.user1.id);
    const events = manifest.analytics_events as { id: string }[];
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe(fixture.analyticsEvent.id);
  });

  it('dégrade le PDF du devis sans compte-fournisseur avec la raison exacte', async () => {
    const fixture = await seedPopulatedAccount();
    // C'est le compte B qu'on exporte ici : il a un devis mais pas de profil
    // d'entreprise, donc pas de mentions légales d'émetteur à imprimer.
    const { manifest, quotePdfRefs } = await service.buildManifest(
      fixture.user2.id,
    );

    const projectBManifest = (
      manifest.projects as Record<string, unknown>[]
    ).find((p) => p.id === fixture.projectB.id)!;
    const quoteBManifest = (
      projectBManifest.quotes as Record<string, unknown>[]
    )[0];

    expect(quoteBManifest.pdf_file).toBeNull();
    expect(quoteBManifest.pdf_skip_reason).toBe('no_company_profile');
    expect(quotePdfRefs.some((r) => r.quote.id === fixture.quoteB.id)).toBe(
      false,
    );
  });

  it("n'inclut jamais les données d'un autre compte", async () => {
    const fixture = await seedPopulatedAccount();

    const { manifest } = await service.buildManifest(fixture.user1.id);
    const serialized = JSON.stringify(manifest);

    // Avant E4-1 l'export incluait délibérément l'intégralité des
    // organisations où le compte n'était que membre. Sans organisation, la
    // frontière redevient le compte, et elle doit être étanche.
    for (const id of [fixture.projectB.id, fixture.quoteB.id]) {
      expect(serialized).not.toContain(id);
    }
  });

  it('déclare les entités exclues et documente le format', async () => {
    const fixture = await seedPopulatedAccount();
    const { manifest } = await service.buildManifest(fixture.user1.id);
    const doc = manifest._documentation as {
      excluded_entities: { table: string; reason: string }[];
    };
    expect(doc.excluded_entities.length).toBeGreaterThan(0);
    expect(doc.excluded_entities.every((e) => e.reason.length > 0)).toBe(true);
  });

  describe('processExport (archive réelle)', () => {
    it('produit un zip contenant data.json, le devis en PDF et la photo', async () => {
      const fixture = await seedPopulatedAccount();
      const request = await dataSource.getRepository(DataExportRequest).save({
        user_id: fixture.user1.id,
        status: DataExportStatus.PENDING,
      });

      await service.processExport(request.id);

      const updated = await dataSource
        .getRepository(DataExportRequest)
        .findOneByOrFail({ id: request.id });
      expect(updated.status).toBe(DataExportStatus.READY);
      expect(updated.file_path).toBe(
        `exports/${fixture.user1.id}/${request.id}.zip`,
      );
      expect(updated.expires_at).toBeInstanceOf(Date);

      const absolutePath = join(uploadsPath, updated.file_path!);
      expect(existsSync(absolutePath)).toBe(true);

      const zip = new AdmZip(absolutePath);
      const entryNames = zip.getEntries().map((e) => e.entryName);

      expect(entryNames).toContain('data.json');
      expect(
        entryNames.some(
          (n) => n.startsWith('documents/quotes/') && n.endsWith('.pdf'),
        ),
      ).toBe(true);
      expect(
        entryNames.some(
          (n) => n.startsWith('documents/invoices/') && n.endsWith('.pdf'),
        ),
      ).toBe(true);
      expect(
        entryNames.some((n) =>
          n.startsWith(`documents/photos/${fixture.projectA.id}/`),
        ),
      ).toBe(true);

      const dataJsonEntry = zip.getEntry('data.json')!;
      const parsed = JSON.parse(dataJsonEntry.getData().toString('utf-8')) as {
        profile: { user: { id: string } };
      };
      expect(parsed.profile.user.id).toBe(fixture.user1.id);
      expect(JSON.stringify(parsed)).toContain(fixture.quote.id);
    });
    // Le cas « utilisateur introuvable » est structurellement impossible ici :
    // `FK_data_export_requests_user` (ON DELETE CASCADE) garantit qu'une ligne
    // ne peut exister sans son utilisateur, et sa suppression emporte la
    // demande avec lui. Ce chemin défensif est couvert à l'étage unitaire
    // (`data-export.service.spec.ts`), où les repos mockés permettent de
    // simuler l'état sans violer la contrainte.
  });

  describe('purgeExpiredExports', () => {
    it('efface le fichier et la ligne une fois expiré', async () => {
      const fixture = await seedPopulatedAccount();
      const request = await dataSource.getRepository(DataExportRequest).save({
        user_id: fixture.user1.id,
        status: DataExportStatus.PENDING,
      });
      await service.processExport(request.id);

      await dataSource
        .getRepository(DataExportRequest)
        .update(request.id, { expires_at: new Date(Date.now() - 1000) });

      await service.purgeExpiredExports();

      expect(
        await dataSource
          .getRepository(DataExportRequest)
          .findOneBy({ id: request.id }),
      ).toBeNull();
      expect(
        existsSync(
          join(uploadsPath, `exports/${fixture.user1.id}/${request.id}.zip`),
        ),
      ).toBe(false);
    });
  });
});
