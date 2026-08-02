/**
 * L'offre était décrite à trois endroits sans lien : la prose marketing de
 * `lib/pricing.ts`, les prix de `apps/api/src/subscriptions/plans.constants.ts`
 * et la table `feature_gates` — seule à être réellement appliquée. La dérive
 * n'était donc pas un accident mais la conception : rien ne pouvait la signaler.
 *
 * Ces tests referment la boucle côté web. Chacun correspond à un défaut constaté,
 * pas à une règle inventée après coup.
 */
import {
  OFFER_PLANS,
  AUDIENCES,
  plansForAudience,
  type Audience,
} from '@/lib/pricing';
import {
  GATES_NOT_MARKETED,
  KNOWN_FEATURE_GATES,
  KNOWN_FEATURE_GATE_KEYS,
  getKnownGate,
  tierRank,
} from '@/lib/feature-gates-catalogue';

describe("catalogue d'offre", () => {
  describe('1. aucune fonctionnalité annoncée sans contrepartie réelle', () => {
    it('rattache chaque ligne produit à une gate existante', () => {
      const orphans = OFFER_PLANS.flatMap((plan) =>
        plan.features
          .filter(
            (feature) =>
              feature.gateKey !== null &&
              !KNOWN_FEATURE_GATE_KEYS.includes(feature.gateKey),
          )
          .map((feature) => `${plan.key} → « ${feature.label} » (${feature.gateKey})`),
      );

      expect(orphans).toEqual([]);
    });

    it("exige une justification hors-gate pour toute ligne sans gate", () => {
      // Le seul moyen d'annoncer quelque chose qui n'est pas une gate est de dire
      // pourquoi : un quota, une clause de facturation, un engagement de support.
      // Sans cette contrainte, `gateKey: null` redeviendrait la porte par laquelle
      // « Modèles de devis personnalisés » est entré dans l'offre.
      const unjustified = OFFER_PLANS.flatMap((plan) =>
        plan.features
          .filter(
            (feature) => feature.gateKey === null && !feature.nonGateReason,
          )
          .map((feature) => `${plan.key} → « ${feature.label} »`),
      );

      expect(unjustified).toEqual([]);
    });
  });

  describe('2. aucune gate livrée laissée invisible', () => {
    it('vend ou écarte explicitement chacune des gates connues', () => {
      const marketed = new Set(
        OFFER_PLANS.flatMap((plan) =>
          plan.features
            .map((feature) => feature.gateKey)
            .filter((key): key is string => key !== null),
        ),
      );

      const undecided = KNOWN_FEATURE_GATE_KEYS.filter(
        (key) => !marketed.has(key) && !(key in GATES_NOT_MARKETED),
      );

      expect(undecided).toEqual([]);
    });

    it('ne garde dans GATES_NOT_MARKETED que des gates réellement existantes', () => {
      const stale = Object.keys(GATES_NOT_MARKETED).filter(
        (key) => !KNOWN_FEATURE_GATE_KEYS.includes(key),
      );

      expect(stale).toEqual([]);
    });

    it("n'annonce pas la même gate depuis deux paliers concurrents", () => {
      // Une gate est le différenciateur d'un palier et d'un seul ; l'héritage
      // (« Tout Essentiel + ») se dit en une ligne, pas en recopiant les lignes.
      const owners = new Map<string, string[]>();
      for (const plan of OFFER_PLANS) {
        for (const feature of plan.features) {
          if (feature.gateKey === null) continue;
          owners.set(feature.gateKey, [
            ...(owners.get(feature.gateKey) ?? []),
            plan.key,
          ]);
        }
      }

      const duplicated = [...owners.entries()]
        .filter(([, plans]) => plans.length > 1)
        .map(([key, plans]) => `${key} vendue par ${plans.join(', ')}`);

      expect(duplicated).toEqual([]);
    });
  });

  describe('3. aucun palier ne vend au-dessus de lui', () => {
    it('respecte le min_tier de chaque gate annoncée', () => {
      const overreach = OFFER_PLANS.flatMap((plan) =>
        plan.features
          .filter((feature) => {
            if (feature.gateKey === null) return false;
            const gate = getKnownGate(feature.gateKey);
            return gate ? tierRank(gate.minTier) > tierRank(plan.tier) : false;
          })
          .map(
            (feature) =>
              `${plan.key} (${plan.tier}) annonce ${feature.gateKey} réservée à ${
                getKnownGate(feature.gateKey!)?.minTier
              }`,
          ),
      );

      expect(overreach).toEqual([]);
    });
  });

  describe('4. chaque plan sait à qui il parle', () => {
    it('rattache tout plan à une audience connue', () => {
      const orphans = OFFER_PLANS.filter(
        (plan) => !AUDIENCES.includes(plan.audience),
      ).map((plan) => plan.key);

      expect(orphans).toEqual([]);
    });

    it('ne laisse aucune audience sans offre à présenter', () => {
      const empty = AUDIENCES.filter(
        (audience: Audience) => plansForAudience(audience).length === 0,
      );

      expect(empty).toEqual([]);
    });

    it('donne un CTA à chaque plan', () => {
      // Une offre sans CTA est une offre injoignable — le défaut exact du palier
      // enterprise, appliqué en base et absent de toute surface publique.
      const mute = OFFER_PLANS.filter((plan) => !plan.ctaLabel.trim()).map(
        (plan) => plan.key,
      );

      expect(mute).toEqual([]);
    });
  });

  describe('5. cohérence interne du miroir de gates', () => {
    it('ne déclare pas deux fois la même clé', () => {
      const keys = KNOWN_FEATURE_GATES.map((gate) => gate.key);
      expect(keys).toHaveLength(new Set(keys).size);
    });
  });
});
