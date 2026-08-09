/**
 * `offer-catalogue.spec.ts` interdit de **vendre** une ligne d'offre sans gate
 * réelle derrière, et de vendre une gate gelée. Il ne peut rien dire de
 * l'**atteignabilité** : au moment où il a été écrit, un bouton « Suivi de
 * chantier » s'affichait sur chaque carte projet d'un abonné, menait à une page
 * dont le premier effet était d'ouvrir le paywall d'une gate refusée à tous les
 * paliers, et lui proposait de souscrire au palier qu'il détenait déjà. Rien
 * dans le dépôt ne pouvait le signaler : la gate n'était vendue nulle part.
 *
 * Ce spec ferme cette moitié-là. La règle est au §3.4 de l'ADR 0001 — « toute
 * ligne vendue doit être atteignable depuis la navigation par un compte du
 * palier concerné » — étendue : **rien de gelé ne doit être atteignable par
 * personne.**
 *
 * La méthode est un relevé statique (`support/navigation-graph.ts`) confronté à
 * une déclaration (`@/lib/navigation-map`). Ni l'un ni l'autre ne suffit :
 * le relevé seul ne sait pas qu'une page orpheline l'est *volontairement* ; la
 * déclaration seule est une métadonnée que rien n'oblige à correspondre au
 * code. Les assertions ci-dessous les font se contredire.
 */
import { existsSync } from 'fs';
import {
  FROZEN_FEATURE_GATE_KEYS,
  KNOWN_FEATURE_GATE_KEYS,
} from '@/lib/feature-gates-catalogue';
import {
  CLOSED_SURFACES,
  NAVIGATION_ROOTS,
  SOLD_WITHOUT_CLIENT_GATE,
} from '@/lib/navigation-map';
import { OFFER_PLANS } from '@/lib/pricing';
import {
  buildNavigationGraph,
  reachableFrom,
} from './support/navigation-graph';

const graph = buildNavigationGraph();
const roots = Object.keys(NAVIGATION_ROOTS);
const reachable = reachableFrom(graph, roots);
const closedRoutes = CLOSED_SURFACES.map((surface) => surface.route);

/** Gates réellement adossées à une ligne d'offre vendue. */
const SOLD_GATES = [
  ...new Set(
    OFFER_PLANS.flatMap((plan) =>
      plan.features
        .map((feature) => feature.gateKey)
        .filter((key): key is string => key !== null),
    ),
  ),
];

