import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { BrevoClientService } from './brevo-client.service';
import { EstimationLineItem } from '../estimations/entities/estimation-result.entity';

interface SentEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const brevoClientMock = {
  sendTransactionalEmail: jest.fn(),
};

function makeItem(
  overrides: Partial<EstimationLineItem> = {},
): EstimationLineItem {
  return {
    work_item_id: 'public',
    work_type_code: 'wall_painting',
    work_type_label: 'Peinture murale',
    material_id: 'mat-paint',
    material_name: 'Peinture acrylique mate',
    material_unit: 'L',
    gross_surface_m2: 12,
    surface_m2: 10,
    theoretical_qty: 1,
    waste_factor_percent: 5,
    waste_factor_source: 'catalog',
    adjusted_qty: 1.05,
    packaging_label: 'Pot 2,5 L',
    packaging_qty_per_unit: 2.5,
    units_needed: 1,
    pose_type: 'standard',
    ...overrides,
  };
}

describe('EmailService.sendCalculatorResultEmail', () => {
  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    brevoClientMock.sendTransactionalEmail.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: BrevoClientService, useValue: brevoClientMock },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  it('builds a subject containing the work type label and forwards it to the Brevo client', async () => {
    await service.sendCalculatorResultEmail('visiteur@example.fr', {
      workTypeLabel: 'Peinture murale',
      items: [makeItem()],
    });

    expect(brevoClientMock.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'visiteur@example.fr',
        subject: 'Votre estimation Toisé — Peinture murale',
      }),
    );
  });

  it('includes each item name and quantity in both the html and text bodies', async () => {
    await service.sendCalculatorResultEmail('visiteur@example.fr', {
      workTypeLabel: 'Peinture murale',
      items: [
        makeItem({ material_name: 'Peinture acrylique mate', units_needed: 3 }),
      ],
    });

    const [sent] = brevoClientMock.sendTransactionalEmail.mock.calls[0] as [
      SentEmail,
    ];
    expect(sent.html).toContain('Peinture acrylique mate');
    expect(sent.html).toContain('3');
    expect(sent.text).toContain('Peinture acrylique mate');
    expect(sent.text).toContain('3');
  });

  it('escapes HTML-significant characters in the html body but not in the text body', async () => {
    await service.sendCalculatorResultEmail('visiteur@example.fr', {
      workTypeLabel: 'Peinture murale',
      items: [makeItem({ material_name: 'Peinture <Pro> & fils' })],
    });

    const [sent] = brevoClientMock.sendTransactionalEmail.mock.calls[0] as [
      SentEmail,
    ];
    expect(sent.html).not.toContain('<Pro>');
    expect(sent.html).toContain('&lt;Pro&gt;');
    expect(sent.text).toContain('Peinture <Pro> & fils');
  });
});

describe('EmailService.sendQuoteReminderClientEmail', () => {
  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    brevoClientMock.sendTransactionalEmail.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: BrevoClientService, useValue: brevoClientMock },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  it('mentionne le numéro de devis, le montant et le délai dans le sujet', async () => {
    await service.sendQuoteReminderClientEmail('client@example.fr', {
      quoteNumber: 'D-2026-001',
      totalTtc: 1250.5,
      daysSinceSent: 7,
      companyName: 'Dupont Rénovation',
      contractorEmail: 'contact@dupont-renovation.fr',
      contractorPhone: '0102030405',
    });

    expect(brevoClientMock.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.fr',
        subject: expect.stringContaining('D-2026-001') as string,
      }),
    );
  });

  it("retombe sur une formulation générique quand le nom de l'entreprise est absent", async () => {
    await service.sendQuoteReminderClientEmail('client@example.fr', {
      quoteNumber: 'D-2026-001',
      totalTtc: 500,
      daysSinceSent: 14,
      companyName: null,
      contractorEmail: null,
      contractorPhone: null,
    });

    const [sent] = brevoClientMock.sendTransactionalEmail.mock.calls[0] as [
      SentEmail,
    ];
    expect(sent.html).toContain('votre artisan');
    expect(sent.text).toContain('Votre artisan');
  });

  it('échappe les caractères HTML du nom d’entreprise dans le corps html', async () => {
    await service.sendQuoteReminderClientEmail('client@example.fr', {
      quoteNumber: 'D-2026-001',
      totalTtc: 500,
      daysSinceSent: 7,
      companyName: 'Dupont <Pro> & fils',
      contractorEmail: null,
      contractorPhone: null,
    });

    const [sent] = brevoClientMock.sendTransactionalEmail.mock.calls[0] as [
      SentEmail,
    ];
    expect(sent.html).not.toContain('<Pro>');
    expect(sent.html).toContain('&lt;Pro&gt;');
    expect(sent.text).toContain('Dupont <Pro> & fils');
  });
});

