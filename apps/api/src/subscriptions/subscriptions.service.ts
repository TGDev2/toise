import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
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
import { getDefaultPlan, PLANS } from './plans.constants';

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

/** Repli si `STRIPE_PAST_DUE_GRACE_DAYS` est absente de la configuration. */
const DEFAULT_PAST_DUE_GRACE_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Une ligne de l'historique de facturation Stripe (E6-2, export RGPD). */
export interface BillingHistoryEntry {
  id: string;
  number: string | null;
  status: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  created: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
}

@Injectable()
export class SubscriptionsService {
  private readonly stripeClient: Stripe | null;
  private readonly webhookSecret: string;
  /**
   * Prix souscrit quand le checkout n'en désigne aucun. C'était le prix du
   * palier DIY à 9,99 €, supprimé en E3-1 : un appel sans `price_id` souscrit
   * désormais le seul palier payant. `undefined` si la variable n'est pas
   * renseignée — l'API démarre quand même, et le checkout répond « Offre
   * invalide » plutôt que de rediriger vers un prix inexistant.
   */
  private readonly defaultPriceId: string | undefined;
  private readonly priceIdToTier: Map<string, SubscriptionTier>;
  private readonly priceIdToTrialDays: Map<string, number>;
  private readonly contractorPriceIds: Set<string>;
  private readonly allowedPriceIds: Set<string>;
  private readonly publicUrl: string;
  private readonly pastDueGraceMs: number;
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
    this.defaultPriceId = this.config.get<string>(
      getDefaultPlan().priceIdConfigKey,
    );
    this.publicUrl = this.config.get<string>('publicUrl')!;

    // Lu avec un repli, et non avec `!` : cette valeur a un défaut légitime et
    // le service est aussi construit à la main dans les tests d'intégration,
    // avec une configuration réduite au strict nécessaire.
    const graceDays =
      this.config.get<number>('stripe.pastDueGraceDays') ??
      DEFAULT_PAST_DUE_GRACE_DAYS;
    this.pastDueGraceMs = Number(graceDays) * MS_PER_DAY;

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

