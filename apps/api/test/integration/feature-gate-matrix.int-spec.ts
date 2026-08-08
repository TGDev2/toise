import { DataSource } from 'typeorm';
import { migratedDataSource } from './test-database';
import { FeatureGate } from '../../src/feature-gates/entities/feature-gate.entity';
import { FeatureGatesService } from '../../src/feature-gates/feature-gates.service';
import { SubscriptionTier } from '../../src/users/entities/user.entity';

/**
 * E3-2 — l'état réel de **chaque** gate, résolu contre une base réellement
 * migrée, pour les trois sortes de compte que le produit connaît.
 *
 * Pourquoi ce fichier et pas un relevé à la main : le mécanisme est
 * fail-closed (`FeatureGatesService.isFeatureAllowed` — ligne absente → refus,
 * `is_enabled = false` → refus, `min_tier` illisible → refus jusqu'au palier
 * payant). Une migration incomplète **ferme** donc un accès au lieu de
 * l'ouvrir, et sans un mot : ni les tests unitaires (qui mockent le dépôt) ni
 * les `*.e2e-spec.ts` (qui mockent le service) ne peuvent le voir, puisque
 * aucun des deux ne lit la table. Le seul étage capable de l'attester est
 * celui-ci.
 *
 * **Les trois colonnes ne mesurent pas la même chose, et c'est le point.**
 * Un invité est un compte Firebase anonyme : il a une ligne `users`, un palier
 * `free`, et passe donc exactement les mêmes gates qu'un compte gratuit
 * inscrit. Ce qui les sépare n'est jamais le palier — c'est
 * `RegisteredAccountGuard` (`@RequiresRegisteredAccount`), posé route par
 * route, et les quotas de volume (`GUEST_PROJECT_LIMIT`,
 * `GUEST_ESTIMATION_LIMIT`). Une lecture du seul `min_tier` dirait « l'invité a
 * tout ce qu'a le gratuit », ce qui est faux ; la colonne invité croise donc
 * les deux.
 */

/** Le palier payant unique depuis E3-4 (ADR 0001 D4). */
const PAYING_TIER = SubscriptionTier.CONTRACTOR_ESSENTIEL;

/**
 * Gates dont la route porte **aussi** `@RequiresRegisteredAccount`. Un invité
 * y est refusé quel que soit son palier, avant même que la gate soit consultée.
 *
 * Une seule aujourd'hui : `community_gallery`
 * (`community.controller.ts:157-160`). Les deux autres surfaces réservées aux
 * inscrits — l'export PDF de la liste d'achats et le lien de partage
 * (`shopping-list-export.controller.ts:36-38`), l'envoi de photos
 * (`photos.controller.ts:122-123`) — ne sont adossées à aucune gate.
 */
const REGISTERED_ONLY_GATES = new Set(['community_gallery']);

/**
 * Ce que le modèle économique dit, en clair (ADR 0002 D4) : calculer est
 * gratuit, produire un document opposable est payant. La liste est écrite ici
 * plutôt que dérivée de la base — dérivée, elle vaudrait « ce qui est est ce
 * qui doit être », et le test ne pourrait plus rien attraper.
 */
const MUST_BE_PAID = ['export_devis', 'client_management', 'invoicing'];

/**
 * Gates que le parcours de chiffrage traverse. Ce sont elles que l'énoncé
 * d'E3-2 nomme, et dont la fermeture silencieuse coûterait le plus cher : elles
 * sont sur le chemin critique de chaque chantier.
 */
const MUST_BE_FREE_AND_LIVE = [
  'advanced_loss_factors',
  'budget_tracking',
  'price_comparison',
  'logbook',
  'project_closeout',
];

interface ResolvedRow {
  key: string;
  minTier: string;
  enabled: boolean;
  guest: boolean;
  free: boolean;
  paying: boolean;
}

