import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ReferralsService } from './referrals.service';
import { User } from '../users/entities/user.entity';
import {
  ReferralCredit,
  ReferralCreditStatus,
} from './entities/referral-credit.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { EmailService } from '../email/email.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';
import {
  getDefaultPlan,
  monthlyEquivalentEuros,
} from '../subscriptions/plans.constants';

// Même patron que subscriptions.service.spec.ts : instance factice couvrant
// exactement la surface Stripe utilisée par ce service.
const mockStripeInstance = {
  customers: { createBalanceTransaction: jest.fn() },
};

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => mockStripeInstance),
);

const CONFIG_VALUES: Record<string, string> = {
  'stripe.secretKey': 'sk_test_123',
  publicUrl: 'https://chiffreo.fr',
};

const configServiceMock = {
  get: jest.fn((key: string) => CONFIG_VALUES[key]),
};

const referralCreditsQueryBuilderMock = {
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  orIgnore: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({}),
};

const usersRepoMock = {
  findOneByOrFail: jest.fn(),
  findOneBy: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
};

const referralCreditsRepoMock = {
  createQueryBuilder: jest.fn(() => referralCreditsQueryBuilderMock),
  findOneByOrFail: jest.fn(),
  update: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
};

const subscriptionsRepoMock = {
  findOne: jest.fn(),
};

const emailServiceMock = {
  sendReferralCreditEmail: jest.fn(),
};

const analyticsServiceMock = {
  track: jest.fn(),
};