    // Les prix souscriptibles sont exactement ceux qui résolvent un palier.
    // `proPriceId` y figurait en plus, et il ne résolvait aucun palier : c'est
    // ce qui rendait possible de payer un prix sans rien débloquer.
    this.allowedPriceIds = new Set<string>(this.contractorPriceIds);

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
    const selectedPriceId = priceId ?? this.defaultPriceId;
    if (!selectedPriceId || !this.allowedPriceIds.has(selectedPriceId)) {
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
      // `past_due` est refusé séparément, avec un message qui indique la sortie.
      //
      // Il tombait jusqu'ici dans le cas général et repartait vers un nouveau
      // checkout, ce qui crée une **seconde** souscription Stripe : l'`upsert`
      // de `handleCheckoutCompleted` écrase `stripe_subscription_id`, la
      // première reste vivante et facturée, et `cancelForAccountDeletion` ne
      // sait plus qu'elle existe — double prélèvement sans trace locale. Le
      // même chemin re-servait aussi l'essai gratuit à chaque tentative. Le
      // portail est la seule reprise correcte d'un impayé ; c'est là que le
      // bandeau de relance envoie.
      if (existing.status === SubscriptionStatus.PAST_DUE) {
        throw new BadRequestException(
          'Un paiement de votre abonnement a échoué. Mettez à jour votre moyen ' +
            'de paiement depuis votre espace de facturation.',
        );
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
   * Historique réel des factures Stripe d'un client (E6-2, export RGPD art. 20).
   *
   * `subscriptions`/`invoices` locaux ne portent que l'état courant de
   * l'abonnement et les documents métier générés par l'app — aucune table ne
   * mirror les transactions Stripe elles-mêmes. C'est la seule source d'un
   * véritable historique de facturation.
   *
   * L'itération asynchrone du SDK Stripe pagine elle-même (`autoPagingEach`
   * implicite via `Symbol.asyncIterator`) : exhaustif quel que soit le nombre
   * de factures, sans gestion manuelle de curseur. N'avale pas ses erreurs —
   * c'est à l'appelant (l'export, qui ne doit pas échouer entièrement pour un
   * incident Stripe) de décider de la dégradation.
   */
  async listBillingHistory(
    stripeCustomerId: string,
  ): Promise<BillingHistoryEntry[]> {
    const entries: BillingHistoryEntry[] = [];
    for await (const invoice of this.stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 100,
    })) {
      entries.push({
        id: invoice.id ?? invoice.number ?? `unknown-${invoice.created}`,
        number: invoice.number ?? null,
        status: invoice.status ?? null,
        amount_due: invoice.amount_due,
        amount_paid: invoice.amount_paid,
        currency: invoice.currency,
        created: new Date(invoice.created * 1000).toISOString(),
        hosted_invoice_url: invoice.hosted_invoice_url ?? null,
        invoice_pdf: invoice.invoice_pdf ?? null,
      });
    }
    return entries;
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
   * L'horodatage du délai de grâce (`past_due_since`) est écrit **ici**, dans
   * la même instruction, et nulle part ailleurs :
   *
   * - entrée en `past_due` → `COALESCE(past_due_since, occurredAt)`. Le
   *   `COALESCE` est ce qui fait tenir le délai : Stripe rejoue
   *   `invoice.payment_failed` à chaque relance pendant environ trois semaines,
   *   et réécrire la date à chaque passage repousserait l'échéance à l'infini ;
   * - tout autre statut → `NULL`, l'épisode d'impayé est clos ;
   * - statut absent du patch → colonne inchangée, pour qu'un futur appel qui
   *   ne toucherait pas au statut n'efface pas le compte à rebours par accident.
   *
   * Le placer hors de cette instruction rouvrirait le trou que la garde ferme :
   * un `customer.subscription.updated` périmé portant `past_due` estampillerait
   * une ligne redevenue `active`, et l'impayé suivant démarrerait avec un délai
   * déjà consommé — un déclassement immédiat, des semaines plus tard, sans
   * qu'aucun test ne puisse le rattacher à sa cause.
   *
   * @returns `applied` : `false` si l'événement a été écarté comme périmé —
   * l'appelant doit alors s'abstenir de synchroniser le palier. `pastDueSince` :
   * la valeur effectivement en base après l'écriture (`RETURNING`), et non une
   * relecture — le `findOne` des handlers a lu la ligne *avant* cet UPDATE, et
   * recalculer le `COALESCE` en JavaScript ferait vivre la même règle à deux
   * endroits.
   */
  private async applyEventState(
    subscriptionRowId: string,
    occurredAt: Date,
    patch: Partial<Subscription>,
  ): Promise<{ applied: boolean; pastDueSince: Date | null }> {
    const result = await this.subscriptionsRepo
      .createQueryBuilder()
      .update(Subscription)
      .set({
        ...patch,
        last_stripe_event_at: occurredAt,
        ...(patch.status === undefined
          ? {}
          : patch.status === SubscriptionStatus.PAST_DUE
            ? {
                past_due_since: () => 'COALESCE("past_due_since", :occurredAt)',
              }
            : { past_due_since: null }),
      })
      .where('id = :id', { id: subscriptionRowId })
      .andWhere(
        '("last_stripe_event_at" IS NULL OR "last_stripe_event_at" <= :occurredAt)',
        { occurredAt },
      )
      // Le fragment du SET référence `:occurredAt` : on le lie explicitement
      // plutôt que de dépendre du `andWhere` ci-dessus, qui pourrait être
      // réécrit sans que personne ne voie le lien.
      .setParameter('occurredAt', occurredAt)
      .returning(['past_due_since'])
      .execute();

    const applied = (result.affected ?? 0) > 0;
    if (!applied) {
      this.logger.warn(
        `Événement Stripe périmé ignoré pour l'abonnement ${subscriptionRowId} ` +
          `(émis le ${occurredAt.toISOString()}, antérieur au dernier appliqué).`,
      );
      return { applied: false, pastDueSince: null };
    }

    const returned = result.raw as
      | Array<{ past_due_since: Date | string | null }>
      | undefined;
    const rawPastDueSince = returned?.[0]?.past_due_since ?? null;

    return {
      applied: true,
      pastDueSince: rawPastDueSince ? new Date(rawPastDueSince) : null,
    };
  }

