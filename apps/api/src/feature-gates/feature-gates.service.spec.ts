import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FeatureGatesService } from './feature-gates.service';
import { FeatureGate } from './entities/feature-gate.entity';
import { SubscriptionTier } from '../users/entities/user.entity';

function makeGate(overrides: Partial<FeatureGate>): FeatureGate {
  return {
    id: 'gate-1',
    feature_key: 'some_feature',
    label_fr: 'Une fonctionnalité',
    description_fr: null,
    min_tier: 'contractor_essentiel',
    is_enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as FeatureGate;
}

describe('FeatureGatesService', () => {
  let service: FeatureGatesService;
  const gatesRepoMock = { find: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureGatesService,
        { provide: getRepositoryToken(FeatureGate), useValue: gatesRepoMock },
      ],
    }).compile();

    service = module.get(FeatureGatesService);
  });

  describe('isFeatureAllowed — échelle des paliers Contractor (BACKLOG PRO-1)', () => {
    it.each([
      ['contractor_essentiel', SubscriptionTier.CONTRACTOR_ESSENTIEL, true],
      ['contractor_essentiel', SubscriptionTier.CONTRACTOR_STANDARD, true],
      ['contractor_essentiel', SubscriptionTier.CONTRACTOR_PREMIUM, true],
      ['contractor_essentiel', SubscriptionTier.FREE, false],
      ['free', SubscriptionTier.FREE, true],
      ['contractor_standard', SubscriptionTier.CONTRACTOR_ESSENTIEL, false],
      ['contractor_standard', SubscriptionTier.CONTRACTOR_STANDARD, true],
      ['contractor_standard', SubscriptionTier.CONTRACTOR_PREMIUM, true],
      ['contractor_premium', SubscriptionTier.CONTRACTOR_STANDARD, false],
      ['contractor_premium', SubscriptionTier.CONTRACTOR_PREMIUM, true],
      // BACKLOG PLAT-6 : `enterprise` domine l'échelle et ouvre donc aussi tout
      // ce qu'ouvre Premium. Sans son rang, `TIER_RANK[…] ?? 0` le ferait passer
      // pour `free` et le refuserait partout.
      ['contractor_premium', SubscriptionTier.ENTERPRISE, true],
      ['enterprise', SubscriptionTier.ENTERPRISE, true],
      ['enterprise', SubscriptionTier.CONTRACTOR_PREMIUM, false],
      ['enterprise', SubscriptionTier.FREE, false],
    ])(
      'gate min_tier=%s + user tier=%s -> allowed=%s',
      async (minTier, userTier, expected) => {
        gatesRepoMock.find.mockResolvedValue([
          makeGate({ feature_key: 'site_tracking', min_tier: minTier }),
        ]);

        const allowed = await service.isFeatureAllowed(
          'site_tracking',
          userTier,
        );

        expect(allowed).toBe(expected);
      },
    );

    it('honore encore une ligne restée au palier `pro` (compte ou base non migré)', async () => {
      // `pro` a quitté l'offre (E3-1) et la migration 1711468800099 a recalé
      // les huit gates qui l'exigeaient. Le **rang** reste : une base non
      // encore migrée, ou un compte portant la valeur, doit continuer d'être
      // évalué correctement — c'est la seule raison de garder ce rang, et donc
      // ce cas.
      gatesRepoMock.find.mockResolvedValue([
        makeGate({ feature_key: 'cv_analysis', min_tier: 'pro' }),
      ]);

      expect(
        await service.isFeatureAllowed(
          'cv_analysis',
          SubscriptionTier.CONTRACTOR_ESSENTIEL,
        ),
      ).toBe(true);
      expect(
        await service.isFeatureAllowed('cv_analysis', SubscriptionTier.FREE),
      ).toBe(false);
    });

    it('ferme sur le palier payant quand le `min_tier` est illisible', async () => {
      // Le repli valait le rang de `pro`. Sur une valeur inconnue, la question
      // n'est pas « quel palier ? » mais « ouvrir ou fermer ? » : on ferme, et
      // le seul palier qui rouvre est le palier payant.
      gatesRepoMock.find.mockResolvedValue([
        makeGate({ feature_key: 'mystere', min_tier: 'palier_inexistant' }),
      ]);

      expect(
        await service.isFeatureAllowed('mystere', SubscriptionTier.FREE),
      ).toBe(false);
      expect(
        await service.isFeatureAllowed(
          'mystere',
          SubscriptionTier.CONTRACTOR_ESSENTIEL,
        ),
      ).toBe(true);
    });
  });

  it('refuse une gate désactivée même pour le palier le plus haut', async () => {
    gatesRepoMock.find.mockResolvedValue([
      makeGate({
        feature_key: 'multi_user',
        min_tier: 'contractor_premium',
        is_enabled: false,
      }),
    ]);

    const allowed = await service.isFeatureAllowed(
      'multi_user',
      SubscriptionTier.CONTRACTOR_PREMIUM,
    );

    expect(allowed).toBe(false);
  });

  it('refuse une feature inconnue (fail-closed)', async () => {
    gatesRepoMock.find.mockResolvedValue([]);

    const allowed = await service.isFeatureAllowed(
      'unknown_feature',
      SubscriptionTier.CONTRACTOR_PREMIUM,
    );

    expect(allowed).toBe(false);
  });
});
