import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { LifecycleEmailsService } from './lifecycle-emails.service';
import { LifecycleEmailType } from './lifecycle-email-type.enum';
import { LifecycleEmailSend } from './entities/lifecycle-email-send.entity';
import { User, AuthProvider } from '../users/entities/user.entity';
import { Project, ProjectStatus } from '../projects/entities/project.entity';
import {
  Subscription,
  SubscriptionStatus,
} from '../subscriptions/entities/subscription.entity';
import { EmailService } from '../email/email.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'utilisateur@example.fr',
    auth_provider: AuthProvider.EMAIL,
    created_at: new Date(),
    ...overrides,
  } as User;
}

function makeRoom(dimensions: unknown): Project['rooms'][number] {
  return { id: 'room-1', dimensions } as Project['rooms'][number];
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    user_id: 'user-1',
    name: 'Salon',
    status: ProjectStatus.DRAFT,
    created_at: new Date(),
    rooms: [makeRoom({ id: 'dim-1' })],
    user: makeUser(),
    ...overrides,
  } as Project;
}

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1',
    user_id: 'user-1',
    status: SubscriptionStatus.TRIALING,
    trial_end: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    user: makeUser(),
    ...overrides,
  } as Subscription;
}

describe('LifecycleEmailsService', () => {
  let service: LifecycleEmailsService;

  const userRepoMock = { find: jest.fn() };
  const projectRepoMock = { find: jest.fn(), count: jest.fn() };
  const subscriptionRepoMock = { find: jest.fn() };
  const sendsRepoMock = {
    find: jest.fn(),
    create: jest.fn((data: Partial<LifecycleEmailSend>) => data),
    save: jest.fn(),
  };

  const emailServiceMock = {
    sendOnboardingD1Email: jest.fn(),
    sendOnboardingD3Email: jest.fn(),
    sendProjectAbandonedEmail: jest.fn(),
    sendTrialEndingSoonEmail: jest.fn(),
  };

  const analyticsServiceMock = { track: jest.fn() };
  const configServiceMock = { get: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    userRepoMock.find.mockResolvedValue([]);
    projectRepoMock.find.mockResolvedValue([]);
    projectRepoMock.count.mockResolvedValue(0);
    subscriptionRepoMock.find.mockResolvedValue([]);
    sendsRepoMock.find.mockResolvedValue([]);
    sendsRepoMock.save.mockResolvedValue(undefined);
    emailServiceMock.sendOnboardingD1Email.mockResolvedValue(undefined);
    emailServiceMock.sendOnboardingD3Email.mockResolvedValue(undefined);
    emailServiceMock.sendProjectAbandonedEmail.mockResolvedValue(undefined);
    emailServiceMock.sendTrialEndingSoonEmail.mockResolvedValue(undefined);
    configServiceMock.get.mockReturnValue('https://chiffreo.fr');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LifecycleEmailsService,
        { provide: getRepositoryToken(User), useValue: userRepoMock },
        { provide: getRepositoryToken(Project), useValue: projectRepoMock },
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionRepoMock,
        },
        {
          provide: getRepositoryToken(LifecycleEmailSend),
          useValue: sendsRepoMock,
        },
        { provide: EmailService, useValue: emailServiceMock },
        { provide: AnalyticsService, useValue: analyticsServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get(LifecycleEmailsService);
  });

  it('interroge les 5 sweeps avec les bonnes fenêtres et bons filtres', async () => {
    await service.runDailySweep();

    expect(userRepoMock.find).toHaveBeenCalledTimes(2);
    // Deux passes sur les projets : abandon (draft/active) puis clôture
    // (estimated). Les deux ensembles sont disjoints par construction.
    expect(projectRepoMock.find).toHaveBeenCalledTimes(2);
    expect(subscriptionRepoMock.find).toHaveBeenCalledTimes(1);

    const [d1Call, d3Call] = userRepoMock.find.mock.calls as [
      [{ where: Record<string, unknown> }],
      [{ where: Record<string, unknown> }],
    ];

    expect((d1Call[0].where.email as { type: string }).type).toBe('not');
    expect((d1Call[0].where.auth_provider as { type: string }).type).toBe(
      'not',
    );

    const d1Low = (d1Call[0].where.created_at as { value: [Date, Date] })
      .value[0];
    const d1High = (d1Call[0].where.created_at as { value: [Date, Date] })
      .value[1];
    const expectedD1Low = new Date();
    expectedD1Low.setDate(expectedD1Low.getDate() - 2);
    const expectedD1High = new Date();
    expectedD1High.setDate(expectedD1High.getDate() - 1);
    expect(Math.abs(d1Low.getTime() - expectedD1Low.getTime())).toBeLessThan(
      60_000,
    );
    expect(Math.abs(d1High.getTime() - expectedD1High.getTime())).toBeLessThan(
      60_000,
    );

    const d3Low = (d3Call[0].where.created_at as { value: [Date, Date] })
      .value[0];
    const d3High = (d3Call[0].where.created_at as { value: [Date, Date] })
      .value[1];
    const expectedD3Low = new Date();
    expectedD3Low.setDate(expectedD3Low.getDate() - 4);
    const expectedD3High = new Date();
    expectedD3High.setDate(expectedD3High.getDate() - 3);
    expect(Math.abs(d3Low.getTime() - expectedD3Low.getTime())).toBeLessThan(
      60_000,
    );
    expect(Math.abs(d3High.getTime() - expectedD3High.getTime())).toBeLessThan(
      60_000,
    );

    const [projectCall] = projectRepoMock.find.mock.calls as [
      [{ where: Record<string, unknown> }],
    ];
    const projectWhere = projectCall[0].where;
    expect((projectWhere.status as { type: string }).type).toBe('in');
    expect((projectWhere.status as { value: unknown }).value).toEqual([
      ProjectStatus.DRAFT,
      ProjectStatus.ACTIVE,
    ]);
    const abandonedLow = (projectWhere.created_at as { value: [Date, Date] })
      .value[0];
    const abandonedHigh = (projectWhere.created_at as { value: [Date, Date] })
      .value[1];
    const expectedAbandonedLow = new Date();
    expectedAbandonedLow.setDate(expectedAbandonedLow.getDate() - 12);
    const expectedAbandonedHigh = new Date();
    expectedAbandonedHigh.setDate(expectedAbandonedHigh.getDate() - 5);
    expect(
      Math.abs(abandonedLow.getTime() - expectedAbandonedLow.getTime()),
    ).toBeLessThan(60_000);
    expect(
      Math.abs(abandonedHigh.getTime() - expectedAbandonedHigh.getTime()),
    ).toBeLessThan(60_000);

    // DATA-5 : seconde passe projets — chantiers estimés jamais clôturés.
    const closeoutCall = projectRepoMock.find.mock.calls[1] as [
      { where: Record<string, unknown> },
    ];
    const closeoutWhere = closeoutCall[0].where;
    expect(closeoutWhere.status).toBe(ProjectStatus.ESTIMATED);
    const closeoutLow = (closeoutWhere.updated_at as { value: [Date, Date] })
      .value[0];
    const closeoutHigh = (closeoutWhere.updated_at as { value: [Date, Date] })
      .value[1];
    const expectedCloseoutLow = new Date();
    expectedCloseoutLow.setDate(expectedCloseoutLow.getDate() - 45);
    const expectedCloseoutHigh = new Date();
    expectedCloseoutHigh.setDate(expectedCloseoutHigh.getDate() - 14);
    expect(
      Math.abs(closeoutLow.getTime() - expectedCloseoutLow.getTime()),
    ).toBeLessThan(60_000);
    expect(
      Math.abs(closeoutHigh.getTime() - expectedCloseoutHigh.getTime()),
    ).toBeLessThan(60_000);

    const [subscriptionCall] = subscriptionRepoMock.find.mock.calls as [
      [{ where: Record<string, unknown> }],
    ];
    const subscriptionWhere = subscriptionCall[0].where;
    expect(subscriptionWhere.status).toBe(SubscriptionStatus.TRIALING);
    const trialLow = (subscriptionWhere.trial_end as { value: [Date, Date] })
      .value[0];
    const trialHigh = (subscriptionWhere.trial_end as { value: [Date, Date] })
      .value[1];
    const expectedTrialHigh = new Date();
    expectedTrialHigh.setDate(expectedTrialHigh.getDate() + 3);
    expect(Math.abs(trialLow.getTime() - Date.now())).toBeLessThan(60_000);
    expect(
      Math.abs(trialHigh.getTime() - expectedTrialHigh.getTime()),
    ).toBeLessThan(60_000);
  });

  it('envoie l’onboarding J+1, trace un événement analytics et stampe', async () => {
    const user = makeUser();
    userRepoMock.find.mockResolvedValueOnce([user]).mockResolvedValueOnce([]);

    await service.runDailySweep();

    expect(emailServiceMock.sendOnboardingD1Email).toHaveBeenCalledWith(
      'utilisateur@example.fr',
      expect.objectContaining({
        dashboardUrl: 'https://chiffreo.fr/dashboard',
      }),
    );
    expect(analyticsServiceMock.track).toHaveBeenCalledWith(
      AnalyticsEventName.ONBOARDING_D1_EMAIL_SENT,
      'user-1',
    );
    expect(sendsRepoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        project_id: null,
        email_type: LifecycleEmailType.ONBOARDING_D1,
      }),
    );
  });

  it('onboarding J+3 : hasProject vaut true quand un projet existe déjà', async () => {
    const user = makeUser();
    userRepoMock.find.mockResolvedValueOnce([]).mockResolvedValueOnce([user]);
    projectRepoMock.count.mockResolvedValueOnce(2);

    await service.runDailySweep();

    expect(emailServiceMock.sendOnboardingD3Email).toHaveBeenCalledWith(
      'utilisateur@example.fr',
      expect.objectContaining({ hasProject: true }),
    );
  });

  it('onboarding J+3 : hasProject vaut false quand aucun projet n’existe', async () => {
    const user = makeUser();
    userRepoMock.find.mockResolvedValueOnce([]).mockResolvedValueOnce([user]);
    projectRepoMock.count.mockResolvedValueOnce(0);

    await service.runDailySweep();

    expect(emailServiceMock.sendOnboardingD3Email).toHaveBeenCalledWith(
      'utilisateur@example.fr',
      expect.objectContaining({ hasProject: false }),
    );
  });

  it('projet abandonné : envoie pour un projet draft avec dimensions renseignées', async () => {
    const project = makeProject();
    projectRepoMock.find.mockResolvedValueOnce([project]);

    await service.runDailySweep();

    expect(emailServiceMock.sendProjectAbandonedEmail).toHaveBeenCalledWith(
      'utilisateur@example.fr',
      expect.objectContaining({
        projectName: 'Salon',
        projectUrl: 'https://chiffreo.fr/projects/project-1',
      }),
    );
    expect(analyticsServiceMock.track).toHaveBeenCalledWith(
      AnalyticsEventName.PROJECT_ABANDONED_EMAIL_SENT,
      'user-1',
      { project_id: 'project-1' },
    );
    expect(sendsRepoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        project_id: 'project-1',
        email_type: LifecycleEmailType.PROJECT_ABANDONED,
      }),
    );
  });

  it('projet abandonné : ignore un projet sans aucune dimension renseignée', async () => {
    const project = makeProject({ rooms: [makeRoom(null)] });
    projectRepoMock.find.mockResolvedValueOnce([project]);

    await service.runDailySweep();

    expect(emailServiceMock.sendProjectAbandonedEmail).not.toHaveBeenCalled();
  });

  it('fin d’essai Pro : envoie et calcule les jours restants', async () => {
    const subscription = makeSubscription({
      trial_end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
    subscriptionRepoMock.find.mockResolvedValueOnce([subscription]);

    await service.runDailySweep();

    expect(emailServiceMock.sendTrialEndingSoonEmail).toHaveBeenCalledWith(
      'utilisateur@example.fr',
      expect.objectContaining({
        daysRemaining: 3,
        priceEuros: 9.99,
        manageSubscriptionUrl: 'https://chiffreo.fr/subscription',
      }),
    );
    expect(sendsRepoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        project_id: null,
        email_type: LifecycleEmailType.TRIAL_ENDING_SOON,
      }),
    );
  });

  it('ne renvoie pas un e-mail déjà tracé dans lifecycle_email_sends (les 4 types)', async () => {
    const user = makeUser();
    const project = makeProject();
    const subscription = makeSubscription();
    userRepoMock.find
      .mockResolvedValueOnce([user])
      .mockResolvedValueOnce([user]);
    projectRepoMock.find.mockResolvedValueOnce([project]);
    subscriptionRepoMock.find.mockResolvedValueOnce([subscription]);
    sendsRepoMock.find
      .mockResolvedValueOnce([{ user_id: 'user-1' }]) // D1 déjà envoyé
      .mockResolvedValueOnce([{ user_id: 'user-1' }]) // D3 déjà envoyé
      .mockResolvedValueOnce([{ project_id: 'project-1' }]) // abandon déjà envoyé
      .mockResolvedValueOnce([{ user_id: 'user-1' }]); // trial déjà envoyé

    await service.runDailySweep();

    expect(emailServiceMock.sendOnboardingD1Email).not.toHaveBeenCalled();
    expect(emailServiceMock.sendOnboardingD3Email).not.toHaveBeenCalled();
    expect(emailServiceMock.sendProjectAbandonedEmail).not.toHaveBeenCalled();
    expect(emailServiceMock.sendTrialEndingSoonEmail).not.toHaveBeenCalled();
    expect(sendsRepoMock.save).not.toHaveBeenCalled();
  });

  it("un échec d'envoi n'empêche pas le stamp, ni les autres enregistrements du lot", async () => {
    const userA = makeUser({ id: 'user-a', email: 'a@example.fr' });
    const userB = makeUser({ id: 'user-b', email: 'b@example.fr' });
    userRepoMock.find
      .mockResolvedValueOnce([userA, userB])
      .mockResolvedValueOnce([]);
    emailServiceMock.sendOnboardingD1Email.mockRejectedValueOnce(
      new Error('Brevo indisponible'),
    );

    await expect(service.runDailySweep()).resolves.toBeUndefined();

    expect(emailServiceMock.sendOnboardingD1Email).toHaveBeenCalledTimes(2);
    expect(sendsRepoMock.save).toHaveBeenCalledTimes(2);
    expect(sendsRepoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-a' }),
    );
    expect(sendsRepoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-b' }),
    );
  });

  it("une exception inattendue sur un enregistrement n'interrompt pas le sweep", async () => {
    const projectA = makeProject({ id: 'project-a', name: 'Salon' });
    const projectB = makeProject({
      id: 'project-b',
      name: 'Cuisine',
      user_id: 'user-2',
      user: makeUser({ id: 'user-2', email: 'user2@example.fr' }),
    });
    projectRepoMock.find.mockResolvedValueOnce([projectA, projectB]);
    emailServiceMock.sendProjectAbandonedEmail
      .mockRejectedValueOnce(new Error('Brevo indisponible'))
      .mockResolvedValueOnce(undefined);

    await expect(service.runDailySweep()).resolves.toBeUndefined();

    expect(emailServiceMock.sendProjectAbandonedEmail).toHaveBeenCalledTimes(2);
    expect(sendsRepoMock.save).toHaveBeenCalledTimes(2);
  });
});
