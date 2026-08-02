import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import {
  Subscription,
  SubscriptionStatus,
} from './entities/subscription.entity';
import { StripeEvent } from './entities/stripe-event.entity';
import { UsersService } from '../users/users.service';
import { SubscriptionTier } from '../users/entities/user.entity';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';
import { ReferralsService } from '../referrals/referrals.service';

/**
 * Au-delà de ce délai, une réservation d'event Stripe sans traitement abouti est
 * tenue pour abandonnée et redevient reprenable (cf. `claimWebhookEvent`).
 *
 * Le seuil doit dépasser largement la durée d'un handler — quelques appels
 * Stripe et quelques écritures, de l'ordre de la seconde — sans quoi une
 * livraison lente serait traitée deux fois. Même fenêtre que la reprise des
 * analyses CV abandonnées (`reclaimStaleJobs`), par cohérence de lecture.
 */
const STALE_CLAIM_INTERVAL = '15 minutes';

@Injectable()
export class SubscriptionsService {
  private readonly stripeClient: Stripe | null;
  private readonly webhookSecret: string;
  private readonly proPriceId: string;
  private readonly priceIdToTier: Map<string, SubscriptionTier>;
  private readonly contractorPriceIds: Set<string>;
  private readonly allowedPriceIds: Set<string>;
  private readonly publicUrl: string;
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionsRepo: Repository<Subscription>,
    @InjectRepository(StripeEvent)
    private readonly stripeEventsRepo: Repository<StripeEvent>,
    private readonly usersService: UsersService,
    private readonly analyticsService: AnalyticsService,
    private readonly referralsService: ReferralsService,
    private readonly config: ConfigService,
  ) {
    const secretKey = this.config.get<string>('stripe.secretKey');
    if (secretKey) {
      this.stripeClient = new Stripe(secretKey);
    } else {
      // La validation d'env garantit la clé en production ; en dev, l'app
      // démarre sans Stripe et les endpoints de paiement renvoient 503.
      this.stripeClient = null;
      this.logger.warn(
        'STRIPE_SECRET_KEY absente — les paiements sont désactivés (dev uniquement).',
      );
    }
    this.webhookSecret = this.config.get<string>('stripe.webhookSecret')!;
    this.proPriceId = this.config.get<string>('stripe.proPriceId')!;
    this.publicUrl = this.config.get<string>('publicUrl')!;

    this.priceIdToTier = new Map<string, SubscriptionTier>();
    const essentielPriceId = this.config.get<string>(
      'stripe.contractorEssentielPriceId',
    );
    const standardPriceId = this.config.get<string>(
      'stripe.contractorStandardPriceId',
    );
    const premiumPriceId = this.config.get<string>(
      'stripe.contractorPremiumPriceId',
    );
    if (essentielPriceId)
      this.priceIdToTier.set(
        essentielPriceId,
        SubscriptionTier.CONTRACTOR_ESSENTIEL,
      );
    if (standardPriceId)
      this.priceIdToTier.set(
        standardPriceId,
        SubscriptionTier.CONTRACTOR_STANDARD,
      );
    if (premiumPriceId)
      this.priceIdToTier.set(
        premiumPriceId,
        SubscriptionTier.CONTRACTOR_PREMIUM,
      );

    this.contractorPriceIds = new Set(this.priceIdToTier.keys());

    this.allowedPriceIds = new Set<string>([
      this.proPriceId,
      ...this.contractorPriceIds,
    ]);
  }

  private get stripe(): Stripe {
    if (!this.stripeClient) {
      throw new ServiceUnavailableException(
        'Les paiements sont temporairement indisponibles.',
      );
    }
    return this.stripeClient;
  }

  async getSubscription(userId: string): Promise<Subscription | null> {
    return this.subscriptionsRepo.findOne({ where: { user_id: userId } });
  }

  async createCheckoutSession(
    user: { id: string; email: string | null },
    priceId?: string,
  ): Promise<{ url: string }> {
    const selectedPriceId = priceId ?? this.proPriceId;
    if (!this.allowedPriceIds.has(selectedPriceId)) {
      throw new BadRequestException('Offre invalide.');
    }
    const isContractor = this.contractorPriceIds.has(selectedPriceId);
    let customerId: string;

    const existing = await this.subscriptionsRepo.findOne({
      where: { user_id: user.id },
    });

    if (existing) {
      if (
        existing.status === SubscriptionStatus.ACTIVE ||
        existing.status === SubscriptionStatus.TRIALING
      ) {
        throw new BadRequestException('Vous avez deja un abonnement actif.');
      }
      customerId = existing.stripe_customer_id;
    } else {
      const customer = await this.stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;

      // COM-3 : ce parrain a peut-être des crédits de parrainage en attente
      // (accumulés avant d'avoir jamais eu de customer Stripe) — best-effort,
      // ne doit jamais faire échouer le checkout en cours.
      try {
        await this.referralsService.applyPendingCreditsForNewCustomer(
          user.id,
          customerId,
        );
      } catch (error) {
        this.logger.error(
          `Echec de l'application des crédits de parrainage en attente pour ${user.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: selectedPriceId, quantity: 1 }],
      ...(isContractor ? {} : { subscription_data: { trial_period_days: 7 } }),
      success_url: `${this.publicUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.publicUrl}/subscription/cancel`,
      metadata: { user_id: user.id },
    });

    this.analyticsService.track(AnalyticsEventName.CHECKOUT_STARTED, user.id, {
      plan: this.resolvePlanName(selectedPriceId),
      price_id: selectedPriceId,
    });

    return { url: session.url! };
  }

  async createPortalSession(userId: string): Promise<{ url: string }> {
    const subscription = await this.subscriptionsRepo.findOne({
      where: { user_id: userId },
    });

    if (!subscription) {
      throw new BadRequestException('Aucun abonnement trouve.');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${this.publicUrl}/dashboard`,
    });

    return { url: session.url };
  }

  /**
   * Résilie l'abonnement Stripe puis efface la ligne locale, dans cet ordre —
   * préalable obligatoire à la suppression d'un compte.
   *
   * Jusqu'ici `FK_subscriptions_user ON DELETE CASCADE` faisait disparaître la
   * ligne avec l'utilisateur : l'abonnement restait actif chez Stripe, et le
   * `stripe_customer_id` qui aurait permis d'ouvrir le portail partait avec
   * elle. La facturation continuait donc sans moyen local de l'arrêter. La FK
   * est passée en `RESTRICT` (migration 1711468800061) : ce chemin est
   * désormais le seul par lequel un abonné peut être supprimé.
   *
   * L'erreur Stripe n'est **pas** avalée. Échouer ici annule toute la
   * suppression et la laisse rejouable ; la traiter en best-effort rétablirait
   * exactement le défaut que cette méthode corrige — un compte effacé et un
   * prélèvement qui continue.
   */
  async cancelForAccountDeletion(userId: string): Promise<void> {
    const subscription = await this.subscriptionsRepo.findOne({
      where: { user_id: userId },
    });
    if (!subscription) return;

    // `canceled`/`incomplete_expired` n'ont plus rien à résilier ; tous les
    // autres statuts sont facturables ou le redeviennent (`past_due`, `unpaid`).
    const terminalStatuses: SubscriptionStatus[] = [
      SubscriptionStatus.CANCELED,
      SubscriptionStatus.INCOMPLETE_EXPIRED,
    ];
    if (!terminalStatuses.includes(subscription.status)) {
      try {
        await this.stripe.subscriptions.cancel(
          subscription.stripe_subscription_id,
        );
      } catch (error) {
        // Déjà résilié côté Stripe (résiliation manuelle, reprise après un
        // échec partiel) : la postcondition « plus rien n'est facturé » est
        // atteinte, on peut effacer la ligne. Idempotence du chemin de reprise.
        //
        // Reconnu à la forme (`type` + `code`) plutôt qu'avec `instanceof` : la
        // seconde forme n'est vraie que pour les erreurs issues de l'exemplaire
        // de SDK effectivement chargé, ce qui en fait un test qui passe en
        // production et ment partout ailleurs. Les deux champs ensemble sont
        // assez spécifiques pour ne pas avaler autre chose.
        const stripeError = error as { type?: string; code?: string };
        if (
          stripeError?.type !== 'StripeInvalidRequestError' ||
          stripeError?.code !== 'resource_missing'
        ) {
          throw error;
        }
        this.logger.warn(
          `Abonnement ${subscription.stripe_subscription_id} déjà absent de Stripe — suppression locale poursuivie.`,
        );
      }
    }

    await this.subscriptionsRepo.delete({ id: subscription.id });
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );
  }

  /**
   * Réserve un event Stripe pour traitement. Renvoie false si l'event est déjà
   * traité, ou si une autre livraison est en train de le traiter : il doit
   * alors être ignoré.
   *
   * `INSERT … ON CONFLICT DO UPDATE` en **une seule instruction**, donc sous le
   * verrou de ligne de PostgreSQL — deux livraisons simultanées ne peuvent pas
   * réserver ensemble. Quatre cas, dans l'ordre où la base les tranche :
   *
   * 1. aucune ligne → insertion, réservé ;
   * 2. ligne déjà traitée (`processed_at` non nul) → le `WHERE` du `DO UPDATE`
   *    est faux, rien n'est retourné → doublon, ignoré. C'est l'idempotence
   *    que la table existe pour garantir ;
   * 3. réservation **périmée** et jamais menée à terme → reprise. Sans ce cas,
   *    un arrêt du processus entre la réservation et le traitement gelait
   *    l'event pour toujours : tous les retries Stripe recevaient
   *    `200 duplicate` alors que l'effet métier n'avait pas eu lieu ;
   * 4. réservation fraîche → doublon, ignoré. Le retry Stripe suivant retombera
   *    sur le cas 2 (traité) ou le cas 3 (abandonné), jamais entre les deux.
   *
   * La réponse se lit dans `raw` (le `RETURNING` de PostgreSQL) et **pas** dans
   * `identifiers` : `event_id` étant fourni par l'appelant et non généré,
   * TypeORM garnit `identifiers` depuis les valeurs d'entrée sans jamais
   * consulter la base. Le test s'y fiant était donc toujours vrai — tout retry
   * repassait dans le traitement (surclassement rejoué, crédit de parrainage
   * compté deux fois). Couvert par `test/integration/persistence.int-spec.ts`.
   *
   * Résidu assumé : un arrêt du processus entre le commit de l'effet métier et
   * `markWebhookEventProcessed` fait rejouer cet effet à l'expiration du délai.
   * C'est le sens de la garantie Stripe (*at-least-once*), et l'inverse exact du
   * défaut corrigé ici — une perte définitive. L'annuler demanderait de marquer
   * l'event dans la transaction de chaque handler.
   */
  async claimWebhookEvent(event: Stripe.Event): Promise<boolean> {
    const rows: unknown[] = await this.stripeEventsRepo.query(
      `
      INSERT INTO "stripe_events" ("event_id", "event_type", "claimed_at")
      VALUES ($1, $2, now())
      ON CONFLICT ("event_id") DO UPDATE
        SET "claimed_at" = now()
        WHERE "stripe_events"."processed_at" IS NULL
          AND "stripe_events"."claimed_at" < now() - $3::interval
      RETURNING "event_id"
      `,
      [event.id, event.type, STALE_CLAIM_INTERVAL],
    );
    return rows.length > 0;
  }

  /**
   * Acte la réussite du traitement. Tant que ce marquage n'a pas eu lieu, la
   * réservation reste reprenable — c'est ce qui distingue « en cours » de
   * « terminé ».
   */
  async markWebhookEventProcessed(eventId: string): Promise<void> {
    await this.stripeEventsRepo.update(
      { event_id: eventId },
      { processed_at: new Date() },
    );
  }

  /**
   * Libère un event dont le traitement a échoué, pour que le retry Stripe
   * puisse le rejouer sans attendre l'expiration de la réservation.
   */
  async releaseWebhookEvent(eventId: string): Promise<void> {
    await this.stripeEventsRepo.delete({ event_id: eventId });
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private extractPriceId(stripeSub: Stripe.Subscription): string | null {
    return stripeSub.items?.data?.[0]?.price?.id ?? null;
  }

  private extractPeriodFromSubscription(stripeSub: Stripe.Subscription): {
    start: Date | null;
    end: Date | null;
  } {
    const firstItem = stripeSub.items?.data?.[0];
    if (!firstItem) return { start: null, end: null };
    return {
      start: new Date(firstItem.current_period_start * 1000),
      end: new Date(firstItem.current_period_end * 1000),
    };
  }

  private extractSubscriptionIdFromInvoice(
    invoice: Stripe.Invoice,
  ): string | null {
    const subDetails = invoice.parent?.subscription_details;
    if (!subDetails) return null;
    return typeof subDetails.subscription === 'string'
      ? subDetails.subscription
      : (subDetails.subscription?.id ?? null);
  }

  private resolvePlanName(priceId: string | null): string {
    if (!priceId) return 'pro';
    return this.priceIdToTier.get(priceId) ?? 'pro';
  }

  private async handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const userId = session.metadata?.user_id;
    if (!userId || !session.subscription || !session.customer) return;

    const stripeSubscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;

    const stripeCustomerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer.id;

    const stripeSub = await this.stripe.subscriptions.retrieve(
      stripeSubscriptionId,
      {
        expand: ['items.data'],
      },
    );

    const period = this.extractPeriodFromSubscription(stripeSub);
    const priceId = this.extractPriceId(stripeSub);

    await this.subscriptionsRepo.upsert(
      {
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_price_id: priceId,
        status: stripeSub.status as SubscriptionStatus,
        current_period_start: period.start,
        current_period_end: period.end,
        trial_end: stripeSub.trial_end
          ? new Date(stripeSub.trial_end * 1000)
          : null,
        cancel_at_period_end: stripeSub.cancel_at_period_end,
      },
      ['user_id'],
    );

    await this.syncSubscriptionTier(userId, stripeSub.status, priceId);

    const planName = this.resolvePlanName(priceId);
    this.analyticsService.track(
      AnalyticsEventName.SUBSCRIPTION_STARTED,
      userId,
      {
        plan: planName,
        trial: stripeSub.status === 'trialing',
      },
    );
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const stripeSubscriptionId = this.extractSubscriptionIdFromInvoice(invoice);
    if (!stripeSubscriptionId) return;

    const subscription = await this.subscriptionsRepo.findOne({
      where: { stripe_subscription_id: stripeSubscriptionId },
    });
    if (!subscription) return;

    const stripeSub = await this.stripe.subscriptions.retrieve(
      stripeSubscriptionId,
      {
        expand: ['items.data'],
      },
    );

    const period = this.extractPeriodFromSubscription(stripeSub);
    const priceId = this.extractPriceId(stripeSub);

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.current_period_start = period.start;
    subscription.current_period_end = period.end;
    subscription.stripe_price_id = priceId;
    await this.subscriptionsRepo.save(subscription);

    await this.syncSubscriptionTier(subscription.user_id, 'active', priceId);

    // COM-3 : premier paiement réel (pas un simple essai) — déclencheur du
    // crédit de parrainage. Volontairement non catché : la méthode est
    // idempotente au retry Stripe, une erreur ici doit continuer à déclencher
    // releaseWebhookEvent + retry plutôt que d'être avalée silencieusement.
    await this.referralsService.handleReferredUserConverted(
      subscription.user_id,
    );
  }

  private async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    const stripeSubscriptionId = this.extractSubscriptionIdFromInvoice(invoice);
    if (!stripeSubscriptionId) return;

    const subscription = await this.subscriptionsRepo.findOne({
      where: { stripe_subscription_id: stripeSubscriptionId },
    });
    if (!subscription) return;

    subscription.status = SubscriptionStatus.PAST_DUE;
    await this.subscriptionsRepo.save(subscription);

    const planName = this.resolvePlanName(subscription.stripe_price_id);
    this.analyticsService.track(
      AnalyticsEventName.PAYMENT_FAILED,
      subscription.user_id,
      {
        plan: planName,
      },
    );
  }

  private async handleSubscriptionUpdated(
    stripeSub: Stripe.Subscription,
  ): Promise<void> {
    const subscription = await this.subscriptionsRepo.findOne({
      where: { stripe_subscription_id: stripeSub.id },
    });
    if (!subscription) return;

    const period = this.extractPeriodFromSubscription(stripeSub);
    const priceId = this.extractPriceId(stripeSub);

    subscription.status = stripeSub.status as SubscriptionStatus;
    subscription.cancel_at_period_end = stripeSub.cancel_at_period_end;
    subscription.current_period_start = period.start;
    subscription.current_period_end = period.end;
    subscription.stripe_price_id = priceId;
    subscription.trial_end = stripeSub.trial_end
      ? new Date(stripeSub.trial_end * 1000)
      : null;

    await this.subscriptionsRepo.save(subscription);
    await this.syncSubscriptionTier(
      subscription.user_id,
      stripeSub.status,
      priceId,
    );
  }

  private async handleSubscriptionDeleted(
    stripeSub: Stripe.Subscription,
  ): Promise<void> {
    const subscription = await this.subscriptionsRepo.findOne({
      where: { stripe_subscription_id: stripeSub.id },
    });
    if (!subscription) return;

    subscription.status = SubscriptionStatus.CANCELED;
    await this.subscriptionsRepo.save(subscription);

    await this.syncSubscriptionTier(subscription.user_id, 'canceled');

    const planName = this.resolvePlanName(subscription.stripe_price_id);
    this.analyticsService.track(
      AnalyticsEventName.SUBSCRIPTION_CANCELED,
      subscription.user_id,
      {
        plan: planName,
      },
    );
  }

  private async syncSubscriptionTier(
    userId: string,
    stripeStatus: string,
    stripePriceId?: string | null,
  ): Promise<void> {
    const activeStatuses = ['trialing', 'active', 'past_due'];
    if (!activeStatuses.includes(stripeStatus)) {
      await this.usersService.updateSubscriptionTier(
        userId,
        SubscriptionTier.FREE,
      );
      return;
    }

    const tier = stripePriceId
      ? (this.priceIdToTier.get(stripePriceId) ?? SubscriptionTier.PRO)
      : SubscriptionTier.PRO;

    await this.usersService.updateSubscriptionTier(userId, tier);
  }
}
