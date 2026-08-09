import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import type Stripe from 'stripe';
import { SubscriptionsService } from './subscriptions.service';
import {
  Subscription,
  SubscriptionStatus,
} from './entities/subscription.entity';
import { StripeEvent } from './entities/stripe-event.entity';
import { SubscriptionRefund } from './entities/subscription-refund.entity';
import { UsersService } from '../users/users.service';
import { SubscriptionTier } from '../users/entities/user.entity';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';
import { ReferralsService } from '../referrals/referrals.service';

// Même patron que `subscriptions.service.spec.ts` : une fausse instance
// exposant la surface du SDK Stripe que ce chemin appelle réellement. Le
// préfixe « mock » est ce qui autorise la fabrique hoistée de `jest.mock` à la
// référencer.
const mockStripeInstance = {
  customers: { create: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
  subscriptions: { retrieve: jest.fn(), cancel: jest.fn() },
  invoices: { list: jest.fn() },
  refunds: { create: jest.fn() },
  invoicePayments: { list: jest.fn() },
};

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => mockStripeInstance),
);

const CONFIG_VALUES: Record<string, string | number> = {
  'stripe.secretKey': 'sk_test_123',
  'stripe.webhookSecret': 'whsec_test',
  publicUrl: 'https://chiffreo.fr',
  'stripe.contractorEssentielPriceId': 'price_contractor_essentiel',
};

const configServiceMock = {
  get: jest.fn((key: string) => CONFIG_VALUES[key]),
};

const subscriptionsRepoMock = {
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
  upsert: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const insertBuilder = {
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  orIgnore: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({}),
};

const refundsRepoMock = {
  findOne: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(() => insertBuilder),
};

const stripeEventsRepoMock = {};
const usersServiceMock = {
  updateSubscriptionTier: jest.fn(),
  downgradeToFreeIfNeeded: jest.fn(),
};
const analyticsServiceMock = { track: jest.fn() };
const referralsServiceMock = {
  handleReferredUserConverted: jest.fn(),
  applyPendingCreditsForNewCustomer: jest.fn(),
};

const DAY_MS = 24 * 60 * 60 * 1000;

const subscriptionRow = {
  id: 'sub-row-1',
  user_id: 'user-1',
  stripe_customer_id: 'cus_1',
  stripe_subscription_id: 'sub_1',
  stripe_price_id: 'price_contractor_essentiel',
  status: SubscriptionStatus.ACTIVE,
};

/** Une facture payée il y a `daysAgo` jours, dans la forme que Stripe rend. */
function paidInvoice(daysAgo: number) {
  const paidAt = Math.floor((Date.now() - daysAgo * DAY_MS) / 1000);
  return {
    data: [
      {
        id: 'in_1',
        amount_paid: 27900,
        currency: 'eur',
        created: paidAt,
        status_transitions: { paid_at: paidAt },
        // `Invoice.charge` et `Invoice.payment_intent` n'existent plus depuis
        // l'API 2025 : le moyen de paiement se lit dans `payments`. Vérifié
        // dans les types du SDK installé, pas supposé.
        payments: {
          data: [
            {
              status: 'paid',
              payment: { type: 'payment_intent', payment_intent: 'pi_1' },
            },
          ],
        },
      },
    ],
  };
}

function chargeRefundedEvent(
  amount: number,
  amountRefunded: number,
): Stripe.Event {
  return {
    id: 'evt_refund',
    type: 'charge.refunded',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'ch_1',
        customer: 'cus_1',
        payment_intent: 'pi_1',
        amount,
        amount_refunded: amountRefunded,
        refunds: {
          data: [
            {
              id: 're_dashboard',
              amount: amountRefunded,
              currency: 'eur',
              reason: 'requested_by_customer',
            },
          ],
        },
      },
    },
  } as unknown as Stripe.Event;
}

/**
 * « 30 jours satisfait ou remboursé » (E3-3, ADR 0002 §D4).
 *
 * Couvert ici : la **condition** (fenêtre, facture payée, déjà remboursé),
 * l'**effet sur l'accès** (palier fermé sans attendre le webhook), la
 * **trace**, et le remboursement émis depuis le tableau de bord Stripe.
 *
 * Non couvert ici, et volontairement : l'unicité de `stripe_refund_id` sous
 * concurrence. Elle vit dans une contrainte PostgreSQL, seule la base peut en
 * juger — c'est l'objet de `test/integration/persistence.int-spec.ts`.
 */