describe('ReferralsService', () => {
  let service: ReferralsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    usersRepoMock.update.mockResolvedValue({ affected: 1 });
    referralCreditsQueryBuilderMock.execute.mockResolvedValue({});
    mockStripeInstance.customers.createBalanceTransaction.mockResolvedValue({
      id: 'cbt_1',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        { provide: getRepositoryToken(User), useValue: usersRepoMock },
        {
          provide: getRepositoryToken(ReferralCredit),
          useValue: referralCreditsRepoMock,
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionsRepoMock,
        },
        { provide: EmailService, useValue: emailServiceMock },
        { provide: AnalyticsService, useValue: analyticsServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get(ReferralsService);
  });

  describe('getOrCreateReferralCode', () => {
    it('returns the existing code without generating a new one', async () => {
      usersRepoMock.findOneByOrFail.mockResolvedValue({
        referral_code: 'ABCD2345',
      });

      const code = await service.getOrCreateReferralCode('user-1');

      expect(code).toBe('ABCD2345');
      expect(usersRepoMock.update).not.toHaveBeenCalled();
    });

    it('generates and persists a new code when none exists', async () => {
      usersRepoMock.findOneByOrFail.mockResolvedValue({ referral_code: null });
      usersRepoMock.update.mockResolvedValue({ affected: 1 });

      const code = await service.getOrCreateReferralCode('user-1');

      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
      expect(usersRepoMock.update).toHaveBeenCalledTimes(1);
    });

    it('re-reads the persisted code when a concurrent request wins the race (affected=0)', async () => {
      usersRepoMock.findOneByOrFail
        .mockResolvedValueOnce({ referral_code: null })
        .mockResolvedValueOnce({ referral_code: 'ZZZZ9999' });
      usersRepoMock.update.mockResolvedValue({ affected: 0 });

      const code = await service.getOrCreateReferralCode('user-1');

      expect(code).toBe('ZZZZ9999');
    });

    it('retries on a unique-constraint collision and eventually succeeds', async () => {
      usersRepoMock.findOneByOrFail.mockResolvedValue({ referral_code: null });
      usersRepoMock.update
        .mockRejectedValueOnce(new Error('duplicate key value'))
        .mockResolvedValueOnce({ affected: 1 });

      const code = await service.getOrCreateReferralCode('user-1');

      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
      expect(usersRepoMock.update).toHaveBeenCalledTimes(2);
    });

    it('throws after exhausting all generation attempts', async () => {
      usersRepoMock.findOneByOrFail.mockResolvedValue({ referral_code: null });
      usersRepoMock.update.mockRejectedValue(new Error('duplicate key value'));

      await expect(service.getOrCreateReferralCode('user-1')).rejects.toThrow(
        'Impossible de générer un code de parrainage unique.',
      );
      expect(usersRepoMock.update).toHaveBeenCalledTimes(5);
    });
  });

  describe('redeemCode', () => {
    const baseUser = (overrides: Partial<User> = {}): User =>
      ({
        id: 'user-2',
        referred_by_user_id: null,
        created_at: new Date(),
        ...overrides,
      }) as User;

    it('is a no-op when the user is already referred', async () => {
      const user = baseUser({ referred_by_user_id: 'someone-else' });

      const result = await service.redeemCode(user, 'CODE1234');

      expect(result).toEqual({ redeemed: false });
      expect(usersRepoMock.findOneBy).not.toHaveBeenCalled();
    });

    it('is a no-op when the account is older than the 7-day redemption window', async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const user = baseUser({ created_at: eightDaysAgo });

      const result = await service.redeemCode(user, 'CODE1234');

      expect(result).toEqual({ redeemed: false });
      expect(usersRepoMock.findOneBy).not.toHaveBeenCalled();
    });

    it('is a no-op on self-referral', async () => {
      const user = baseUser();
      usersRepoMock.findOneBy.mockResolvedValue({ id: user.id });

      const result = await service.redeemCode(user, 'CODE1234');

      expect(result).toEqual({ redeemed: false });
      expect(usersRepoMock.update).not.toHaveBeenCalled();
    });

    it('is a no-op when the code does not match any user', async () => {
      const user = baseUser();
      usersRepoMock.findOneBy.mockResolvedValue(null);

      const result = await service.redeemCode(user, 'UNKNOWN1');

      expect(result).toEqual({ redeemed: false });
    });

    it('attaches the referrer and tracks analytics on success', async () => {
      const user = baseUser();
      usersRepoMock.findOneBy.mockResolvedValue({ id: 'referrer-1' });
      usersRepoMock.update.mockResolvedValue({ affected: 1 });

      const result = await service.redeemCode(user, ' code1234 ');

      expect(result).toEqual({ redeemed: true });
      expect(usersRepoMock.findOneBy).toHaveBeenCalledWith({
        referral_code: 'CODE1234',
      });
      expect(analyticsServiceMock.track).toHaveBeenCalledWith(
        AnalyticsEventName.REFERRAL_REDEEMED,
        user.id,
        { referrer_id: 'referrer-1' },
      );
    });
  });

  describe('handleReferredUserConverted', () => {
    it('is a no-op when the user was not referred by anyone', async () => {
      usersRepoMock.findOneBy.mockResolvedValue({
        id: 'referred-1',
        referred_by_user_id: null,
        referral_converted_at: null,
      });

      await service.handleReferredUserConverted('referred-1');

      expect(referralCreditsQueryBuilderMock.execute).not.toHaveBeenCalled();
    });

    it('is a no-op when already converted (idempotent on webhook retry)', async () => {
      usersRepoMock.findOneBy.mockResolvedValue({
        id: 'referred-1',
        referred_by_user_id: 'referrer-1',
        referral_converted_at: new Date(),
      });

      await service.handleReferredUserConverted('referred-1');

      expect(referralCreditsQueryBuilderMock.execute).not.toHaveBeenCalled();
      expect(usersRepoMock.update).not.toHaveBeenCalled();
    });

    it('applies the Stripe credit and notifies the referrer when a customer already exists', async () => {
      usersRepoMock.findOneBy
        .mockResolvedValueOnce({
          id: 'referred-1',
          referred_by_user_id: 'referrer-1',
          referral_converted_at: null,
        })
        // notifyReferrer lookup
        .mockResolvedValueOnce({
          id: 'referrer-1',
          email: 'referrer@chiffreo.fr',
        });
      referralCreditsRepoMock.findOneByOrFail.mockResolvedValue({
        id: 'credit-1',
        referrer_user_id: 'referrer-1',
        referred_user_id: 'referred-1',
        amount_cents: 1900,
        currency: 'eur',
        status: ReferralCreditStatus.PENDING,
      });
      subscriptionsRepoMock.findOne.mockResolvedValue({
        stripe_customer_id: 'cus_referrer',
      });

      await service.handleReferredUserConverted('referred-1');

      expect(
        mockStripeInstance.customers.createBalanceTransaction,
      ).toHaveBeenCalledWith(
        'cus_referrer',
        {
          // Le montant appliqué vient du crédit **stocké**, pas du plan
          // courant : un crédit acquis quand l'offre valait 19 €/mois reste
          // dû à 1 900 centimes même après le passage à l'annuel.
          amount: -1900,
          currency: 'eur',
          description: expect.any(String) as string,
        },
        { idempotencyKey: 'referral-credit-credit-1' },
      );
      expect(referralCreditsRepoMock.update).toHaveBeenCalledWith('credit-1', {
        status: ReferralCreditStatus.APPLIED,
        applied_at: expect.any(Date) as Date,
        stripe_balance_transaction_id: 'cbt_1',
      });
      expect(emailServiceMock.sendReferralCreditEmail).toHaveBeenCalledWith(
        'referrer@chiffreo.fr',
        expect.objectContaining({
          amountEuros: monthlyEquivalentEuros(getDefaultPlan()),
        }),
      );
      // Le crédit **créé** pour cette conversion, lui, suit le plan courant.
      // C'est le seul endroit où le passage à l'annuel change un montant, et
      // il n'était couvert par rien : lu comme `plan.price`, « 1 mois offert »
      // aurait rendu 279 € — l'année entière, pour un filleul à 279 € (E3-3).
      expect(referralCreditsQueryBuilderMock.values).toHaveBeenCalledWith(
        expect.objectContaining({
          amount_cents: Math.round(
            monthlyEquivalentEuros(getDefaultPlan()) * 100,
          ),
          currency: 'eur',
        }),
      );
      expect(usersRepoMock.update).toHaveBeenCalledWith('referred-1', {
        referral_converted_at: expect.any(Date) as Date,
      });
    });

    it('leaves the credit pending but still marks conversion when the referrer has no Stripe customer yet', async () => {
      usersRepoMock.findOneBy.mockResolvedValue({
        id: 'referred-1',
        referred_by_user_id: 'referrer-1',
        referral_converted_at: null,
      });
      referralCreditsRepoMock.findOneByOrFail.mockResolvedValue({
        id: 'credit-1',
        referrer_user_id: 'referrer-1',
        referred_user_id: 'referred-1',
        amount_cents: 1900,
        currency: 'eur',
        status: ReferralCreditStatus.PENDING,
      });
      subscriptionsRepoMock.findOne.mockResolvedValue(null);

      await service.handleReferredUserConverted('referred-1');

      expect(
        mockStripeInstance.customers.createBalanceTransaction,
      ).not.toHaveBeenCalled();
      expect(usersRepoMock.update).toHaveBeenCalledWith('referred-1', {
        referral_converted_at: expect.any(Date) as Date,
      });
    });

    it('does not re-apply the credit on a second call once conversion is persisted', async () => {
      usersRepoMock.findOneBy
        .mockResolvedValueOnce({
          id: 'referred-1',
          referred_by_user_id: 'referrer-1',
          referral_converted_at: null,
        })
        .mockResolvedValueOnce({
          id: 'referrer-1',
          email: 'referrer@chiffreo.fr',
        });
      referralCreditsRepoMock.findOneByOrFail.mockResolvedValue({
        id: 'credit-1',
        referrer_user_id: 'referrer-1',
        referred_user_id: 'referred-1',
        amount_cents: 1900,
        currency: 'eur',
        status: ReferralCreditStatus.PENDING,
      });
      subscriptionsRepoMock.findOne.mockResolvedValue({
        stripe_customer_id: 'cus_referrer',
      });

      await service.handleReferredUserConverted('referred-1');

      // Simule le retry Stripe : la conversion est désormais persistée.
      usersRepoMock.findOneBy.mockResolvedValueOnce({
        id: 'referred-1',
        referred_by_user_id: 'referrer-1',
        referral_converted_at: new Date(),
      });

      await service.handleReferredUserConverted('referred-1');

      expect(
        mockStripeInstance.customers.createBalanceTransaction,
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('applyPendingCreditsForNewCustomer', () => {
    it('applies every pending credit and does not let one failure block the others', async () => {
      referralCreditsRepoMock.find.mockResolvedValue([
        {
          id: 'credit-1',
          referrer_user_id: 'referrer-1',
          amount_cents: 1900,
          currency: 'eur',
          status: ReferralCreditStatus.PENDING,
        },
        {
          id: 'credit-2',
          referrer_user_id: 'referrer-1',
          amount_cents: 1900,
          currency: 'eur',
          status: ReferralCreditStatus.PENDING,
        },
      ]);
      usersRepoMock.findOneBy.mockResolvedValue({
        id: 'referrer-1',
        email: 'referrer@chiffreo.fr',
      });
      mockStripeInstance.customers.createBalanceTransaction
        .mockRejectedValueOnce(new Error('stripe down'))
        .mockResolvedValueOnce({ id: 'cbt_2' });

      await service.applyPendingCreditsForNewCustomer('referrer-1', 'cus_new');

      expect(
        mockStripeInstance.customers.createBalanceTransaction,
      ).toHaveBeenCalledTimes(2);
      expect(referralCreditsRepoMock.update).toHaveBeenCalledTimes(1);
      expect(referralCreditsRepoMock.update).toHaveBeenCalledWith('credit-2', {
        status: ReferralCreditStatus.APPLIED,
        applied_at: expect.any(Date) as Date,
        stripe_balance_transaction_id: 'cbt_2',
      });
    });
  });
});
