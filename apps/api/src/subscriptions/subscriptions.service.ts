import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Subscription, SubscriptionStatus } from './entities/subscription.entity';
import { UsersService } from '../users/users.service';
import { SubscriptionTier } from '../users/entities/user.entity';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class SubscriptionsService {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly proPriceId: string;
  private readonly contractorPriceIds: Set<string>;
  private readonly publicUrl: string;
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionsRepo: Repository<Subscription>,
    private readonly usersService: UsersService,
    private readonly analyticsService: AnalyticsService,
    private readonly config: ConfigService,
  ) {
    this.stripe = new Stripe(this.config.get<string>('stripe.secretKey')!);
    this.webhookSecret = this.config.get<string>('stripe.webhookSecret')!;
    this.proPriceId = this.config.get<string>('stripe.proPriceId')!;
    this.publicUrl = this.config.get<string>('publicUrl')!;

    this.contractorPriceIds = new Set(
      [
        this.config.get<string>('stripe.contractorEssentielPriceId'),
        this.config.get<string>('stripe.contractorStandardPriceId'),
        this.config.get<string>('stripe.contractorPremiumPriceId'),
      ].filter(Boolean) as string[],
    );
  }

  async getSubscription(userId: string): Promise<Subscription | null> {
    return this.subscriptionsRepo.findOne({ where: { user_id: userId } });
  }

  async createCheckoutSession(
    user: { id: string; email: string | null },
    priceId?: string,
  ): Promise<{ url: string }> {
    const selectedPriceId = priceId ?? this.proPriceId;
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

    return { url: session.url! };
  }

  async createPortalSession(userId: string): Promise<{ url: string }> {
    const subscription = await this.subscriptionsRepo.findOne({
      where: { user_id: userId },
    });

    if (!subscription) {
      throw new BadRequestException("Aucun abonnement trouve.");
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${this.publicUrl}/dashboard`,
    });

    return { url: session.url };
  }

  constructWebhookEvent(
    rawBody: Buffer,
    signature: string,
  ): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice,
        );
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private extractPriceId(stripeSub: Stripe.Subscription): string | null {
    return stripeSub.items?.data?.[0]?.price?.id ?? null;
  }

  private extractPeriodFromSubscription(
    stripeSub: Stripe.Subscription,
  ): { start: Date | null; end: Date | null } {
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
      : subDetails.subscription?.id ?? null;
  }

  private resolvePlanName(priceId: string | null): string {
    if (!priceId) return 'pro';
    if (this.contractorPriceIds.has(priceId)) return 'contractor';
    return 'pro';
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

    const stripeSub =
      await this.stripe.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ['items.data'],
      });

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
    this.analyticsService.track('subscription_started', userId, {
      plan: planName,
      trial: stripeSub.status === 'trialing',
    });
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const stripeSubscriptionId =
      this.extractSubscriptionIdFromInvoice(invoice);
    if (!stripeSubscriptionId) return;

    const subscription = await this.subscriptionsRepo.findOne({
      where: { stripe_subscription_id: stripeSubscriptionId },
    });
    if (!subscription) return;

    const stripeSub =
      await this.stripe.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ['items.data'],
      });

    const period = this.extractPeriodFromSubscription(stripeSub);
    const priceId = this.extractPriceId(stripeSub);

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.current_period_start = period.start;
    subscription.current_period_end = period.end;
    subscription.stripe_price_id = priceId;
    await this.subscriptionsRepo.save(subscription);

    await this.syncSubscriptionTier(subscription.user_id, 'active', priceId);
  }

  private async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    const stripeSubscriptionId =
      this.extractSubscriptionIdFromInvoice(invoice);
    if (!stripeSubscriptionId) return;

    const subscription = await this.subscriptionsRepo.findOne({
      where: { stripe_subscription_id: stripeSubscriptionId },
    });
    if (!subscription) return;

    subscription.status = SubscriptionStatus.PAST_DUE;
    await this.subscriptionsRepo.save(subscription);

    const planName = this.resolvePlanName(subscription.stripe_price_id);
    this.analyticsService.track('payment_failed', subscription.user_id, {
      plan: planName,
    });
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
    this.analyticsService.track('subscription_canceled', subscription.user_id, {
      plan: planName,
    });
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

    const tier =
      stripePriceId && this.contractorPriceIds.has(stripePriceId)
        ? SubscriptionTier.CONTRACTOR
        : SubscriptionTier.PRO;

    await this.usersService.updateSubscriptionTier(userId, tier);
  }
}
