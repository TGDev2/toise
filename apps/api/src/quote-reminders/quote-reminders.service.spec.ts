import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QuoteRemindersService } from './quote-reminders.service';
import { Quote, QuoteStatus } from '../quotes/entities/quote.entity';
import { FeatureGatesService } from '../feature-gates/feature-gates.service';
import { CompanyProfilesService } from '../company-profiles/company-profiles.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { SubscriptionTier } from '../users/entities/user.entity';

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'quote-1',
    user_id: 'user-1',
    project_id: 'project-1',
    client_id: 'client-1',
    estimation_id: 'estimation-1',
    quote_number: 'D-2026-001',
    status: QuoteStatus.SENT,
    labor_items_json: [],
    material_margin_percent: 0,
    discount_percent: 0,
    payment_terms: null,
    validity_days: 30,
    notes: null,
    items_json: [],
    subtotal_materials_ht: 0,
    subtotal_labor_ht: 0,
    total_ht: 1000,
    tva_rate: 20,
    total_ttc: '1200.00' as unknown as number,
    sent_at: new Date(),
    accepted_at: null,
    refused_at: null,
    reminder_7d_sent_at: null,
    reminder_14d_sent_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    user: {
      id: 'user-1',
      email: 'artisan@example.fr',
      subscription_tier: SubscriptionTier.CONTRACTOR_STANDARD,
    } as Quote['user'],
    client: {
      id: 'client-1',
      name: 'Marie Petit',
      email: 'client@example.fr',
    } as Quote['client'],
    ...overrides,
  } as Quote;
}

