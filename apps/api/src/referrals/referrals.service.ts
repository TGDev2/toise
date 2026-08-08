import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import Stripe from 'stripe';
import { User } from '../users/entities/user.entity';
import {
  ReferralCredit,
  ReferralCreditStatus,
} from './entities/referral-credit.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { getDefaultPlan } from '../subscriptions/plans.constants';
import { EmailService } from '../email/email.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';
import { generateReferralCode } from './referral-code.util';

const MAX_CODE_GENERATION_ATTEMPTS = 5;
/** Fenêtre d'éligibilité à la rédemption : garde-fou simple contre le
 * rattachement tardif d'un compte déjà ancien (pas de KYC — cf. plan COM-3). */
const REDEEM_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface ReferralStats {
  code: string;
  share_url: string;
  referred_count: number;
  converted_count: number;
  months_offered: number;
}

@Injectable()
export class ReferralsService {
  private readonly stripeClient: Stripe | null;
  private readonly publicUrl: string;
  private readonly paidPlanPriceEuros: number;
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(ReferralCredit)
    private readonly referralCreditsRepo: Repository<ReferralCredit>,
    @InjectRepository(Subscription)
    private readonly subscriptionsRepo: Repository<Subscription>,
    private readonly emailService: EmailService,
    private readonly analyticsService: AnalyticsService,
    private readonly config: ConfigService,
  ) {
    const secretKey = this.config.get<string>('stripe.secretKey');
    this.stripeClient = secretKey ? new Stripe(secretKey) : null;
    this.publicUrl = this.config.get<string>('publicUrl')!;
    this.paidPlanPriceEuros = getDefaultPlan().price;
  }

  private get stripe(): Stripe {
    if (!this.stripeClient) {
      throw new ServiceUnavailableException(
        'Les paiements sont temporairement indisponibles.',
      );
    }
    return this.stripeClient;
  }

  async getOrCreateReferralCode(userId: string): Promise<string> {
    const user = await this.usersRepo.findOneByOrFail({ id: userId });
    if (user.referral_code) return user.referral_code;

    for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
      const code = generateReferralCode();
      try {
        const result = await this.usersRepo.update(
          { id: userId, referral_code: IsNull() },
          { referral_code: code },
        );
        if ((result.affected ?? 0) > 0) return code;

        // Un autre appel concurrent a déjà posé un code entre-temps.
        const fresh = await this.usersRepo.findOneByOrFail({ id: userId });
        if (fresh.referral_code) return fresh.referral_code;
      } catch (error) {
        // Collision sur la valeur du code elle-même (improbable, espace ~31^8) :
        // on retente avec un nouveau tirage plutôt que de faire échouer l'appel.
        this.logger.warn(
          `Collision de code de parrainage, nouvelle tentative (${attempt + 1}/${MAX_CODE_GENERATION_ATTEMPTS}) : ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    throw new InternalServerErrorException(
      'Impossible de générer un code de parrainage unique.',
    );
  }

  async getStats(userId: string): Promise<ReferralStats> {
    const code = await this.getOrCreateReferralCode(userId);

    const [referredCount, convertedCount, monthsOffered] = await Promise.all([
      this.usersRepo.count({ where: { referred_by_user_id: userId } }),
      this.usersRepo.count({
        where: {
          referred_by_user_id: userId,
          referral_converted_at: Not(IsNull()),
        },
      }),
      this.referralCreditsRepo.count({
        where: {
          referrer_user_id: userId,
          status: ReferralCreditStatus.APPLIED,
        },
      }),
    ]);

    return {
      code,
      share_url: `${this.publicUrl}/register?ref=${code}`,
      referred_count: referredCount,
      converted_count: convertedCount,
      months_offered: monthsOffered,
    };
  }

  /**
   * Rattache `user` au parrain détenteur de `rawCode`. No-op silencieux (jamais
   * d'erreur bloquante) si l'utilisateur est déjà parrainé, le code est
   * invalide, il s'agit d'un auto-parrainage, ou le compte a plus de 7 jours.
   */
  async redeemCode(
    user: User,
    rawCode: string,
  ): Promise<{ redeemed: boolean }> {
    if (user.referred_by_user_id) return { redeemed: false };

    const code = rawCode?.trim().toUpperCase();
    if (!code) return { redeemed: false };

    if (Date.now() - user.created_at.getTime() > REDEEM_WINDOW_MS) {
      return { redeemed: false };
    }

    const referrer = await this.usersRepo.findOneBy({ referral_code: code });
    if (!referrer || referrer.id === user.id) return { redeemed: false };

    const result = await this.usersRepo.update(
      { id: user.id, referred_by_user_id: IsNull() },
      { referred_by_user_id: referrer.id },
    );

    const redeemed = (result.affected ?? 0) > 0;
    if (redeemed) {
      this.analyticsService.track(
        AnalyticsEventName.REFERRAL_REDEEMED,
        user.id,
        {
          referrer_id: referrer.id,
        },
      );
    }
    return { redeemed };
  }

  /**
   * Appelée depuis SubscriptionsService.handleInvoicePaid après le premier
   * paiement réel (pas un simple essai) d'un filleul. Idempotente au retry
   * webhook : le ledger est posé via upsert (orIgnore), et `referral_converted_at`
   * empêche tout nouveau passage sur les factures suivantes du même filleul.
   */
  async handleReferredUserConverted(referredUserId: string): Promise<void> {
    const referredUser = await this.usersRepo.findOneBy({ id: referredUserId });
    if (
      !referredUser?.referred_by_user_id ||
      referredUser.referral_converted_at
    ) {
      return;
    }

    const amountCents = Math.round(this.paidPlanPriceEuros * 100);

    await this.referralCreditsRepo
      .createQueryBuilder()
      .insert()
      .values({
        referrer_user_id: referredUser.referred_by_user_id,
        referred_user_id: referredUser.id,
        amount_cents: amountCents,
        currency: 'eur',
        status: ReferralCreditStatus.PENDING,
      })
      .orIgnore()
      .execute();

    const credit = await this.referralCreditsRepo.findOneByOrFail({
      referred_user_id: referredUser.id,
    });

    if (credit.status === ReferralCreditStatus.PENDING) {
      const referrerSubscription = await this.subscriptionsRepo.findOne({
        where: { user_id: credit.referrer_user_id },
      });

      if (referrerSubscription) {
        await this.applyCreditToStripeCustomer(
          credit,
          referrerSubscription.stripe_customer_id,
        );
        await this.notifyReferrer(credit.referrer_user_id);
      }
    }

    await this.usersRepo.update(referredUserId, {
      referral_converted_at: new Date(),
    });
  }

  /**
   * Appelée depuis SubscriptionsService.createCheckoutSession juste après la
   * création d'un nouveau customer Stripe pour `referrerId` : flush les crédits
   * accumulés pendant que ce parrain n'avait pas encore de compte de facturation.
   */
  async applyPendingCreditsForNewCustomer(
    referrerId: string,
    stripeCustomerId: string,
  ): Promise<void> {
    const pending = await this.referralCreditsRepo.find({
      where: {
        referrer_user_id: referrerId,
        status: ReferralCreditStatus.PENDING,
      },
    });

    for (const credit of pending) {
      try {
        await this.applyCreditToStripeCustomer(credit, stripeCustomerId);
        await this.notifyReferrer(referrerId);
      } catch (error) {
        this.logger.error(
          `Echec de l'application du crédit de parrainage ${credit.id} au nouveau customer ${stripeCustomerId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private async applyCreditToStripeCustomer(
    credit: ReferralCredit,
    stripeCustomerId: string,
  ): Promise<void> {
    const balanceTx = await this.stripe.customers.createBalanceTransaction(
      stripeCustomerId,
      {
        amount: -credit.amount_cents,
        currency: credit.currency,
        description: 'Parrainage Chiffréo : 1 mois offert',
      },
      { idempotencyKey: `referral-credit-${credit.id}` },
    );

    await this.referralCreditsRepo.update(credit.id, {
      status: ReferralCreditStatus.APPLIED,
      applied_at: new Date(),
      stripe_balance_transaction_id: balanceTx.id,
    });

    this.analyticsService.track(
      AnalyticsEventName.REFERRAL_CREDIT_GRANTED,
      credit.referrer_user_id,
      { amount_cents: credit.amount_cents },
    );
  }

  private async notifyReferrer(referrerId: string): Promise<void> {
    const referrer = await this.usersRepo.findOneBy({ id: referrerId });
    if (!referrer?.email) return;

    try {
      await this.emailService.sendReferralCreditEmail(referrer.email, {
        amountEuros: this.paidPlanPriceEuros,
        referralsUrl: `${this.publicUrl}/referrals`,
      });
    } catch (error) {
      this.logger.warn(
        `Echec de l'e-mail de crédit de parrainage pour ${referrerId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
