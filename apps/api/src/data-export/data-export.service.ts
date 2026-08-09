import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { existsSync } from 'fs';
import archiver from 'archiver';
import {
  DataExportRequest,
  DataExportStatus,
} from './entities/data-export-request.entity';
import type { StorageProvider } from '../photos/storage/storage.interface';
import { STORAGE_PROVIDER } from '../photos/storage/storage.interface';
import { User } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { OrganizationMembership } from '../organizations/entities/organization-membership.entity';
import { OrganizationInvitation } from '../organizations/entities/organization-invitation.entity';
import { Client } from '../clients/entities/client.entity';
import { CompanyProfile } from '../company-profiles/entities/company-profile.entity';
import { Project } from '../projects/entities/project.entity';
import { Room } from '../projects/entities/room.entity';
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
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionRefund } from '../subscriptions/entities/subscription-refund.entity';
import { QuantityValidation } from '../quantity-validation/entities/quantity-validation.entity';
import { QuantityCorrection } from '../quantity-validation/entities/quantity-correction.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { QuotePdfService } from '../quotes/quote-pdf.service';
import { InvoicePdfService } from '../invoices/invoice-pdf.service';

/**
 * Au-delà de ce délai, une demande restée `processing` est tenue pour
 * abandonnée (crash pendant la génération) — même doctrine que la réservation
 * périmée des events Stripe (`STALE_CLAIM_INTERVAL`), transposée aux heures
 * plutôt qu'aux minutes vu le volume qu'une archive peut représenter.
 */
const STUCK_PROCESSING_HOURS = 2;

/**
 * Entités du dépôt écartées de l'export RGPD (E6-2), avec la raison de
 * l'exclusion. Source unique : reprise telle quelle dans le JSON livré
 * (`_documentation.excluded_entities`) et vérifiée par
 * `entity-coverage.spec.ts` contre la liste réelle des `*.entity.ts` du
 * dépôt — une entité future non classée ici (ni dans `EXPORTED_ENTITIES`) fait
 * échouer ce test plutôt que de sortir silencieusement du périmètre.
 */
export const EXCLUDED_ENTITIES: { table: string; reason: string }[] = [
  {
    table: 'work_types',
    reason:
      'Catalogue de référence global des ouvrages, identique pour tous les comptes.',
  },
  {
    table: 'complementary_materials',
    reason: 'Catalogue de référence global.',
  },
  {
    table: 'materials_catalog',
    reason:
      "Catalogue produit/matériaux global ; modified_by est une trace d'administration système, pas une donnée du compte exporté.",
  },
  {
    table: 'material_packaging',
    reason: 'Catalogue produit/matériaux global.',
  },
  { table: 'waste_factors', reason: 'Catalogue produit/matériaux global.' },
  {
    table: 'labor_times',
    reason:
      'Registre de référence global des temps de pose (E2-1), identique pour tous les comptes.',
  },
  {
    table: 'material_eco_equivalences',
    reason: 'Catalogue produit/matériaux global.',
  },
  {
    table: 'work_type_materials',
    reason: 'Catalogue produit/matériaux global.',
  },
  {
    table: 'learned_waste_factors',
    reason:
      'Agrégat statistique inter-organisations (sample_size), non attribuable à un compte individuel.',
  },
  {
    table: 'cost_benchmarks',
    reason:
      'Données de référence anonymisées par construction (k-anonymat), aucune donnée personnelle.',
  },
  {
    table: 'feature_gates',
    reason: 'Configuration globale de fonctionnalités.',
  },
  {
    table: 'supplier_material_match',
    reason:
      'Cache système de correspondance fournisseurs, non lié à un compte.',
  },
  {
    table: 'supplier_price_cache',
    reason: 'Cache système de prix fournisseurs, non lié à un compte.',
  },
  {
    table: 'stripe_events',
    reason:
      "Registre d'idempotence des webhooks Stripe, aucune référence utilisateur.",
  },
  {
    table: 'email_captures',
    reason:
      "Capture d'email pré-inscription (lead magnet), sans clé étrangère vers users — seule une correspondance par égalité d'adresse serait possible, ce qui risquerait de rattacher au mauvais compte une capture faite avant la création du compte ou par un tiers ayant utilisé la même adresse. Exclue par prudence.",
  },
  {
    table: 'data_export_requests',
    reason:
      "Trace opérationnelle du mécanisme d'export lui-même (statut, chemin de fichier temporaire) — pas une donnée métier du compte.",
  },
];

/** Tables couvertes par l'export, dans le même vocabulaire que `EXCLUDED_ENTITIES`. */
export const EXPORTED_ENTITIES: string[] = [
  'users',
  'organizations',
  'organization_memberships',
  'organization_invitations',
  'projects',
  'rooms',
  'room_dimensions',
  'openings',
  'project_work_items',
  'project_photos',
  'clients',
  'quotes',
  'invoices',
  'company_profiles',
  'estimation_results',
  'shopping_lists',
  'subscriptions',
  'subscription_refunds',
  'referral_credits',
  'analysis_jobs',
  'cv_correction_logs',
  'room_log_entries',
  'site_milestones',
  'community_projects',
  'community_likes',
  'community_comments',
  'lifecycle_email_sends',
  'analytics_events',
  'quantity_validations',
  'quantity_corrections',
];

interface PhotoArchiveRef {
  absolutePath: string;
  archivePath: string;
}

interface QuotePdfRef {
  quote: Quote;
  companyProfile: CompanyProfile;
  client: Client | null;
  archivePath: string;
}