  /**
   * Le délai de grâce d'un impayé est-il écoulé ?
   *
   * `null` — aucun horodatage — vaut « non ». C'est le repli permissif : on ne
   * sait pas depuis quand l'impayé dure, et couper l'accès sur une inconnue est
   * le seul des deux défauts qui se voie chez un client. Après la migration
   * 1711468800077 et le `COALESCE` ci-dessus, une ligne `past_due` sans
   * horodatage ne peut plus exister ; le repli couvre la période de bascule.
   *
   * Comparaison en `>=` pour que `STRIPE_PAST_DUE_GRACE_DAYS=0` signifie bien
   * « déclassement immédiat » et non « jamais ».
   */
  private isGraceExpired(
    pastDueSince: Date | null,
    at: Date = new Date(),
  ): boolean {
    if (!pastDueSince) return false;
    return at.getTime() - pastDueSince.getTime() >= this.pastDueGraceMs;
  }

  /**
   * Date à laquelle l'accès tombera, ou `null` si l'abonnement n'est pas en
   * impayé. Calculée côté serveur et rendue telle quelle par
   * `GET /subscriptions/current` : le navigateur n'a pas à connaître
   * `STRIPE_PAST_DUE_GRACE_DAYS` pour afficher son bandeau, et une deuxième
   * copie du délai finirait par diverger de celle qui est appliquée.
   */
  gracePeriodEndsAt(subscription: Subscription): Date | null {
    if (subscription.status !== SubscriptionStatus.PAST_DUE) return null;
    if (!subscription.past_due_since) return null;
    return new Date(
      subscription.past_due_since.getTime() + this.pastDueGraceMs,
    );
  }

