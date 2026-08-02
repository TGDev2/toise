/**
 * GTM-9. Le lead magnet s'était installé sur le terme de tête — « calculateur
 * peinture », « calculateur de carrelage gratuit » — face à des calculettes
 * d'enseigne gratuites, indexées depuis des années et adossées à un stock. Sur
 * ce terrain-là nous n'avions rien de plus : les trois atouts du produit (photo
 * → dimensions, prix, liste d'achats) sont derrière le compte, donc absents de
 * la page libre. Pire, ce que la page savait faire de plus — déduire les
 * surfaces exclues — était saisi puis jeté avant l'appel.
 *
 * Le défaut de fond est celui de GTM-7 : une promesse publique rédigée en prose
 * libre, que rien ne rattachait à un mécanisme. Ces tests ferment la porte —
 * chacun correspond à un défaut constaté, pas à une règle inventée après coup.
 *
 * Ils gardent le **catalogue** de promesses. L'exécution des mécanismes, elle,
 * est gardée ailleurs : `estimations.service.spec.ts` (déduction des exclusions
 * et filtrage par `surface_target`) et `PublicCalculator.spec.tsx` (transmission
 * des exclusions saisies).
 */
import {
  CALCULATOR_DIFFERENTIATORS,
  CALCULATOR_SLUGS,
  getCalculatorConfig,
  type CalculatorDifferentiatorKey,
} from '@/lib/calculators';

const CONFIGS = CALCULATOR_SLUGS.map((slug) => getCalculatorConfig(slug)!);

const DECLARED_KEYS = Object.keys(
  CALCULATOR_DIFFERENTIATORS,
) as CalculatorDifferentiatorKey[];

describe('positionnement des calculateurs publics', () => {
  describe('1. aucune page sans différenciateur', () => {
    it('fait déclarer au moins un différenciateur à chaque calculateur', () => {
      const mutes = CONFIGS.filter(
        (config) => config.differentiators.length === 0,
      ).map((config) => config.slug);

      expect(mutes).toEqual([]);
    });

    it('interdit un différenciateur répété sur une même page', () => {
      const doublons = CONFIGS.flatMap((config) => {
        const seen = new Set<string>();
        return config.differentiators
          .filter((key) => (seen.has(key) ? true : (seen.add(key), false)))
          .map((key) => `${config.slug} → ${key}`);
      });

      expect(doublons).toEqual([]);
    });
  });

  describe('2. aucune promesse sans mécanisme derrière', () => {
    it('rattache chaque clé annoncée à une entrée du catalogue', () => {
      const orphelines = CONFIGS.flatMap((config) =>
        config.differentiators
          .filter((key) => !DECLARED_KEYS.includes(key))
          .map((key) => `${config.slug} → ${key}`),
      );

      expect(orphelines).toEqual([]);
    });

    it('exige que chaque entrée désigne le mécanisme qui l’exécute', () => {
      const sansPreuve = DECLARED_KEYS.filter(
        (key) => CALCULATOR_DIFFERENTIATORS[key].proof.trim().length === 0,
      );

      expect(sansPreuve).toEqual([]);
    });
  });

  describe('3. aucune promesse morte', () => {
    it('exige que chaque entrée du catalogue soit portée par une page', () => {
      const utilisees = new Set(
        CONFIGS.flatMap((config) => config.differentiators),
      );
      const mortes = DECLARED_KEYS.filter((key) => !utilisees.has(key));

      expect(mortes).toEqual([]);
    });
  });

  describe('4. le vocabulaire ne peut pas exprimer ce que la page ne délivre pas', () => {
    /*
      Verrou volontairement structurel plutôt que lexical : un test qui
      chercherait « prix » ou « photo » dans la prose sonnerait sur les
      démentis honnêtes (« il donne des quantités, pas des tarifs ») tout en
      laissant passer une reformulation. On fige plutôt l'ensemble des clés
      disponibles : ajouter `price` ou `photo` casse ce test, ce qui force à
      confronter la promesse à `proof` — et donc au fait que
      `estimatePublic` ne retourne aucun prix et que `POST /projects/:id/analyze`
      est sous `FirebaseAuthGuard` + `FeatureGateGuard`.
    */
    it('fige l’ensemble fermé des clés disponibles', () => {
      expect([...DECLARED_KEYS].sort()).toEqual([
        'net_surface',
        'non_rectangular',
        'packaging',
        'skill_waste',
      ]);
    });

    it('fait porter à chaque entrée un titre et une description non vides', () => {
      const incompletes = DECLARED_KEYS.filter((key) => {
        const item = CALCULATOR_DIFFERENTIATORS[key];
        return (
          item.title.trim().length === 0 || item.description.trim().length === 0
        );
      });

      expect(incompletes).toEqual([]);
    });

    it('garde la clé de chaque entrée cohérente avec son index', () => {
      const desalignees = DECLARED_KEYS.filter(
        (key) => CALCULATOR_DIFFERENTIATORS[key].key !== key,
      );

      expect(desalignees).toEqual([]);
    });
  });

  describe('5. la surface nette est promise partout où elle est calculable', () => {
    /*
      C'est la promesse que le chemin public jetait : `ExclusionsSection` est
      rendue sans condition par `DimensionsForm`, donc les trois pages la
      proposent. Aucune ne doit pouvoir l'oublier dans son récit.
    */
    it('fait annoncer `net_surface` par les trois calculateurs', () => {
      const sansSurfaceNette = CONFIGS.filter(
        (config) => !config.differentiators.includes('net_surface'),
      ).map((config) => config.slug);

      expect(sansSurfaceNette).toEqual([]);
    });
  });
});
