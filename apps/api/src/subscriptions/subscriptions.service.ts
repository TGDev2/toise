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
import { PLANS } from './plans.constants';

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
  private readonly priceIdToTrialDays: Map<string, number>;
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

    // La durée d'essai vient de `PLANS` et de nulle part ailleurs. Elle était
    // auparavant déduite de « ce prix est-il un prix contractor ? », ce qui
    // faisait de `trial_days` une donnée décorative : le palier artisan la
    // déclarait, le checkout l'ignorait. Deux sources pour un même fait, dont
    // une seule appliquée — celle qu'on ne lit pas en relisant la grille.
    this.priceIdToTrialDays = new Map<string, number>();
    for (const plan of PLANS) {
      const priceId = this.config.get<string>(plan.priceIdConfigKey);
      if (priceId) this.priceIdToTrialDays.set(priceId, plan.trial_days);
    }
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
    const trialDays = this.priceIdToTrialDays.get(selectedPriceId) ?? 0;
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
      ...(trialDays > 0
        ? { subscription_data: { trial_period_days: trialDays } }
        : {}),
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
    // Date d'**émission** chez Stripe, pas de réception ici : c'est elle qui
    // ordonne les événements entre eux (cf. `applyEventState`).
    const occurredAt = new Date(event.created * 1000);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object, occurredAt);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object, occurredAt);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object, occurredAt);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object, occurredAt);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object, occurredAt);
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Écrit un état d'abonnement issu d'un événement Stripe, **sauf** si un
   * événement plus récent a déjà été appliqué à cette ligne.
   *
   * Stripe garantit la livraison, jamais l'ordre. Sans cette garde, deux
   * événements qui se doublent produisaient le dernier **arrivé** et non le
   * dernier **émis** : une résiliation suivie d'un `customer.subscription.updated`
   * retardé (émis avant elle, livré après) remettait `status = active` et
   * rappelait `syncSubscriptionTier` — l'abonné retrouvait un palier qu'il ne
   * payait plus, sans qu'aucun événement ultérieur ne vienne le corriger.
   *
   * La comparaison et l'écriture sont **une seule instruction SQL**, donc sous
   * le verrou de ligne de PostgreSQL : deux livraisons concurrentes ne peuvent
   * pas lire le même filigrane puis s'écrire l'une sur l'autre. Même raison
   * qu'au `INSERT … ON CONFLICT` de `claimWebhookEvent` — un `SELECT` suivi
   * d'un `UPDATE` aurait rouvert la course qu'il prétend fermer.
   *
   * Résidu assumé : `event.created` est à la seconde. Deux événements émis dans
   * la même seconde restent départagés par leur ordre d'arrivée (`<=`, le
   * dernier écrit gagne). La fenêtre de désordre passe d'illimitée à une
   * seconde ; l'objet `Subscription` de l'API Stripe n'expose aucun numéro de
   * version qui permettrait de descendre plus bas.
   *
   * @returns `true` si l'état a été écrit, `false` s'il a été écarté comme
   * périmé — l'appelant doit alors s'abstenir de synchroniser le palier.
   */
  private async applyEventState(
    subscriptionRowId: string,
    occurredAt: Date,
    patch: Partial<Subscription>,
  ): Promise<boolean> {
    const result = await this.subscriptionsRepo
      .createQueryBuilder()
      .update(Subscription)
      .set({ ...patch, last_stripe_event_at: occurredAt })
      .where('id = :id', { id: subscriptionRowId })
      .andWhere(
        '("last_stripe_event_at" IS NULL OR "last_stripe_event_at" <= :occurredAt)',
        { occurredAt },
      )
      .execute();

    const applied = (result.affected ?? 0) > 0;
    if (!applied) {
      this.logger.warn(
        `Événement Stripe périmé ignoré pour l'abonnement ${subscriptionRowId} ` +
          `(émis le ${occurredAt.toISOString()}, antérieur au dernier appliqué).`,
      );
    }
    return applied;
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
    occurredAt: Date,
  ): Promise<void> {
    const userId = session.metadata?.user_id;
    if (!userId || !session.subscription || !session.customer) return;

    // Chemin de création : l'`upsert` ci-dessous n'a pas de ligne sur laquelle
    // poser une condition, la garde se fait donc par lecture préalable. La
    // course lecture-puis-écriture qu'elle laisse ouverte n'existe que si un
    // autre événement du même abonnement est traité pendant celui-ci — pas au
    // premier passage, où la ligne n'existe encore pour personne.
    const existing = await this.subscriptionsRepo.findOne({
      where: { user_id: userId },
    });
    if (
      existing?.last_stripe_event_at &&
      existing.last_stripe_event_at > occurredAt
    ) {
      this.logger.warn(
        `checkout.session.completed périmé ignoré pour l'utilisateur ${userId}.`,
      );
      return;
    }

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
        last_stripe_event_at: occurredAt,
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

  private async handleInvoicePaid(
    invoice: Stripe.Invoice,
    occurredAt: Date,
  ): Promise<void> {
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

    // `status` est forcé à `active` et non recopié de `stripeSub` : une facture
    // payée *dit* que l'abonnement l'était au moment de son émission. C'est
    // précisément pourquoi l'écriture passe par la garde — une facture payée
    // livrée après une résiliation ne doit pas ressusciter l'abonnement.
    const applied = await this.applyEventState(subscription.id, occurredAt, {
      status: SubscriptionStatus.ACTIVE,
      current_period_start: period.start,
      current_period_end: period.end,
      stripe_price_id: priceId,
    });

    if (applied) {
      await this.syncSubscriptionTier(subscription.user_id, 'active', priceId);
    }

    // COM-3 : premier paiement réel (pas un simple essai) — déclencheur du
    // crédit de parrainage. Volontairement non catché : la méthode est
    // idempotente au retry Stripe, une erreur ici doit continuer à déclencher
    // releaseWebhookEvent + retry plutôt que d'être avalée silencieusement.
    //
    // Volontairement **hors** de la garde d'ordonnancement : son déclencheur est
    // « un paiement réel a eu lieu », pas « ceci est l'état le plus récent ».
    // La soumettre au filigrane ferait perdre un crédit de parrainage chaque
    // fois qu'un autre événement double la facture — un défaut neuf en
    // réparation d'un ancien.
    await this.referralsService.handleReferredUserConverted(
      subscription.user_id,
    );
  }

  private async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice,
    occurredAt: Date,
  ): Promise<void> {
    const stripeSubscriptionId = this.extractSubscriptionIdFromInvoice(invoice);
    if (!stripeSubscriptionId) return;

    const subscription = await this.subscriptionsRepo.findOne({
      where: { stripe_subscription_id: stripeSubscriptionId },
    });
    if (!subscription) return;

    const applied = await this.applyEventState(subscription.id, occurredAt, {
      status: SubscriptionStatus.PAST_DUE,
    });
    // Pas d'écriture, pas d'événement analytique : un `payment_failed` périmé
    // compté dans le funnel ferait voir un incident de paiement là où l'état
    // réel a déjà tourné.
    if (!applied) return;

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
    occurredAt: Date,
  ): Promise<void> {
    const subscription = await this.subscriptionsRepo.findOne({
      where: { stripe_subscription_id: stripeSub.id },
    });
    if (!subscription) return;

    const period = this.extractPeriodFromSubscription(stripeSub);
    const priceId = this.extractPriceId(stripeSub);

    // Le chemin par lequel un palier périmé revenait : cet événement porte un
    // instantané complet de l'abonnement, y compris son prix. Livré en retard,
    // il réécrivait le tout — prix compris — puis re-synchronisait le palier.
    const applied = await this.applyEventState(subscription.id, occurredAt, {
      status: stripeSub.status as SubscriptionStatus,
      cancel_at_period_end: stripeSub.cancel_at_period_end,
      current_period_start: period.start,
      current_period_end: period.end,
      stripe_price_id: priceId,
      trial_end: stripeSub.trial_end
        ? new Date(stripeSub.trial_end * 1000)
        : null,
    });
    if (!applied) return;

    await this.syncSubscriptionTier(
      subscription.user_id,
      stripeSub.status,
      priceId,
    );
  }

  private async handleSubscriptionDeleted(
    stripeSub: Stripe.Subscription,
    occurredAt: Date,
  ): Promise<void> {
    const subscription = await this.subscriptionsRepo.findOne({
      where: { stripe_subscription_id: stripeSub.id },
    });
    if (!subscription) return;

    const applied = await this.applyEventState(subscription.id, occurredAt, {
      status: SubscriptionStatus.CANCELED,
    });
    if (!applied) return;

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