interface InvoicePdfRef {
  invoice: Invoice;
  archivePath: string;
}

interface ExportBundle {
  manifest: Record<string, unknown>;
  photoRefs: PhotoArchiveRef[];
  quotePdfRefs: QuotePdfRef[];
  invoicePdfRefs: InvoicePdfRef[];
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

/** Caractères qu'un nom de fichier fourni par l'appelant ne doit pas porter dans une entrée d'archive. */
function sanitizeArchiveSegment(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 150);
}

/**
 * E6-2 — portabilité RGPD (art. 20).
 *
 * Toujours asynchrone, une seule voie de code : `requestExport` crée une
 * ligne et déclenche `processExport` sans l'attendre (même geste que la
 * génération de vignette dans `PhotosService.uploadPhoto`), jamais dans la
 * requête HTTP. L'archive est écrite en flux sur le volume au fur et à mesure
 * (`archiver` → `StorageProvider.saveStream`) : les photos sont lues depuis le
 * disque une par une (`archive.file`), jamais bufferisées entières par ce
 * service.
 *
 * `buildManifest` est une méthode séparée, pure lecture, sans dépendance à
 * l'archivage — c'est elle que `entity-coverage.spec.ts` et le test
 * d'intégration d'exhaustivité exercent directement.
 */
@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(
    @InjectRepository(DataExportRequest)
    private readonly requestsRepo: Repository<DataExportRequest>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Organization)
    private readonly organizationsRepo: Repository<Organization>,
    @InjectRepository(OrganizationMembership)
    private readonly membershipsRepo: Repository<OrganizationMembership>,
    @InjectRepository(OrganizationInvitation)
    private readonly invitationsRepo: Repository<OrganizationInvitation>,
    @InjectRepository(Client)
    private readonly clientsRepo: Repository<Client>,
    @InjectRepository(CompanyProfile)
    private readonly companyProfilesRepo: Repository<CompanyProfile>,
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(ProjectWorkItem)
    private readonly workItemsRepo: Repository<ProjectWorkItem>,
    @InjectRepository(ProjectPhoto)
    private readonly photosRepo: Repository<ProjectPhoto>,
    @InjectRepository(EstimationResult)
    private readonly estimationsRepo: Repository<EstimationResult>,
    @InjectRepository(ShoppingList)
    private readonly shoppingListsRepo: Repository<ShoppingList>,
    @InjectRepository(AnalysisJob)
    private readonly analysisJobsRepo: Repository<AnalysisJob>,
    @InjectRepository(CvCorrectionLog)
    private readonly cvLogsRepo: Repository<CvCorrectionLog>,
    @InjectRepository(SiteMilestone)
    private readonly milestonesRepo: Repository<SiteMilestone>,
    @InjectRepository(Quote)
    private readonly quotesRepo: Repository<Quote>,
    @InjectRepository(Invoice)
    private readonly invoicesRepo: Repository<Invoice>,
    @InjectRepository(CommunityProject)
    private readonly communityProjectsRepo: Repository<CommunityProject>,
    @InjectRepository(CommunityLike)
    private readonly communityLikesRepo: Repository<CommunityLike>,
    @InjectRepository(CommunityComment)
    private readonly communityCommentsRepo: Repository<CommunityComment>,
    @InjectRepository(ReferralCredit)
    private readonly referralCreditsRepo: Repository<ReferralCredit>,
    @InjectRepository(RoomLogEntry)
    private readonly logbookRepo: Repository<RoomLogEntry>,
    @InjectRepository(LifecycleEmailSend)
    private readonly lifecycleEmailsRepo: Repository<LifecycleEmailSend>,
    @InjectRepository(AnalyticsEvent)
    private readonly analyticsEventsRepo: Repository<AnalyticsEvent>,
    @InjectRepository(Subscription)
    private readonly subscriptionsRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionRefund)
    private readonly refundsRepo: Repository<SubscriptionRefund>,
    @InjectRepository(QuantityValidation)
    private readonly quantityValidationsRepo: Repository<QuantityValidation>,
    @InjectRepository(QuantityCorrection)
    private readonly quantityCorrectionsRepo: Repository<QuantityCorrection>,
    @Inject(STORAGE_PROVIDER)
    private readonly storage: StorageProvider,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly quotePdfService: QuotePdfService,
    private readonly invoicePdfService: InvoicePdfService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Idempotent tant qu'une demande est en cours : une nouvelle requête pendant
   * qu'une autre est `pending`/`processing` renvoie celle-ci plutôt que d'en
   * empiler une seconde qui referait le même travail.
   */
  async requestExport(userId: string): Promise<DataExportRequest> {
    const existing = await this.requestsRepo.findOne({
      where: [
        { user_id: userId, status: DataExportStatus.PENDING },
        { user_id: userId, status: DataExportStatus.PROCESSING },
      ],
      order: { requested_at: 'DESC' },
    });
    if (existing) return existing;

    const request = await this.requestsRepo.save(
      this.requestsRepo.create({
        user_id: userId,
        status: DataExportStatus.PENDING,
      }),
    );

    this.processExport(request.id).catch((err: unknown) => {
      this.logger.error(
        `Échec non rattrapé de l'export ${request.id} : ${errorMessage(err)}`,
      );
    });

    return request;
  }

  async getForUser(
    userId: string,
    requestId: string,
  ): Promise<DataExportRequest | null> {
    return this.requestsRepo.findOne({
      where: { id: requestId, user_id: userId },
    });
  }

  getAbsolutePath(storedPath: string): string {
    return this.storage.getAbsolutePath(storedPath);
  }

  /**
   * Génère l'archive et met à jour la ligne. N'échoue jamais vers l'appelant
   * fire-and-forget de `requestExport` : toute erreur est capturée et
   * consignée dans `error_message`, jamais avalée silencieusement.
   */
  async processExport(requestId: string): Promise<void> {
    const request = await this.requestsRepo.findOne({
      where: { id: requestId },
    });
    if (!request) {
      this.logger.error(`Demande d'export introuvable : ${requestId}`);
      return;
    }

    try {
      await this.requestsRepo.update(requestId, {
        status: DataExportStatus.PROCESSING,
      });

      const { manifest, photoRefs, quotePdfRefs, invoicePdfRefs } =
        await this.buildManifest(request.user_id);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.append(Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8'), {
        name: 'data.json',
      });

      for (const ref of photoRefs) {
        archive.file(ref.absolutePath, { name: ref.archivePath });
      }

      for (const ref of quotePdfRefs) {
        try {
          const buffer = await this.quotePdfService.generatePdf(
            ref.quote,
            ref.companyProfile,
            ref.client,
          );
          archive.append(buffer, { name: ref.archivePath });
        } catch (err) {
          this.logger.warn(
            `PDF du devis ${ref.quote.id} non généré pour l'export ${requestId} : ${errorMessage(err)}`,
          );
        }
      }

      for (const ref of invoicePdfRefs) {
        try {
          const buffer = await this.invoicePdfService.generatePdf(ref.invoice);
          archive.append(buffer, { name: ref.archivePath });
        } catch (err) {
          this.logger.warn(
            `PDF de la facture ${ref.invoice.id} non généré pour l'export ${requestId} : ${errorMessage(err)}`,
          );
        }
      }

      void archive.finalize();

      const storagePath = `exports/${request.user_id}/${request.id}.zip`;
      const stored = await this.storage.saveStream(
        archive,
        storagePath,
        'application/zip',
      );

      const retentionHours = this.config.get<number>(
        'dataExport.retentionHours',
        48,
      );
      const expiresAt = new Date(Date.now() + retentionHours * 3_600_000);

      await this.requestsRepo.update(requestId, {
        status: DataExportStatus.READY,
        file_path: stored.path,
        file_size_bytes: String(stored.bytes),
        completed_at: new Date(),
        expires_at: expiresAt,
      });

      this.logger.log(
        `Export ${requestId} prêt pour l'utilisateur ${request.user_id} (${stored.bytes} octets)`,
      );
    } catch (err) {
      this.logger.error(
        `Échec de l'export ${requestId} pour l'utilisateur ${request.user_id} : ${errorMessage(err)}`,
      );
      await this.requestsRepo.update(requestId, {
        status: DataExportStatus.FAILED,
        error_message: errorMessage(err).slice(0, 2000),
      });
    }
  }

  /**
   * Purge horaire : les archives `ready` expirées (fichier + ligne), et les
   * demandes `processing` bloquées trop longtemps (process interrompu pendant
   * la génération) — mêmes deux gestes que `DataRetentionService`, à l'échelle
   * de cette table. **Horaire** et non quotidien : l'archive porte IBAN/BIC et
   * des coordonnées clients, sa fenêtre de vie ne doit pas déborder de
   * plusieurs heures au-delà de `EXPORT_RETENTION_HOURS`.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpiredExports(): Promise<void> {
    try {
      const now = new Date();

      const expired = await this.requestsRepo.find({
        where: {
          status: DataExportStatus.READY,
          expires_at: LessThanOrEqual(now),
        },
      });
      for (const request of expired) {
        if (request.file_path) {
          await this.storage.delete(request.file_path).catch((err: unknown) => {
            this.logger.warn(
              `Échec de l'effacement du fichier d'export ${request.id} : ${errorMessage(err)}`,
            );
          });
        }
        await this.requestsRepo.delete(request.id);
      }
      if (expired.length > 0) {
        this.logger.log(`${expired.length} export(s) expiré(s) purgé(s).`);
      }

      const stuckBefore = new Date(
        now.getTime() - STUCK_PROCESSING_HOURS * 3_600_000,
      );
      const stuck = await this.requestsRepo.find({
        where: {
          status: DataExportStatus.PROCESSING,
          requested_at: LessThanOrEqual(stuckBefore),
        },
      });
      for (const request of stuck) {
        await this.requestsRepo.update(request.id, {
          status: DataExportStatus.FAILED,
          error_message:
            'Génération interrompue (dépassement du délai) — relancez une nouvelle demande.',
        });
      }
    } catch (err) {
      this.logger.error(
        `Échec de la purge des exports expirés : ${errorMessage(err)}`,
      );
    }
  }

  /**
   * Assemble la donnée exportée pour un compte, sans rien écrire sur disque.
   *
   * Périmètre d'une organisation : **entier**, pas seulement ce que
   * l'utilisateur y a lui-même créé — décision validée avec le produit : un
   * membre voit déjà toute la donnée de ses organisations dans l'application,
   * l'export ne révèle donc rien de nouveau, et c'est ce que promet l'énoncé
   * (« organisations dont il est membre, projets... »).
   */
  async buildManifest(userId: string): Promise<ExportBundle> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Utilisateur introuvable : ${userId}`);
    }

    const photoRefs: PhotoArchiveRef[] = [];
    const quotePdfRefs: QuotePdfRef[] = [];
    const invoicePdfRefs: InvoicePdfRef[] = [];

    const subscription = await this.subscriptionsRepo.findOne({
      where: { user_id: userId },
    });
    const billingHistory = await this.buildBillingHistory(subscription);

    const memberships = await this.membershipsRepo.find({
      where: { user_id: userId },
    });
    const organizationIds = memberships.map((m) => m.organization_id);

    const organizations = await Promise.all(
      organizationIds.map((organizationId) =>
        this.buildOrganizationManifest(
          organizationId,
          userId,
          photoRefs,
          quotePdfRefs,
          invoicePdfRefs,
        ),
      ),
    );

    const [
      ownLikes,
      ownComments,
      referralsAsReferrer,
      referralsAsReferred,
      logbookEntries,
      lifecycleEmails,
      analyticsEvents,
      refunds,
    ] = await Promise.all([
      this.communityLikesRepo.find({ where: { user_id: userId } }),
      this.communityCommentsRepo.find({ where: { user_id: userId } }),
      this.referralCreditsRepo.find({ where: { referrer_user_id: userId } }),
      this.referralCreditsRepo.find({ where: { referred_user_id: userId } }),
      this.logbookRepo.find({ where: { user_id: userId } }),
      this.lifecycleEmailsRepo.find({ where: { user_id: userId } }),
      this.analyticsEventsRepo.find({ where: { user_id: userId } }),
      this.refundsRepo.find({ where: { user_id: userId } }),
    ]);

    const manifest: Record<string, unknown> = {
      _documentation: {
        generated_at: new Date().toISOString(),
        format_version: '1.0',
        purpose:
          "Export des données personnelles du compte Chiffréo, au titre de l'article 20 du RGPD (droit à la portabilité).",
        scope_notes: [
          "Chaque organisation listée sous « organizations » est exportée dans son intégralité (projets, clients, devis, factures…), y compris pour les organisations où ce compte n'est que membre — cohérent avec ce que l'application montre déjà à tout membre.",
          "L'activité communautaire (« community_activity ») ne recense que les likes et commentaires posés PAR ce compte. Les likes/commentaires posés par d'autres comptes sur une publication de ce compte ne sont pas énumérés nominativement ; seul le compteur agrégé déjà public (community_projects[].likes_count) est repris.",
          "Les vignettes de photo ne sont pas incluses (fichier dérivé) ; seule la photo originale l'est, sous documents/photos/.",
          "Les PDF de devis/factures sont regénérés au moment de l'export, à l'identique de ceux téléchargeables depuis l'application.",
        ],
        excluded_entities: EXCLUDED_ENTITIES,
      },
      profile: this.toUserManifest(user, subscription, billingHistory),
      organizations,
      community_activity: {
        likes: ownLikes.map((like) => ({
          id: like.id,
          community_project_id: like.community_project_id,
          created_at: like.created_at,
        })),
        comments: ownComments.map((comment) => ({
          id: comment.id,
          community_project_id: comment.community_project_id,
          content: comment.content,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
          deleted_at: comment.deleted_at,
        })),
      },
      referrals: {
        as_referrer: referralsAsReferrer.map((r) => this.toReferralManifest(r)),
        as_referred: referralsAsReferred.map((r) => this.toReferralManifest(r)),
      },
      logbook_entries: logbookEntries.map((entry) => ({
        id: entry.id,
        project_id: entry.project_id,
        project_name: entry.project_name,
        room_id: entry.room_id,
        room_name: entry.room_name,
        dimensions_snapshot: entry.dimensions_snapshot,
        materials_snapshot: entry.materials_snapshot,
        recorded_at: entry.recorded_at,
        created_at: entry.created_at,
      })),
      lifecycle_emails: lifecycleEmails.map((email) => ({
        id: email.id,
        project_id: email.project_id,
        email_type: email.email_type,
        sent_at: email.sent_at,
      })),
      analytics_events: analyticsEvents.map((event) => ({
        id: event.id,
        event_name: event.event_name,
        properties: event.properties,
        created_at: event.created_at,
      })),
      // E3-3 : exercices du « 30 jours satisfait ou remboursé ». Séparés de
      // `billing_history`, qui vient de Stripe et peut manquer : ces lignes-là
      // sont les nôtres, et elles portent le motif saisi par la personne.
      subscription_refunds: refunds.map((refund) => ({
        id: refund.id,
        stripe_refund_id: refund.stripe_refund_id,
        stripe_invoice_id: refund.stripe_invoice_id,
        amount_cents: refund.amount_cents,
        currency: refund.currency,
        origin: refund.origin,
        reason: refund.reason,
        invoice_paid_at: refund.invoice_paid_at,
        eligible_until: refund.eligible_until,
        created_at: refund.created_at,
      })),
    };

    return { manifest, photoRefs, quotePdfRefs, invoicePdfRefs };
  }

  private async buildOrganizationManifest(
    organizationId: string,
    exportedUserId: string,
    photoRefs: PhotoArchiveRef[],
    quotePdfRefs: QuotePdfRef[],
    invoicePdfRefs: InvoicePdfRef[],
  ): Promise<Record<string, unknown>> {
    const [organization, allMemberships, invitations, clients, companyProfile] =
      await Promise.all([
        this.organizationsRepo.findOne({ where: { id: organizationId } }),
        this.membershipsRepo.find({
          where: { organization_id: organizationId },
        }),
        this.invitationsRepo.find({
          where: { organization_id: organizationId },
        }),
        this.clientsRepo.find({ where: { organization_id: organizationId } }),
        this.companyProfilesRepo.findOne({
          where: { organization_id: organizationId },
        }),
      ]);

    const clientsById = new Map(clients.map((c) => [c.id, c]));

    const projects = await this.projectsRepo.find({
      where: { organization_id: organizationId },
      withDeleted: true,
    });
    const projectIds = projects.map((p) => p.id);
    const roomIds = projects.flatMap((p) => p.rooms.map((r) => r.id));

    const [
      workItems,
      photos,
      estimations,
      shoppingLists,
      analysisJobs,
      cvLogs,
      milestones,
      quotes,
      invoices,
      communityProjects,
      quantityValidations,
      quantityCorrections,
    ] = await Promise.all([
      roomIds.length
        ? this.workItemsRepo.find({ where: { room_id: In(roomIds) } })
        : Promise.resolve([]),
      projectIds.length
        ? this.photosRepo.find({ where: { project_id: In(projectIds) } })
        : Promise.resolve([]),
      projectIds.length
        ? this.estimationsRepo.find({ where: { project_id: In(projectIds) } })
        : Promise.resolve([]),
      projectIds.length
        ? this.shoppingListsRepo.find({ where: { project_id: In(projectIds) } })
        : Promise.resolve([]),
      projectIds.length
        ? this.analysisJobsRepo.find({ where: { project_id: In(projectIds) } })
        : Promise.resolve([]),
      projectIds.length
        ? this.cvLogsRepo.find({ where: { project_id: In(projectIds) } })
        : Promise.resolve([]),
      projectIds.length
        ? this.milestonesRepo.find({ where: { project_id: In(projectIds) } })
        : Promise.resolve([]),
      projectIds.length
        ? this.quotesRepo.find({ where: { project_id: In(projectIds) } })
        : Promise.resolve([]),
      // Contrairement aux devis, une facture peut survivre à la suppression de
      // son projet (`project_id` en SET NULL, conservation légale art. L102 B
      // LPF) : on la récupère par organisation, pas par projet.
      this.invoicesRepo.find({ where: { organization_id: organizationId } }),
      projectIds.length
        ? this.communityProjectsRepo.find({
            where: { project_id: In(projectIds) },
            withDeleted: true,
          })
        : Promise.resolve([]),
      projectIds.length
        ? this.quantityValidationsRepo.find({
            where: { project_id: In(projectIds) },
          })
        : Promise.resolve([]),
      projectIds.length
        ? this.quantityCorrectionsRepo.find({
            where: { project_id: In(projectIds) },
          })
        : Promise.resolve([]),
    ]);

    const workItemsByRoom = groupBy(workItems, (w) => w.room_id);
    const photosByProject = groupBy(photos, (p) => p.project_id);
    const estimationsByProject = groupBy(estimations, (e) => e.project_id);
    const shoppingListByProject = new Map(
      shoppingLists.map((s) => [s.project_id, s]),
    );
    const analysisJobsByProject = groupBy(analysisJobs, (a) => a.project_id);
    const cvLogsByProject = groupBy(cvLogs, (c) => c.project_id);
    const milestonesByProject = groupBy(milestones, (m) => m.project_id);
    const quotesByProject = groupBy(quotes, (q) => q.project_id);
    const invoicesByProject = groupBy(
      invoices.filter((i) => i.project_id !== null),
      (i) => i.project_id as string,
    );
    const invoicesWithoutProject = invoices.filter(
      (i) => i.project_id === null,
    );
    const communityByProject = new Map(
      communityProjects.map((c) => [c.project_id, c]),
    );
    const quantityValidationsByProject = groupBy(
      quantityValidations,
      (v) => v.project_id,
    );
    const quantityCorrectionsByProject = groupBy(
      quantityCorrections,
      (c) => c.project_id,
    );

    for (const photo of photos) {
      const absolutePath = this.storage.getAbsolutePath(photo.storage_url);
      if (existsSync(absolutePath)) {
        photoRefs.push({
          absolutePath,
          archivePath: `documents/photos/${photo.project_id}/${photo.id}-${sanitizeArchiveSegment(photo.original_filename)}`,
        });
      } else {
        this.logger.warn(
          `Photo ${photo.id} absente du volume — exclue de l'export.`,
        );
      }
    }

    for (const quote of quotes) {
      const client = quote.client_id
        ? (clientsById.get(quote.client_id) ?? null)
        : null;
      if (companyProfile) {
        quotePdfRefs.push({
          quote,
          companyProfile,
          client,
          archivePath: `documents/quotes/${quote.id}-${quote.quote_number}.pdf`,
        });
      }
    }
    for (const invoice of invoices) {
      invoicePdfRefs.push({
        invoice,
        archivePath: `documents/invoices/${invoice.id}-${invoice.invoice_number}.pdf`,
      });
    }

    return {
      organization: organization
        ? {
            id: organization.id,
            name: organization.name,
            owner_user_id: organization.owner_user_id,
            is_personal: organization.is_personal,
            created_at: organization.created_at,
            updated_at: organization.updated_at,
          }
        : null,
      my_role:
        allMemberships.find((m) => m.user_id === exportedUserId)?.role ?? null,
      memberships: allMemberships.map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        created_at: m.created_at,
        updated_at: m.updated_at,
      })),
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        invited_by_user_id: inv.invited_by_user_id,
        expires_at: inv.expires_at,
        accepted_at: inv.accepted_at,
        created_at: inv.created_at,
      })),
      company_profile: companyProfile
        ? this.toCompanyProfileManifest(companyProfile)
        : null,
      clients: clients.map((c) => this.toClientManifest(c)),
      invoices_without_project: invoicesWithoutProject.map((i) =>
        this.toInvoiceManifest(i),
      ),
      projects: projects.map((project) =>
        this.toProjectManifest(project, {
          workItemsByRoom,
          photosByProject,
          estimationsByProject,
          shoppingListByProject,
          analysisJobsByProject,
          cvLogsByProject,
          milestonesByProject,
          quotesByProject,
          invoicesByProject,
          communityByProject,
          quantityValidationsByProject,
          quantityCorrectionsByProject,
          hasCompanyProfile: !!companyProfile,
        }),
      ),
    };
  }

  private toProjectManifest(
    project: Project,
    grouped: {
      workItemsByRoom: Map<string, ProjectWorkItem[]>;
      photosByProject: Map<string, ProjectPhoto[]>;
      estimationsByProject: Map<string, EstimationResult[]>;
      shoppingListByProject: Map<string, ShoppingList>;
      analysisJobsByProject: Map<string, AnalysisJob[]>;
      cvLogsByProject: Map<string, CvCorrectionLog[]>;
      milestonesByProject: Map<string, SiteMilestone[]>;
      quotesByProject: Map<string, Quote[]>;
      invoicesByProject: Map<string, Invoice[]>;
      communityByProject: Map<string, CommunityProject>;
      quantityValidationsByProject: Map<string, QuantityValidation[]>;
      quantityCorrectionsByProject: Map<string, QuantityCorrection[]>;
      hasCompanyProfile: boolean;
    },
  ): Record<string, unknown> {
    const shoppingList = grouped.shoppingListByProject.get(project.id) ?? null;
    const communityPublication =
      grouped.communityByProject.get(project.id) ?? null;

    return {
      id: project.id,
      user_id: project.user_id,
      organization_id: project.organization_id,
      name: project.name,
      room_name: project.room_name,
      work_type: project.work_type,
      status: project.status,
      created_at: project.created_at,
      updated_at: project.updated_at,
      deleted_at: project.deleted_at,
      rooms: project.rooms.map((room) =>
        this.toRoomManifest(room, grouped.workItemsByRoom.get(room.id) ?? []),
      ),
      photos: (grouped.photosByProject.get(project.id) ?? []).map((photo) =>
        this.toPhotoManifest(photo),
      ),
      estimation_results: (
        grouped.estimationsByProject.get(project.id) ?? []
      ).map((e) => ({
        id: e.id,
        skill_level: e.skill_level,
        items_json: e.items_json,
        aggregated_json: e.aggregated_json,
        total_items: e.total_items,
        created_at: e.created_at,
      })),
      shopping_list: shoppingList
        ? {
            id: shoppingList.id,
            estimation_id: shoppingList.estimation_id,
            items_json: shoppingList.items_json,
            budget_summary_json: shoppingList.budget_summary_json,
            purchased_on: shoppingList.purchased_on,
            share_token: shoppingList.share_token,
            share_token_created_at: shoppingList.share_token_created_at,
            created_at: shoppingList.created_at,
            updated_at: shoppingList.updated_at,
          }
        : null,
      analysis_jobs: (grouped.analysisJobsByProject.get(project.id) ?? []).map(
        (j) => ({
          id: j.id,
          status: j.status,
          progress_pct: j.progress_pct,
          result_json: j.result_json,
          error_message: j.error_message,
          started_at: j.started_at,
          completed_at: j.completed_at,
          created_at: j.created_at,
        }),
      ),
      cv_correction_logs: (grouped.cvLogsByProject.get(project.id) ?? []).map(
        (c) => ({
          id: c.id,
          analysis_job_id: c.analysis_job_id,
          entity_type: c.entity_type,
          field: c.field,
          cv_value: c.cv_value,
          user_value: c.user_value,
          created_at: c.created_at,
        }),
      ),
      site_milestones: (grouped.milestonesByProject.get(project.id) ?? []).map(
        (m) => ({
          id: m.id,
          label: m.label,
          status: m.status,
          planned_date: m.planned_date,
          actual_date: m.actual_date,
          sort_order: m.sort_order,
          created_at: m.created_at,
          updated_at: m.updated_at,
        }),
      ),
      quotes: (grouped.quotesByProject.get(project.id) ?? []).map((q) =>
        this.toQuoteManifest(q, grouped.hasCompanyProfile),
      ),
      // E2-4 : la trace de validation des quantités et les corrections
      // manuelles. Exportées sous le projet, qui est leur périmètre naturel :
      // c'est le chantier qu'un litige désigne, pas le compte.
      quantity_validations: (
        grouped.quantityValidationsByProject.get(project.id) ?? []
      ).map((v) => this.toQuantityValidationManifest(v)),
      quantity_corrections: (
        grouped.quantityCorrectionsByProject.get(project.id) ?? []
      ).map((c) => this.toQuantityCorrectionManifest(c)),
      invoices: (grouped.invoicesByProject.get(project.id) ?? []).map((i) =>
        this.toInvoiceManifest(i),
      ),
      community_publication: communityPublication
        ? {
            id: communityPublication.id,
            work_type: communityPublication.work_type,
            title: communityPublication.title,
            description: communityPublication.description,
            purchase_list_json: communityPublication.purchase_list_json,
            budget_summary_json: communityPublication.budget_summary_json,
            total_cost_cents: communityPublication.total_cost_cents,
            duration_days: communityPublication.duration_days,
            length_cm: communityPublication.length_cm,
            width_cm: communityPublication.width_cm,
            height_cm: communityPublication.height_cm,
            before_photo_ids: communityPublication.before_photo_ids,
            after_photo_ids: communityPublication.after_photo_ids,
            moderation_status: communityPublication.moderation_status,
            rejection_reason: communityPublication.rejection_reason,
            gdpr_consent: communityPublication.gdpr_consent,
            gdpr_consent_at: communityPublication.gdpr_consent_at,
            likes_count: communityPublication.likes_count,
            published_at: communityPublication.published_at,
            created_at: communityPublication.created_at,
            updated_at: communityPublication.updated_at,
            deleted_at: communityPublication.deleted_at,
          }
        : null,
    };
  }

  private toQuantityValidationManifest(
    validation: QuantityValidation,
  ): Record<string, unknown> {
    return {
      id: validation.id,
      organization_id: validation.organization_id,
      user_id: validation.user_id,
      user_email: validation.user_email,
      quantities_fingerprint: validation.quantities_fingerprint,
      quantities_json: validation.quantities_json,
      line_count: validation.line_count,
      validated_at: validation.validated_at,
    };
  }

  private toQuantityCorrectionManifest(
    correction: QuantityCorrection,
  ): Record<string, unknown> {
    return {
      id: correction.id,
      organization_id: correction.organization_id,
      user_id: correction.user_id,
      material_id: correction.material_id,
      material_name: correction.material_name,
      material_unit: correction.material_unit,
      packaging_label: correction.packaging_label,
      work_type_code: correction.work_type_code,
      work_type_label: correction.work_type_label,
      skill_level: correction.skill_level,
      computed_units: correction.computed_units,
      previous_units: correction.previous_units,
      corrected_units: correction.corrected_units,
      relative_deviation: correction.relative_deviation,
      source: correction.source,
      corrected_at: correction.corrected_at,
    };
  }

  private toRoomManifest(
    room: Room,
    workItems: ProjectWorkItem[],
  ): Record<string, unknown> {
    const dimensions = room.dimensions;
    return {
      id: room.id,
      name: room.name,
      sort_order: room.sort_order,
      created_at: room.created_at,
      updated_at: room.updated_at,
      dimensions: dimensions
        ? {
            length_cm: dimensions.length_cm,
            width_cm: dimensions.width_cm,
            height_cm: dimensions.height_cm,
            confidence_score: dimensions.confidence_score,
            source: dimensions.source,
            raw_cv_output_json: dimensions.raw_cv_output_json,
            length_cm_uncertainty: dimensions.length_cm_uncertainty,
            width_cm_uncertainty: dimensions.width_cm_uncertainty,
            height_cm_uncertainty: dimensions.height_cm_uncertainty,
            segments_json: dimensions.segments_json,
            exclusions_json: dimensions.exclusions_json,
            created_at: dimensions.created_at,
            updated_at: dimensions.updated_at,
          }
        : null,
      openings: room.openings.map((opening) => ({
        id: opening.id,
        type: opening.type,
        width_cm: opening.width_cm,
        height_cm: opening.height_cm,
        count: opening.count,
        source: opening.source,
        cv_confidence: opening.cv_confidence,
        created_at: opening.created_at,
        updated_at: opening.updated_at,
      })),
      work_items: workItems.map((item) => ({
        id: item.id,
        skill_level: item.skill_level,
        custom_params: item.custom_params,
        work_type: {
          id: item.work_type.id,
          code: item.work_type.code,
          label_fr: item.work_type.label_fr,
        },
        created_at: item.created_at,
        updated_at: item.updated_at,
      })),
    };
  }

  private toPhotoManifest(photo: ProjectPhoto): Record<string, unknown> {
    const absolutePath = this.storage.getAbsolutePath(photo.storage_url);
    return {
      id: photo.id,
      original_filename: photo.original_filename,
      mime_type: photo.mime_type,
      size_bytes: photo.size_bytes,
      status: photo.status,
      sort_order: photo.sort_order,
      created_at: photo.created_at,
      updated_at: photo.updated_at,
      file: existsSync(absolutePath)
        ? `documents/photos/${photo.project_id}/${photo.id}-${sanitizeArchiveSegment(photo.original_filename)}`
        : null,
    };
  }

  private toQuoteManifest(
    quote: Quote,
    hasCompanyProfile: boolean,
  ): Record<string, unknown> {
    return {
      id: quote.id,
      user_id: quote.user_id,
      client_id: quote.client_id,
      estimation_id: quote.estimation_id,
      quote_number: quote.quote_number,
      status: quote.status,
      labor_items_json: quote.labor_items_json,
      material_margin_percent: quote.material_margin_percent,
      discount_percent: quote.discount_percent,
      payment_terms: quote.payment_terms,
      validity_days: quote.validity_days,
      notes: quote.notes,
      items_json: quote.items_json,
      subtotal_materials_ht: quote.subtotal_materials_ht,
      subtotal_labor_ht: quote.subtotal_labor_ht,
      total_ht: quote.total_ht,
      tva_rate: quote.tva_rate,
      total_ttc: quote.total_ttc,
      sent_at: quote.sent_at,
      accepted_at: quote.accepted_at,
      refused_at: quote.refused_at,
      reminder_7d_sent_at: quote.reminder_7d_sent_at,
      reminder_14d_sent_at: quote.reminder_14d_sent_at,
      created_at: quote.created_at,
      updated_at: quote.updated_at,
      pdf_file: hasCompanyProfile
        ? `documents/quotes/${quote.id}-${quote.quote_number}.pdf`
        : null,
      pdf_skip_reason: hasCompanyProfile ? null : 'no_company_profile',
    };
  }

  private toInvoiceManifest(invoice: Invoice): Record<string, unknown> {
    return {
      id: invoice.id,
      user_id: invoice.user_id,
      quote_id: invoice.quote_id,
      project_id: invoice.project_id,
      client_id: invoice.client_id,
      invoice_number: invoice.invoice_number,
      invoice_type: invoice.invoice_type,
      status: invoice.status,
      source_quote_number: invoice.source_quote_number,
      issued_on: invoice.issued_on,
      supply_date: invoice.supply_date,
      due_on: invoice.due_on,
      currency: invoice.currency,
      seller_snapshot: invoice.seller_snapshot,
      buyer_snapshot: invoice.buyer_snapshot,
      buyer_siren: invoice.buyer_siren,
      delivery_address: invoice.delivery_address,
      operation_category: invoice.operation_category,
      vat_on_debits: invoice.vat_on_debits,
      items_json: invoice.items_json,
      vat_breakdown: invoice.vat_breakdown,
      total_ht: invoice.total_ht,
      total_tva: invoice.total_tva,
      total_ttc: invoice.total_ttc,
      payment_terms: invoice.payment_terms,
      late_penalty_rate: invoice.late_penalty_rate,
      notes: invoice.notes,
      paid_at: invoice.paid_at,
      created_at: invoice.created_at,
      updated_at: invoice.updated_at,
      pdf_file: `documents/invoices/${invoice.id}-${invoice.invoice_number}.pdf`,
    };
  }

  private toClientManifest(client: Client): Record<string, unknown> {
    return {
      id: client.id,
      user_id: client.user_id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      address_line1: client.address_line1,
      address_line2: client.address_line2,
      postal_code: client.postal_code,
      city: client.city,
      is_company: client.is_company,
      siret: client.siret,
      vat_number: client.vat_number,
      country: client.country,
      created_at: client.created_at,
      updated_at: client.updated_at,
    };
  }

  private toCompanyProfileManifest(
    profile: CompanyProfile,
  ): Record<string, unknown> {
    return {
      id: profile.id,
      user_id: profile.user_id,
      raison_sociale: profile.raison_sociale,
      siret: profile.siret,
      address_line1: profile.address_line1,
      address_line2: profile.address_line2,
      postal_code: profile.postal_code,
      city: profile.city,
      country: profile.country,
      phone: profile.phone,
      specialties: profile.specialties,
      legal_form: profile.legal_form,
      capital_social: profile.capital_social,
      vat_number: profile.vat_number,
      vat_exempt: profile.vat_exempt,
      rcs_city: profile.rcs_city,
      rm_department: profile.rm_department,
      insurance_name: profile.insurance_name,
      insurance_policy: profile.insurance_policy,
      insurance_coverage: profile.insurance_coverage,
      iban: profile.iban,
      bic: profile.bic,
      email: profile.email,
      late_penalty_rate: profile.late_penalty_rate,
      default_payment_terms_days: profile.default_payment_terms_days,
      default_labor_hourly_rate: profile.default_labor_hourly_rate,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };
  }

  private toReferralManifest(credit: ReferralCredit): Record<string, unknown> {
    return {
      id: credit.id,
      referrer_user_id: credit.referrer_user_id,
      referred_user_id: credit.referred_user_id,
      amount_cents: credit.amount_cents,
      currency: credit.currency,
      status: credit.status,
      applied_at: credit.applied_at,
      created_at: credit.created_at,
    };
  }

  private toUserManifest(
    user: User,
    subscription: Subscription | null,
    billingHistory: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      user: {
        id: user.id,
        email: user.email,
        auth_provider: user.auth_provider,
        subscription_tier: user.subscription_tier,
        role: user.role,
        email_verified: user.email_verified,
        referral_code: user.referral_code,
        referred_by_user_id: user.referred_by_user_id,
        referral_converted_at: user.referral_converted_at,
        active_organization_id: user.active_organization_id,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      subscription: subscription
        ? {
            id: subscription.id,
            stripe_customer_id: subscription.stripe_customer_id,
            stripe_subscription_id: subscription.stripe_subscription_id,
            stripe_price_id: subscription.stripe_price_id,
            status: subscription.status,
            current_period_start: subscription.current_period_start,
            current_period_end: subscription.current_period_end,
            trial_end: subscription.trial_end,
            cancel_at_period_end: subscription.cancel_at_period_end,
            past_due_since: subscription.past_due_since,
            created_at: subscription.created_at,
            updated_at: subscription.updated_at,
          }
        : null,
      billing_history: billingHistory,
    };
  }

  /**
   * Dégrade sans faire échouer tout l'export : un incident Stripe (réseau,
   * clé absente en environnement de test) ne doit pas priver le compte du
   * reste de ses données.
   */
  private async buildBillingHistory(
    subscription: Subscription | null,
  ): Promise<Record<string, unknown>> {
    if (!subscription) {
      return { available: false, reason: 'no_stripe_customer', entries: [] };
    }
    try {
      const entries = await this.subscriptionsService.listBillingHistory(
        subscription.stripe_customer_id,
      );
      return { available: true, entries };
    } catch (err) {
      this.logger.warn(
        `Historique de facturation Stripe indisponible pour ${subscription.user_id} : ${errorMessage(err)}`,
      );
      return { available: false, reason: 'stripe_unavailable', entries: [] };
    }
  }
}