describe('atteignabilité de la navigation', () => {
  describe('1. le relevé est complet avant de servir de preuve', () => {
    it('résout toutes les cibles de navigation vers une route connue', () => {
      // L'assertion qui rend le relevé utilisable comme preuve. Une cible que
      // le scanner ne comprend pas — un `router.push(variable)`, une route
      // renommée d'un côté seulement — doit faire rougir, jamais disparaître en
      // silence : c'est exactement par là qu'un chemin vers une gate gelée
      // resterait invisible.
      const unresolved = graph.nodes.flatMap((node) =>
        node.unresolved.map((target) => `${node.route} → ${target}`),
      );

      expect(unresolved).toEqual([]);
    });

    it('ne déclare aucune racine de navigation qui n’existe pas', () => {
      const stale = roots.filter(
        (route) => !graph.routes.includes(route),
      );

      expect(stale).toEqual([]);
    });

    it('ne déclare aucune surface fermée qui n’existe pas', () => {
      const stale = closedRoutes.filter(
        (route) => !graph.routes.includes(route),
      );

      expect(stale).toEqual([]);
    });

    it('trouve bien les pages sur le disque', () => {
      // Garde-fou du garde-fou : si l'énumération rendait une liste vide — un
      // changement d'arborescence, un `page.tsx` renommé en `page.jsx` — toutes
      // les assertions qui suivent porteraient sur le vide et passeraient au
      // vert en ne vérifiant rien.
      expect(graph.routes.length).toBeGreaterThan(20);
      for (const node of graph.nodes) {
        expect(existsSync(node.file)).toBe(true);
      }
    });
  });

  describe('2. aucun écran n’échappe à la décision', () => {
    it('rattache chaque page à une racine, à un chemin, ou à une fermeture assumée', () => {
      // Le forçage : ajouter une page sans la relier à rien oblige à écrire
      // pourquoi elle est inatteignable. Ne rien décider devient impossible.
      const undecided = graph.routes.filter(
        (route) => !reachable.has(route) && !closedRoutes.includes(route),
      );

      expect(undecided).toEqual([]);
    });

    it('ne garde comme fermée qu’une surface réellement inatteignable', () => {
      // Le sens inverse, et celui qui attrape la régression : rétablir un
      // bouton vers `/logbook` rend la route atteignable, et cette déclaration
      // devient un mensonge que la suite refuse.
      const contradicted = closedRoutes.filter((route) => reachable.has(route));

      expect(contradicted).toEqual([]);
    });

    it('n’explique une fermeture par le gel en base que si une gate gelée le porte', () => {
      // Fraîcheur des motifs. Une surface déclarée fermée *sans* invoquer l'ADR
      // s'appuie sur `is_enabled = false` : si la gate est dégelée en base et
      // que le miroir suit, le motif ne tient plus et la décision doit être
      // reprise plutôt que de survivre par inertie.
      const frozen = new Set<string>(FROZEN_FEATURE_GATE_KEYS);

      const unexplained = CLOSED_SURFACES.filter(
        (surface) =>
          !surface.frozenByAdr &&
          !graph.nodes
            .find((node) => node.route === surface.route)
            ?.gates.some((gate) => frozen.has(gate)),
      ).map((surface) => surface.route);

      expect(unexplained).toEqual([]);
    });
  });

  describe('3. rien de gelé n’est atteignable par personne', () => {
    it('ne laisse aucune route atteignable consulter une gate gelée', () => {
      // `is_enabled = false` fait refuser la gate à TOUS les paliers, palier
      // maximal compris (`FeatureGatesService.isFeatureAllowed`, et son miroir
      // `FeatureGateContext:100`). Un élément de navigation qui y mène ne
      // promet donc rien à personne : au mieux un cul-de-sac, au pire — quand
      // le `min_tier` est le palier payant — une offre de souscrire au palier
      // déjà détenu.
      const offenders = FROZEN_FEATURE_GATE_KEYS.flatMap((gate) =>
        graph
          .routesUsingGate(gate)
          .filter((route) => reachable.has(route))
          .map((route) => `${route} consulte ${gate}, gelée`),
      );

      expect(offenders).toEqual([]);
    });

    it('ne laisse atteignable aucune surface gelée par l’ADR', () => {
      // Le carnet du logement (`is_enabled = true`) et le parrainage (aucune
      // gate) sont gelés par l'ADR 0001 §3.1 : rien dans `feature_gates` ne
      // peut le dire, seule la déclaration le porte.
      const offenders = CLOSED_SURFACES.filter(
        (surface) => surface.frozenByAdr && reachable.has(surface.route),
      ).map((surface) => `${surface.route} — ${surface.reason}`);

      expect(offenders).toEqual([]);
    });
  });

  describe('4. toute ligne vendue reste atteignable (ADR 0001 §3.4)', () => {
    it('adosse chaque gate vendue à un écran atteignable, ou nomme l’exception', () => {
      const orphaned = SOLD_GATES.filter(
        (gate) =>
          !(gate in SOLD_WITHOUT_CLIENT_GATE) &&
          !graph.routesUsingGate(gate).some((route) => reachable.has(route)),
      );

      expect(orphaned).toEqual([]);
    });

    it('ne garde dans SOLD_WITHOUT_CLIENT_GATE que des gates vendues', () => {
      const stale = Object.keys(SOLD_WITHOUT_CLIENT_GATE).filter(
        (gate) => !SOLD_GATES.includes(gate),
      );

      expect(stale).toEqual([]);
    });

    it('retire de SOLD_WITHOUT_CLIENT_GATE toute gate qu’un écran s’est mis à consulter', () => {
      // L'exception est une dette, pas un droit acquis : dès qu'une surface
      // interroge la gate, la preuve d'atteignabilité redevient mécanisable et
      // l'exception doit disparaître.
      const obsolete = Object.keys(SOLD_WITHOUT_CLIENT_GATE).filter(
        (gate) => graph.routesUsingGate(gate).length > 0,
      );

      expect(obsolete).toEqual([]);
    });
  });

  describe('5. cohérence avec le miroir des gates', () => {
    it('ne consulte aucune gate absente de `feature_gates`', () => {
      // Une clé consultée mais absente de la base est refusée fail-closed
      // (`FeatureGateContext:99`) : la fonctionnalité est morte sans que rien
      // ne le dise. C'est le pendant, côté écrans, de l'assertion de
      // `offer-catalogue.spec.ts` sur les lignes d'offre orphelines.
      const unknown = graph.nodes.flatMap((node) =>
        node.gates
          .filter((gate) => !KNOWN_FEATURE_GATE_KEYS.includes(gate))
          .map((gate) => `${node.route} consulte ${gate}, inconnue en base`),
      );

      expect(unknown).toEqual([]);
    });
  });
});