describe('QuoteRemindersService', () => {
  let service: QuoteRemindersService;

  const quoteRepoMock = {
    find: jest.fn(),
    save: jest.fn(),
  };

  const featureGatesServiceMock = {
    isFeatureAllowed: jest.fn(),
  };

  const companyProfilesServiceMock = {
    findByUserId: jest.fn(),
  };

  const emailServiceMock = {
    sendQuoteReminderClientEmail: jest.fn(),
    sendQuoteReminderContractorEmail: jest.fn(),
  };

  const configServiceMock = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    quoteRepoMock.find.mockResolvedValue([]);
    quoteRepoMock.save.mockImplementation((q: Quote) => Promise.resolve(q));
    featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(true);
    companyProfilesServiceMock.findByUserId.mockResolvedValue({
      raison_sociale: 'Dupont Rénovation',
      phone: '0102030405',
    });
    emailServiceMock.sendQuoteReminderClientEmail.mockResolvedValue(undefined);
    emailServiceMock.sendQuoteReminderContractorEmail.mockResolvedValue(
      undefined,
    );
    configServiceMock.get.mockReturnValue('https://toise.fr');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteRemindersService,
        { provide: getRepositoryToken(Quote), useValue: quoteRepoMock },
        { provide: FeatureGatesService, useValue: featureGatesServiceMock },
        {
          provide: CompanyProfilesService,
          useValue: companyProfilesServiceMock,
        },
        { provide: EmailService, useValue: emailServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get(QuoteRemindersService);
  });

  it('interroge les devis "sent" avec un cutoff à J-7 et J-14, chacun sur sa propre colonne de relance', async () => {
    await service.runDailySweep();

    expect(quoteRepoMock.find).toHaveBeenCalledTimes(2);

    const [call7, call14] = quoteRepoMock.find.mock.calls as [
      [{ where: Record<string, unknown>; relations: string[] }],
      [{ where: Record<string, unknown>; relations: string[] }],
    ];

    const where7 = call7[0].where;
    expect(where7.status).toBe(QuoteStatus.SENT);
    expect((where7.sent_at as { type: string; value: Date }).type).toBe(
      'lessThanOrEqual',
    );
    expect((where7.reminder_7d_sent_at as { type: string }).type).toBe(
      'isNull',
    );
    expect(where7.reminder_14d_sent_at).toBeUndefined();
    expect(call7[0].relations).toEqual(['user', 'client']);

    const cutoff7 = (where7.sent_at as { value: Date }).value;
    const expectedCutoff7 = new Date();
    expectedCutoff7.setDate(expectedCutoff7.getDate() - 7);
    expect(
      Math.abs(cutoff7.getTime() - expectedCutoff7.getTime()),
    ).toBeLessThan(60_000);

    const where14 = call14[0].where;
    expect((where14.reminder_14d_sent_at as { type: string }).type).toBe(
      'isNull',
    );
    expect(where14.reminder_7d_sent_at).toBeUndefined();
  });

  it('envoie les deux e-mails et stampe la colonne pour un devis éligible', async () => {
    const quote = makeQuote();
    quoteRepoMock.find.mockResolvedValueOnce([quote]).mockResolvedValueOnce([]);

    await service.runDailySweep();

    expect(featureGatesServiceMock.isFeatureAllowed).toHaveBeenCalledWith(
      'quote_reminders',
      SubscriptionTier.CONTRACTOR_STANDARD,
    );
    expect(emailServiceMock.sendQuoteReminderClientEmail).toHaveBeenCalledWith(
      'client@example.fr',
      expect.objectContaining({
        quoteNumber: 'D-2026-001',
        totalTtc: 1200,
        daysSinceSent: 7,
        companyName: 'Dupont Rénovation',
      }),
    );
    expect(
      emailServiceMock.sendQuoteReminderContractorEmail,
    ).toHaveBeenCalledWith(
      'artisan@example.fr',
      expect.objectContaining({
        quoteNumber: 'D-2026-001',
        totalTtc: 1200,
        daysSinceSent: 7,
        clientName: 'Marie Petit',
        quoteUrl: 'https://toise.fr/quotes/quote-1',
      }),
    );
    expect(quoteRepoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reminder_7d_sent_at: expect.any(Date) as Date,
      }),
    );
  });

  it('ne relance pas et ne stampe pas quand la gate refuse le palier de l’artisan', async () => {
    featureGatesServiceMock.isFeatureAllowed.mockResolvedValue(false);
    const quote = makeQuote();
    quoteRepoMock.find.mockResolvedValueOnce([quote]).mockResolvedValueOnce([]);

    await service.runDailySweep();

    expect(
      emailServiceMock.sendQuoteReminderClientEmail,
    ).not.toHaveBeenCalled();
    expect(
      emailServiceMock.sendQuoteReminderContractorEmail,
    ).not.toHaveBeenCalled();
    expect(quoteRepoMock.save).not.toHaveBeenCalled();
  });

  it("n'envoie que l'e-mail artisan quand le devis n'a pas de client rattaché, et stampe quand même", async () => {
    const quote = makeQuote({ client_id: null, client: null });
    quoteRepoMock.find.mockResolvedValueOnce([quote]).mockResolvedValueOnce([]);

    await service.runDailySweep();

    expect(
      emailServiceMock.sendQuoteReminderClientEmail,
    ).not.toHaveBeenCalled();
    expect(
      emailServiceMock.sendQuoteReminderContractorEmail,
    ).toHaveBeenCalled();
    expect(quoteRepoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reminder_7d_sent_at: expect.any(Date) as Date,
      }),
    );
  });

  it("n'envoie que l'e-mail artisan quand le client n'a pas d'e-mail renseigné", async () => {
    const quote = makeQuote({
      client: {
        id: 'client-1',
        name: 'Marie Petit',
        email: null,
      } as Quote['client'],
    });
    quoteRepoMock.find.mockResolvedValueOnce([quote]).mockResolvedValueOnce([]);

    await service.runDailySweep();

    expect(
      emailServiceMock.sendQuoteReminderClientEmail,
    ).not.toHaveBeenCalled();
    expect(
      emailServiceMock.sendQuoteReminderContractorEmail,
    ).toHaveBeenCalled();
  });

  it("n'envoie que l'e-mail client quand l'artisan n'a pas d'e-mail renseigné, et stampe quand même", async () => {
    const quote = makeQuote({
      user: {
        id: 'user-1',
        email: null,
        subscription_tier: SubscriptionTier.CONTRACTOR_STANDARD,
      } as Quote['user'],
    });
    quoteRepoMock.find.mockResolvedValueOnce([quote]).mockResolvedValueOnce([]);

    await service.runDailySweep();

    expect(emailServiceMock.sendQuoteReminderClientEmail).toHaveBeenCalled();
    expect(
      emailServiceMock.sendQuoteReminderContractorEmail,
    ).not.toHaveBeenCalled();
    expect(quoteRepoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reminder_7d_sent_at: expect.any(Date) as Date,
      }),
    );
  });

  it("tente quand même l'e-mail artisan et stampe si l'envoi client échoue", async () => {
    emailServiceMock.sendQuoteReminderClientEmail.mockRejectedValueOnce(
      new Error('Brevo indisponible'),
    );
    const quote = makeQuote();
    quoteRepoMock.find.mockResolvedValueOnce([quote]).mockResolvedValueOnce([]);

    await expect(service.runDailySweep()).resolves.toBeUndefined();

    expect(
      emailServiceMock.sendQuoteReminderContractorEmail,
    ).toHaveBeenCalled();
    expect(quoteRepoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reminder_7d_sent_at: expect.any(Date) as Date,
      }),
    );
  });

  it("l'échec de l'e-mail artisan n'affecte pas l'envoi client ni les devis suivants", async () => {
    emailServiceMock.sendQuoteReminderContractorEmail.mockRejectedValueOnce(
      new Error('Brevo indisponible'),
    );
    const quoteA = makeQuote({ id: 'quote-a', quote_number: 'D-2026-001' });
    const quoteB = makeQuote({ id: 'quote-b', quote_number: 'D-2026-002' });
    quoteRepoMock.find
      .mockResolvedValueOnce([quoteA, quoteB])
      .mockResolvedValueOnce([]);

    await service.runDailySweep();

    expect(emailServiceMock.sendQuoteReminderClientEmail).toHaveBeenCalledTimes(
      2,
    );
    expect(quoteRepoMock.save).toHaveBeenCalledTimes(2);
  });

  it("une exception inattendue sur un devis n'interrompt pas le traitement des autres devis du même sweep", async () => {
    featureGatesServiceMock.isFeatureAllowed
      .mockRejectedValueOnce(new Error('DB down'))
      .mockResolvedValue(true);
    const quoteA = makeQuote({ id: 'quote-a', quote_number: 'D-2026-001' });
    const quoteB = makeQuote({ id: 'quote-b', quote_number: 'D-2026-002' });
    quoteRepoMock.find
      .mockResolvedValueOnce([quoteA, quoteB])
      .mockResolvedValueOnce([]);

    await expect(service.runDailySweep()).resolves.toBeUndefined();

    expect(emailServiceMock.sendQuoteReminderClientEmail).toHaveBeenCalledTimes(
      1,
    );
    expect(quoteRepoMock.save).toHaveBeenCalledTimes(1);
  });

  it('un devis en retard de plus de 14 jours jamais relancé reçoit les deux relances dans le même run', async () => {
    const quote = makeQuote();
    quoteRepoMock.find
      .mockResolvedValueOnce([quote]) // passe J7
      .mockResolvedValueOnce([quote]); // passe J14 (même devis, jamais relancé)

    await service.runDailySweep();

    expect(emailServiceMock.sendQuoteReminderClientEmail).toHaveBeenCalledTimes(
      2,
    );
    expect(quote.reminder_7d_sent_at).toBeInstanceOf(Date);
    expect(quote.reminder_14d_sent_at).toBeInstanceOf(Date);
  });
});