describe('SubscriptionsService — remboursement à 30 jours', () => {
  let service: SubscriptionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    subscriptionsRepoMock.findOne.mockResolvedValue(subscriptionRow);
    refundsRepoMock.findOne.mockResolvedValue(null);
    refundsRepoMock.createQueryBuilder.mockReturnValue(insertBuilder);
    mockStripeInstance.subscriptions.cancel.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionsRepoMock,
        },
        {
          provide: getRepositoryToken(StripeEvent),
          useValue: stripeEventsRepoMock,
        },
        {
          provide: getRepositoryToken(SubscriptionRefund),
          useValue: refundsRepoMock,
        },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: AnalyticsService, useValue: analyticsServiceMock },
        { provide: ReferralsService, useValue: referralsServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  describe('condition', () => {
    it('déclare éligible une facture payée il y a 10 jours', async () => {
      mockStripeInstance.invoices.list.mockResolvedValue(paidInvoice(10));

      const eligibility = await service.getRefundEligibility('user-1');

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.amount_cents).toBe(27900);
      expect(eligibility.reason).toBeNull();
    });

    it('refuse au-delà de la fenêtre, et dit jusqu’à quand elle courait', async () => {
      mockStripeInstance.invoices.list.mockResolvedValue(paidInvoice(31));

      const eligibility = await service.getRefundEligibility('user-1');

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe('window_elapsed');
      expect(eligibility.eligible_until).toBeInstanceOf(Date);

      await expect(service.requestRefund('user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockStripeInstance.refunds.create).not.toHaveBeenCalled();
    });

    /**
     * La fenêtre court par **facture payée**, reconduction comprise : c'est le
     * cas « j'ai oublié de résilier et j'ai été prélevé de 279 € », première
     * source de contestation bancaire sur un abonnement annuel. Une facture de
     * renouvellement d'hier rouvre donc la garantie, même si la souscription
     * date d'un an — un chargeback coûte plus cher qu'un remboursement.
     */
    it('rouvre la fenêtre sur une facture de renouvellement récente', async () => {
      mockStripeInstance.invoices.list.mockResolvedValue(paidInvoice(1));

      expect((await service.getRefundEligibility('user-1')).eligible).toBe(
        true,
      );
    });

    it('refuse quand aucune facture n’a été payée', async () => {
      mockStripeInstance.invoices.list.mockResolvedValue({ data: [] });

      const eligibility = await service.getRefundEligibility('user-1');

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe('no_paid_invoice');
    });

    it('refuse quand le compte n’a jamais souscrit', async () => {
      subscriptionsRepoMock.findOne.mockResolvedValue(null);

      expect((await service.getRefundEligibility('user-1')).reason).toBe(
        'no_subscription',
      );
      await expect(service.requestRefund('user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('signale une facture déjà remboursée', async () => {
      mockStripeInstance.invoices.list.mockResolvedValue(paidInvoice(5));
      refundsRepoMock.findOne.mockResolvedValue({
        stripe_refund_id: 're_1',
        amount_cents: 27900,
        currency: 'eur',
      });

      expect((await service.getRefundEligibility('user-1')).reason).toBe(
        'already_refunded',
      );
    });
  });

  describe('effet et trace', () => {
    beforeEach(() => {
      mockStripeInstance.invoices.list.mockResolvedValue(paidInvoice(10));
      mockStripeInstance.refunds.create.mockResolvedValue({
        id: 're_1',
        amount: 27900,
        currency: 'eur',
        charge: 'ch_1',
      });
    });

    it('rembourse, ferme l’accès et résilie', async () => {
      const receipt = await service.requestRefund('user-1', 'Trop cher');

      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith(
        { payment_intent: 'pi_1' },
        { idempotencyKey: 'refund-invoice-in_1' },
      );
      expect(receipt).toEqual({
        refund_id: 're_1',
        amount_cents: 27900,
        currency: 'eur',
        already_refunded: false,
      });

      // L'accès tombe **sans attendre le webhook** : rendre l'argent et
      // laisser l'accès ouvert le temps d'un aller-retour Stripe est le seul
      // des deux défauts possibles qui se paie deux fois.
      expect(usersServiceMock.updateSubscriptionTier).toHaveBeenCalledWith(
        'user-1',
        SubscriptionTier.FREE,
      );
      expect(mockStripeInstance.subscriptions.cancel).toHaveBeenCalledWith(
        'sub_1',
      );
    });

    it('écrit une trace complète, avec la fenêtre telle qu’appliquée', async () => {
      await service.requestRefund('user-1', 'Trop cher');

      expect(insertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          stripe_subscription_id: 'sub_1',
          stripe_invoice_id: 'in_1',
          stripe_charge_id: 'ch_1',
          stripe_refund_id: 're_1',
          amount_cents: 27900,
          currency: 'eur',
          origin: 'self_service',
          reason: 'Trop cher',
          invoice_paid_at: expect.any(Date) as Date,
          eligible_until: expect.any(Date) as Date,
        }),
      );
      expect(insertBuilder.orIgnore).toHaveBeenCalled();
    });

    /**
     * `subscriptions.status` et `last_stripe_event_at` ne sont pas écrits ici :
     * le statut reflète ce que **Stripe** a émis, et il sera posé par le
     * `customer.subscription.deleted` qui suit, sous la garde d'ordonnancement.
     * L'écrire localement obligerait à poser un filigrane pour un événement qui
     * n'existe pas — même règle que `sweepExpiredGracePeriods`.
     */
    it('ne touche ni au statut local ni au filigrane d’ordonnancement', async () => {
      await service.requestRefund('user-1');

      expect(subscriptionsRepoMock.createQueryBuilder).not.toHaveBeenCalled();
      expect(subscriptionsRepoMock.save).not.toHaveBeenCalled();
      expect(subscriptionsRepoMock.upsert).not.toHaveBeenCalled();
    });

    it('compte le remboursement dans le funnel', async () => {
      await service.requestRefund('user-1');

      expect(analyticsServiceMock.track).toHaveBeenCalledWith(
        AnalyticsEventName.SUBSCRIPTION_REFUNDED,
        'user-1',
        expect.objectContaining({
          amount_cents: 27900,
          origin: 'self_service',
          days_since_payment: 10,
        }),
      );
    });

    it('rejoué, ne rembourse pas deux fois et referme quand même l’accès', async () => {
      refundsRepoMock.findOne.mockResolvedValue({
        stripe_refund_id: 're_1',
        amount_cents: 27900,
        currency: 'eur',
      });

      const receipt = await service.requestRefund('user-1');

      expect(receipt.already_refunded).toBe(true);
      expect(receipt.refund_id).toBe('re_1');
      expect(mockStripeInstance.refunds.create).not.toHaveBeenCalled();
      expect(usersServiceMock.updateSubscriptionTier).toHaveBeenCalledWith(
        'user-1',
        SubscriptionTier.FREE,
      );
    });
  });

  describe('charge.refunded — le geste fait depuis le tableau de bord Stripe', () => {
    beforeEach(() => {
      mockStripeInstance.invoicePayments.list.mockResolvedValue({
        data: [{ invoice: 'in_1' }],
      });
    });

    it('trace le remboursement et ferme l’accès quand il est total', async () => {
      await service.handleWebhookEvent(chargeRefundedEvent(27900, 27900));

      expect(insertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          stripe_refund_id: 're_dashboard',
          stripe_invoice_id: 'in_1',
          origin: 'stripe_dashboard',
          // Un geste d'opérateur ne s'appuie sur aucune fenêtre : y écrire une
          // échéance laisserait croire qu'une condition a été vérifiée.
          eligible_until: null,
        }),
      );
      expect(usersServiceMock.updateSubscriptionTier).toHaveBeenCalledWith(
        'user-1',
        SubscriptionTier.FREE,
      );
    });

    /**
     * Un remboursement partiel est un geste commercial, pas une annulation de
     * la vente. Couper l'accès transformerait la faveur en sanction.
     */
    it('trace sans rien fermer quand le remboursement est partiel', async () => {
      await service.handleWebhookEvent(chargeRefundedEvent(27900, 5000));

      expect(insertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({ stripe_refund_id: 're_dashboard' }),
      );
      expect(usersServiceMock.updateSubscriptionTier).not.toHaveBeenCalled();
      expect(mockStripeInstance.subscriptions.cancel).not.toHaveBeenCalled();
    });

    it('ignore une charge qui ne correspond à aucun abonnement connu', async () => {
      subscriptionsRepoMock.findOne.mockResolvedValue(null);

      await service.handleWebhookEvent(chargeRefundedEvent(27900, 27900));

      expect(insertBuilder.values).not.toHaveBeenCalled();
      expect(usersServiceMock.updateSubscriptionTier).not.toHaveBeenCalled();
    });

    it('trace quand même si la facture ne peut pas être résolue', async () => {
      mockStripeInstance.invoicePayments.list.mockRejectedValue(
        new Error('stripe indisponible'),
      );

      await service.handleWebhookEvent(chargeRefundedEvent(27900, 27900));

      expect(insertBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          stripe_refund_id: 're_dashboard',
          stripe_invoice_id: null,
        }),
      );
    });
  });
});