  /**
   * Déclasse les abonnés dont le délai de grâce est écoulé.
   *
   * Un balayage est indispensable : à l'instant où l'échéance tombe, il
   * n'arrive rien de Stripe: aucun événement ne vient déclencher le
   * déclassement. Sans lui, l'accès resterait ouvert jusqu'à la résiliation
   * — c'est-à-dire exactement le défaut corrigé ici.
   *
   * **Horaire**, et non quotidien comme les autres balayages du dépôt, parce
   * que le bandeau annonce l'échéance à la minute près. À 8 h fixes, un abonné
   * dont le délai expire à 9 h lirait « accès suspendu » pendant vingt-trois
   * heures alors que toutes ses capacités fonctionnent encore. La requête est
   * servie par un index partiel et ne rend qu'une poignée de lignes.
   *
   * Ce balayage **n'écrit jamais `subscriptions.status`** : il ne touche qu'au
   * palier. C'est ce qui rend la reprise gratuite — un `invoice.paid` remet la
   * ligne en `active`, efface `past_due_since` et resynchronise le palier par
   * le chemin normal, sans qu'aucun code de « ré-activation » soit nécessaire.
   * Écrire le statut ici obligerait en plus à toucher au filigrane
   * `last_stripe_event_at`, donc à mentir sur ce que Stripe a émis.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sweepExpiredGracePeriods(): Promise<void> {
    const expiredBefore = new Date(Date.now() - this.pastDueGraceMs);

    const expired = await this.subscriptionsRepo.find({
      where: {
        status: SubscriptionStatus.PAST_DUE,
        past_due_since: LessThanOrEqual(expiredBefore),
      },
    });

    for (const subscription of expired) {
      try {
        const downgraded = await this.usersService.downgradeToFreeIfNeeded(
          subscription.user_id,
        );
        // Le balayage repasse toutes les heures sur les mêmes lignes tant que
        // l'impayé dure : sans ce test, le funnel verrait une expiration par
        // heure et par abonné. `downgradeToFreeIfNeeded` tranche en base.
        if (!downgraded) continue;

        this.logger.warn(
          `Délai de grâce écoulé pour l'abonnement ${subscription.id} ` +
            `(impayé depuis le ${subscription.past_due_since?.toISOString()}) — ` +
            `palier ramené à gratuit.`,
        );
        this.analyticsService.track(
          AnalyticsEventName.SUBSCRIPTION_GRACE_EXPIRED,
          subscription.user_id,
          { plan: this.resolvePlanName(subscription.stripe_price_id) },
        );
      } catch (error) {
        // Un abonné qui échoue ne doit pas empêcher les suivants d'être
        // traités : même parti pris que les autres balayages du dépôt.
        this.logger.error(
          `Échec du déclassement de l'abonnement ${subscription.id}: ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
      }
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

  /**
   * Libellé de palier pour l'analytique. Le repli était `'pro'` : un prix
   * inconnu était rapporté comme une souscription au palier d'entrée, donc
   * comptée dans un palier qui n'a peut-être rien encaissé. Un prix qu'on ne
   * sait pas nommer se dit `unknown` — c'est une mesure, elle doit pouvoir
   * signaler qu'elle ne sait pas.
   */
  private resolvePlanName(priceId: string | null): string {
    if (!priceId) return 'unknown';
    return this.priceIdToTier.get(priceId) ?? 'unknown';
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

    // Comparé au littéral et non à l'enum : `stripeSub.status` est l'union de
    // chaînes du SDK Stripe, que TypeScript refuse de rapprocher de notre
    // `SubscriptionStatus` — les deux vocabulaires coïncident par convention,
    // pas par typage.
    const enteredPastDue = stripeSub.status === 'past_due' ? occurredAt : null;

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
        // Toujours présente, y compris à `null`. TypeORM ne met dans le
        // `DO UPDATE SET` de l'`upsert` que les colonnes présentes dans ce
        // littéral : l'omettre laisserait un ancien horodatage d'impayé sous
        // un statut redevenu actif.
        past_due_since: enteredPastDue,
      },
      ['user_id'],
    );

    await this.syncSubscriptionTier(
      userId,
      stripeSub.status,
      priceId,
      enteredPastDue,
    );

    const planName = this.resolvePlanName(priceId);
    this.analyticsService.track(
      AnalyticsEventName.SUBSCRIPTION_STARTED,
      userId,
      {
        plan: planName,
        trial: stripeSub.status === 'trialing',
      },
    );

    // Marches « essai démarré » / « abonnement payant actif » du funnel de
    // revenu (BACKLOG_V1) : un même checkout complété tombe dans l'une ou
    // l'autre selon que le plan souscrit porte un essai.
    if (stripeSub.status === 'trialing') {
      this.analyticsService.track(AnalyticsEventName.TRIAL_STARTED, userId, {
        plan: planName,
      });
    } else if (stripeSub.status === 'active') {
      this.analyticsService.track(
        AnalyticsEventName.PAID_SUBSCRIPTION_ACTIVE,
        userId,
        { plan: planName },
      );
    }
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
    // Le statut `active` efface au passage `past_due_since` : un paiement qui
    // aboutit clôt l'épisode d'impayé, y compris quand le délai de grâce était
    // déjà écoulé — le palier payant est alors rendu par le même appel.
    const { applied } = await this.applyEventState(
      subscription.id,
      occurredAt,
      {
        status: SubscriptionStatus.ACTIVE,
        current_period_start: period.start,
        current_period_end: period.end,
        stripe_price_id: priceId,
      },
    );

    if (applied) {
      await this.syncSubscriptionTier(subscription.user_id, 'active', priceId);

      // Marche « abonnement payant actif » du funnel de revenu (BACKLOG_V1) :
      // ne tracker que sur une transition réelle vers `active` (conversion
      // d'essai, ou reprise après impayé) — `subscription` a été lu *avant*
      // `applyEventState` ci-dessus, son `status` est donc l'état précédent.
      // Sans cette garde, chaque facture de renouvellement re-déclencherait
      // la marche (même idiome que `sweepExpiredGracePeriods`).
      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        this.analyticsService.track(
          AnalyticsEventName.PAID_SUBSCRIPTION_ACTIVE,
          subscription.user_id,
          { plan: this.resolvePlanName(priceId) },
        );
      }
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

    const { applied } = await this.applyEventState(
      subscription.id,
      occurredAt,
      { status: SubscriptionStatus.PAST_DUE },
    );
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
    const { applied, pastDueSince } = await this.applyEventState(
      subscription.id,
      occurredAt,
      {
        status: stripeSub.status as SubscriptionStatus,
        cancel_at_period_end: stripeSub.cancel_at_period_end,
        current_period_start: period.start,
        current_period_end: period.end,
        stripe_price_id: priceId,
        trial_end: stripeSub.trial_end
          ? new Date(stripeSub.trial_end * 1000)
          : null,
      },
    );
    if (!applied) return;

    await this.syncSubscriptionTier(
      subscription.user_id,
      stripeSub.status,
      priceId,
      pastDueSince,
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

    const { applied } = await this.applyEventState(
      subscription.id,
      occurredAt,
      { status: SubscriptionStatus.CANCELED },
    );
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

  /**
   * Traduit un statut Stripe en palier effectif.
   *
   * `past_due` est compté comme actif **le temps du délai de grâce seulement**.
   * Il y figure parce qu'un échec de paiement n'est pas un défaut de paiement :
   * dans l'immense majorité des cas c'est une carte expirée, que le client
   * remplace en quelques jours sans jamais s'apercevoir qu'il a failli perdre
   * l'accès. Couper immédiatement ferait payer à un abonné de bonne foi le
   * calendrier d'expiration de sa banque. Il en sort au-delà du délai, faute de
   * quoi les relances de Stripe — trois semaines — vaudraient abonnement
   * gratuit à chaque incident.
   *
   * Cette borne fait doublon avec `sweepExpiredGracePeriods`, et ce doublon est
   * nécessaire : le balayage déclasse, mais les événements de relance
   * continuent d'arriver ensuite avec `status = past_due`. Sans la borne ici,
   * chacun re-rendrait le palier payant jusqu'au balayage suivant — un
   * oscillateur, pas un correctif.
   */
  private async syncSubscriptionTier(
    userId: string,
    stripeStatus: string,
    stripePriceId?: string | null,
    pastDueSince: Date | null = null,
  ): Promise<void> {
    const activeStatuses = ['trialing', 'active', 'past_due'];
    const graceExhausted =
      stripeStatus === 'past_due' && this.isGraceExpired(pastDueSince);

    if (!activeStatuses.includes(stripeStatus) || graceExhausted) {
      await this.usersService.updateSubscriptionTier(
        userId,
        SubscriptionTier.FREE,
      );
      return;
    }

    // Le repli valait `SubscriptionTier.PRO` : un prix inconnu accordait
    // silencieusement le palier DIY, qui n'existe plus. Le repli reste un
    // palier **payant** et non `free` — on n'arrive ici que sur un abonnement
    // que Stripe déclare actif, donc sur un client qui paie ; le déclasser
    // pour un prix qu'on ne sait pas lire ferait perdre l'accès à quelqu'un
    // qui l'a acheté. Mais le cas n'est plus silencieux.
    const mappedTier = stripePriceId
      ? this.priceIdToTier.get(stripePriceId)
      : undefined;

    if (!mappedTier) {
      this.logger.warn(
        `Abonnement ${stripeStatus} sans palier résoluble (price_id=${stripePriceId ?? 'absent'}) — repli sur ${SubscriptionTier.CONTRACTOR_ESSENTIEL}.`,
      );
    }

    await this.usersService.updateSubscriptionTier(
      userId,
      mappedTier ?? SubscriptionTier.CONTRACTOR_ESSENTIEL,
    );
  }
}