describe('matrice des feature gates (base réelle)', () => {
  let dataSource: DataSource;
  let service: FeatureGatesService;
  let rows: ResolvedRow[];

  beforeAll(async () => {
    dataSource = await migratedDataSource();
    service = new FeatureGatesService(dataSource.getRepository(FeatureGate));

    const gates = await dataSource
      .getRepository(FeatureGate)
      .find({ order: { feature_key: 'ASC' } });

    rows = await Promise.all(
      gates.map(async (gate) => {
        const free = await service.isFeatureAllowed(
          gate.feature_key,
          SubscriptionTier.FREE,
        );
        return {
          key: gate.feature_key,
          minTier: gate.min_tier,
          enabled: gate.is_enabled,
          // Même palier qu'un gratuit inscrit, moins les routes réservées.
          guest: free && !REGISTERED_ONLY_GATES.has(gate.feature_key),
          free,
          paying: await service.isFeatureAllowed(gate.feature_key, PAYING_TIER),
        };
      }),
    );

    // Le tableau demandé par E3-2, imprimé à chaque exécution : c'est la
    // sortie qu'on relit quand une migration touche `feature_gates`.
    const yesNo = (v: boolean) => (v ? 'oui' : 'NON');
    const table = rows
      .map(
        (r) =>
          `${r.key.padEnd(24)} ${r.minTier.padEnd(22)} ${
            r.enabled ? '     ' : 'gelée'
          }  ${yesNo(r.guest).padEnd(5)} ${yesNo(r.free).padEnd(5)} ${yesNo(
            r.paying,
          )}`,
      )
      .join('\n');
    console.log(
      `\ngate                     min_tier                      invité gratuit payant\n${table}\n`,
    );
  }, 120_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('résout chaque gate de la table, sans exception', () => {
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => typeof r.free === 'boolean')).toBe(true);
  });

  /**
   * Le cœur d'E3-2. Une gate `free` refusée à un compte gratuit inscrit est
   * exactement le mode de panne que le fail-closed produit : elle ne lève
   * aucune erreur, elle rend simplement `false`, et le parcours se referme.
   */
  it('ouvre à un compte gratuit inscrit toute gate `free` et active', () => {
    const closed = rows
      .filter((r) => r.minTier === 'free' && r.enabled && !r.free)
      .map((r) => r.key);

    expect(closed).toEqual([]);
  });

  it('ouvre les gates du parcours de chiffrage à un compte gratuit', () => {
    const missing = MUST_BE_FREE_AND_LIVE.filter(
      (key) => !rows.find((r) => r.key === key)?.free,
    );

    expect(missing).toEqual([]);
  });

  it('garde payant ce qui produit un document opposable', () => {
    const leaked = MUST_BE_PAID.filter(
      (key) => rows.find((r) => r.key === key)?.free,
    );

    expect(leaked).toEqual([]);
  });

  it('accorde au palier payant tout ce que le gratuit obtient', () => {
    // Une gate ouverte au gratuit et fermée au payant serait une inversion de
    // la ladder — impossible par construction, sauf `min_tier` corrompu.
    const inverted = rows
      .filter((r) => r.free && !r.paying)
      .map((r) => `${r.key} (${r.minTier})`);

    expect(inverted).toEqual([]);
  });

  it('refuse une gate gelée à tous les paliers, palier payant compris', () => {
    const leaking = rows
      .filter((r) => !r.enabled && (r.guest || r.free || r.paying))
      .map((r) => r.key);

    expect(leaking).toEqual([]);
  });

  /**
   * `unlimited_projects` a été supprimée par la migration 100 : l'illimité est
   * l'absence d'un quota, pas une capacité qu'une ligne fail-closed accorde.
   * Si elle réapparaissait, la promesse « chantiers illimités » redeviendrait
   * révocable par un réglage d'administration.
   */
  it("ne fait dépendre les chantiers illimités d'aucune gate", () => {
    expect(rows.map((r) => r.key)).not.toContain('unlimited_projects');
  });

  /**
   * `pro` a été retiré de l'offre en E3-1. Une gate qui l'exigerait encore
   * serait inatteignable pour tout le monde, en silence.
   */
  it("n'adosse aucune gate à un palier que plus aucune offre ne vend", () => {
    const sellable = new Set<string>(['free', PAYING_TIER]);
    const stranded = rows
      .filter((r) => !sellable.has(r.minTier))
      .map((r) => `${r.key} exige ${r.minTier}`);

    expect(stranded).toEqual([]);
  });
});