describe('EmailService.sendQuoteReminderContractorEmail', () => {
  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    brevoClientMock.sendTransactionalEmail.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: BrevoClientService, useValue: brevoClientMock },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  it('inclut le lien du devis et le délai dans le corps', async () => {
    await service.sendQuoteReminderContractorEmail('artisan@example.fr', {
      quoteNumber: 'D-2026-002',
      totalTtc: 890,
      daysSinceSent: 14,
      clientName: 'Marie Petit',
      quoteUrl: 'https://toise.fr/quotes/quote-id-1',
    });

    const [sent] = brevoClientMock.sendTransactionalEmail.mock.calls[0] as [
      SentEmail,
    ];
    expect(sent.subject).toContain('D-2026-002');
    expect(sent.html).toContain('https://toise.fr/quotes/quote-id-1');
    expect(sent.text).toContain('https://toise.fr/quotes/quote-id-1');
  });

  it("retombe sur 'Le client' quand le nom du client est absent", async () => {
    await service.sendQuoteReminderContractorEmail('artisan@example.fr', {
      quoteNumber: 'D-2026-002',
      totalTtc: 890,
      daysSinceSent: 7,
      clientName: null,
      quoteUrl: 'https://toise.fr/quotes/quote-id-1',
    });

    const [sent] = brevoClientMock.sendTransactionalEmail.mock.calls[0] as [
      SentEmail,
    ];
    expect(sent.html).toContain('Le client');
    expect(sent.text).toContain('Le client');
  });

  it('échappe les caractères HTML du nom du client dans le corps html', async () => {
    await service.sendQuoteReminderContractorEmail('artisan@example.fr', {
      quoteNumber: 'D-2026-002',
      totalTtc: 890,
      daysSinceSent: 7,
      clientName: 'Marie <Petit> & fils',
      quoteUrl: 'https://toise.fr/quotes/quote-id-1',
    });

    const [sent] = brevoClientMock.sendTransactionalEmail.mock.calls[0] as [
      SentEmail,
    ];
    expect(sent.html).not.toContain('<Petit>');
    expect(sent.html).toContain('&lt;Petit&gt;');
    expect(sent.text).toContain('Marie <Petit> & fils');
  });
});

describe('EmailService.sendOnboardingD1Email', () => {
  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    brevoClientMock.sendTransactionalEmail.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: BrevoClientService, useValue: brevoClientMock },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  it("inclut le lien du dashboard dans le corps de l'e-mail", async () => {
    await service.sendOnboardingD1Email('nouveau@example.fr', {
      dashboardUrl: 'https://toise.fr/dashboard',
    });

    const [sent] = brevoClientMock.sendTransactionalEmail.mock.calls[0] as [
      SentEmail,
    ];
    expect(sent.to).toBe('nouveau@example.fr');
    expect(sent.html).toContain('https://toise.fr/dashboard');
    expect(sent.text).toContain('https://toise.fr/dashboard');
  });
});

describe('EmailService.sendOnboardingD3Email', () => {
  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    brevoClientMock.sendTransactionalEmail.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: BrevoClientService, useValue: brevoClientMock },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  it('propose de reprendre le projet quand hasProject vaut true', async () => {
    await service.sendOnboardingD3Email('utilisateur@example.fr', {
      dashboardUrl: 'https://toise.fr/dashboard',
      hasProject: true,
    });

    const [sent] = brevoClientMock.sendTransactionalEmail.mock.calls[0] as [
      SentEmail,
    ];
    expect(sent.subject).toContain('projet');
    expect(sent.html).toContain('Reprendre mon projet');
  });

  it('propose de créer un premier projet quand hasProject vaut false', async () => {
    await service.sendOnboardingD3Email('utilisateur@example.fr', {
      dashboardUrl: 'https://toise.fr/dashboard',
      hasProject: false,
    });

    const [sent] = brevoClientMock.sendTransactionalEmail.mock.calls[0] as [
      SentEmail,
    ];
    expect(sent.html).toContain('Créer mon premier projet');
  });
});

describe('EmailService.sendProjectAbandonedEmail', () => {
  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    brevoClientMock.sendTransactionalEmail.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: BrevoClientService, useValue: brevoClientMock },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  it('mentionne le nom du projet et son lien', async () => {
    await service.sendProjectAbandonedEmail('utilisateur@example.fr', {
      projectName: 'Salon',
      projectUrl: 'https://toise.fr/projects/project-1',
    });

    const [sent] = brevoClientMock.sendTransactionalEmail.mock.calls[0] as [
      SentEmail,
    ];
    expect(sent.subject).toContain('Salon');
    expect(sent.html).toContain('https://toise.fr/projects/project-1');
    expect(sent.text).toContain('https://toise.fr/projects/project-1');
  });

  it('échappe les caractères HTML du nom du projet dans le corps html', async () => {
    await service.sendProjectAbandonedEmail('utilisateur@example.fr', {
      projectName: 'Salon <Pro> & cuisine',
      projectUrl: 'https://toise.fr/projects/project-1',
    });

    const [sent] = brevoClientMock.sendTransactionalEmail.mock.calls[0] as [
      SentEmail,
    ];
    expect(sent.html).not.toContain('<Pro>');
    expect(sent.html).toContain('&lt;Pro&gt;');
    expect(sent.text).toContain('Salon <Pro> & cuisine');
  });
});

describe('EmailService.sendTrialEndingSoonEmail', () => {
  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    brevoClientMock.sendTransactionalEmail.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: BrevoClientService, useValue: brevoClientMock },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  it('mentionne le nombre de jours restants et le prix qui sera facturé', async () => {
    await service.sendTrialEndingSoonEmail('utilisateur@example.fr', {
      daysRemaining: 3,
      priceEuros: 9.99,
      billingPeriodLabel: 'par an',
      manageSubscriptionUrl: 'https://toise.fr/subscription',
    });

    const [sent] = brevoClientMock.sendTransactionalEmail.mock.calls[0] as [
      SentEmail,
    ];
    expect(sent.subject).toContain('3 jours');
    expect(sent.html).toContain('9,99 €');
    expect(sent.html).toContain('https://toise.fr/subscription');
  });

  it("accorde le singulier quand il ne reste qu'un jour", async () => {
    await service.sendTrialEndingSoonEmail('utilisateur@example.fr', {
      daysRemaining: 1,
      priceEuros: 9.99,
      billingPeriodLabel: 'par an',
      manageSubscriptionUrl: 'https://toise.fr/subscription',
    });

    const [sent] = brevoClientMock.sendTransactionalEmail.mock.calls[0] as [
      SentEmail,
    ];
    expect(sent.subject).toContain('1 jour');
    expect(sent.subject).not.toContain('1 jours');
  });
});
