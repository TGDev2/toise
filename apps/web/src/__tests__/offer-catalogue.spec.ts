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
  GENERALIST_MARKET_CEILING_EUR,
  monthlyEquivalentEuros,
  OFFER_PLANS,
  AUDIENCES,
  plansForAudience,
  type Audience,
} from '@/lib/pricing';
import {
  FROZEN_FEATURE_GATE_KEYS,
  GATES_NOT_MARKETED,
  KNOWN_FEATURE_GATES,
  KNOWN_FEATURE_GATE_KEYS,
  getKnownGate,
  tierRank,
} from '@/lib/feature-gates-catalogue';
import {
  COVERED_TRADES,
  TRADES_NOT_COVERED,
  WORK_TYPE_ICONS,
} from '@/lib/work-types';

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

    it("n'annonce aucune gate gelée", () => {
      // `is_enabled = false` fait refuser la gate à TOUS les paliers, palier
      // maximal compris (`FeatureGatesService.isFeatureAllowed`) : une gate
      // gelée annoncée dans une carte tarifaire est une promesse que même un
      // abonné ne peut pas atteindre. C'est ce que l'ADR 0001 (D3) interdit —
      // « aucune ligne d'offre adossée à ces gates » — et le seul endroit qui
      // pouvait le vérifier. Dégeler une gate en base, mettre `enabled: true`
      // dans le miroir et la revendre est le geste inverse, en un seul lot.
      const frozen = new Set(FROZEN_FEATURE_GATE_KEYS);

      const sold = OFFER_PLANS.flatMap((plan) =>
        plan.features
          .filter(
            (feature) => feature.gateKey !== null && frozen.has(feature.gateKey),
          )
          .map(
            (feature) =>
              `${plan.key} → « ${feature.label} » (${feature.gateKey}, gelée)`,
          ),
      );

      expect(sold).toEqual([]);
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

    it("n'adosse aucune gate à un palier qu'aucune offre ne porte", () => {
      // Le défaut inverse du précédent, et celui que E3-1 a dû réparer : en
      // retirant le palier `pro`, huit gates se retrouvaient à exiger un palier
      // que plus aucun plan ne vendait. Le mécanisme étant fail-closed en base
      // (`FeatureGatesService.isFeatureAllowed`), elles devenaient
      // inatteignables — silencieusement, y compris pour un abonné. Rien dans
      // le dépôt ne pouvait le signaler.
      const soldTiers = new Set(OFFER_PLANS.map((plan) => plan.tier));

      const stranded = KNOWN_FEATURE_GATES.filter(
        (gate) => !soldTiers.has(gate.minTier),
      ).map((gate) => `${gate.key} exige ${gate.minTier}`);

      expect(stranded).toEqual([]);
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

  /**
   * L'offre artisan a été vendue 50-200 €/mois — 2 à 10× le marché français du
   * devis-facture (Boby 14,99 €, Tolteck 19 €, Obat 29 €, EBP 29,25 €) — sous le
   * récit « artisans du bâtiment », alors que les sept ouvrages seedés sont tous
   * de finition. Rien dans le code ne pouvait le signaler : ni le prix ni le
   * périmètre annoncé n'étaient adossés à quoi que ce soit.
   *
   * **Le plafond est mensuel, et il l'est resté quand l'offre est passée à
   * l'annuel (E3-3).** Les concurrents relevés vendent au mois ; comparer
   * 279 € à 30 € n'aurait aucun sens et aurait fait rougir un garde-fou sain.
   * La sortie facile était de le désactiver — c'est la grandeur qu'il fallait
   * corriger, pas le seuil : la comparaison porte désormais sur l'équivalent
   * mensuel (279 / 12 = 23,25 €, toujours sous le plafond).
   */
  describe('6. le prix artisan reste tenable face au marché', () => {
    it("garde le palier payant d'entrée sous le plafond du marché généraliste", () => {
      // Sur le plan **payant** le moins cher, pas sur le premier de la liste :
      // depuis que le gratuit et le payant partagent l'unique audience, un
      // `plansForAudience('artisan')[0]` rendrait le plan à 0 € et l'assertion
      // serait vraie pour toujours, quel que soit le prix demandé.
      const [entry] = plansForAudience('artisan')
        .filter((plan) => plan.priceNumber !== null && plan.priceNumber > 0)
        .sort((a, b) => a.priceNumber! - b.priceNumber!);

      expect(entry).toBeDefined();
      expect(monthlyEquivalentEuros(entry)!).toBeLessThan(
        GENERALIST_MARKET_CEILING_EUR,
      );
    });

    /**
     * Et la périodicité elle-même, énoncée plutôt que supposée : l'offre est
     * annuelle et le prix s'affiche HT (E3-3, ADR 0002 §D4 et §6). Ce test
     * tombe si quelqu'un remet du mensuel sans rouvrir la décision — et il
     * tomberait aussi si `period` et `priceLabel` divergeaient, ce que le seul
     * `priceNumber` ne voit pas.
     */
    it('vend en annuel uniquement, et affiche un prix HT', () => {
      const paid = plansForAudience('artisan').filter(
        (plan) => plan.priceNumber !== null && plan.priceNumber > 0,
      );

      expect(paid).not.toHaveLength(0);
      for (const plan of paid) {
        expect(plan.period).toBe('/an');
        expect(plan.priceLabel).toContain('HT');
        expect(plan.priceLabel).toContain(String(plan.priceNumber));
        // La garantie remplace l'essai : elle doit être portée par le
        // catalogue, sinon les pastilles des pages tarifs et d'accueil
        // n'annoncent plus rien.
        expect(plan.refundWindowDays).toBe(30);
      }
    });

    /**
     * L'essai a été retiré (E3-3) : plus aucun plan ne doit en déclarer un, et
     * aucun libellé ne doit continuer d'en promettre un. L'assertion porte sur
     * un marqueur qui **existe** — le libellé d'appel à l'action — et pas
     * seulement sur l'absence d'un champ, qu'un renommage rendrait muette.
     */
    it("ne promet plus d'essai gratuit nulle part dans le catalogue", () => {
      for (const plan of OFFER_PLANS) {
        expect(
          (plan as { trialDays?: number }).trialDays,
        ).toBeUndefined();
        expect(plan.ctaLabel.toLowerCase()).not.toContain('essai');
        expect(plan.ctaLabel.toLowerCase()).not.toContain('essayer');
      }
    });

    it('ne laisse aucun palier artisan dépasser le marché sans capacité propre', () => {
      // Au-dessus du plafond, un palier doit porter une gate que les suites
      // généralistes ne vendent pas à ce prix — pas seulement l'héritage du
      // palier inférieur. `public_api` et `enterprise_sso` figuraient ici
      // jusqu'à leur suppression en base (migration 074) : une liste qui nomme
      // des gates inexistantes ne peut plus justifier quoi que ce soit, d'où
      // l'assertion de fraîcheur qui suit.
      const DIFFERENTIATORS = ['multi_user'];

      expect(
        DIFFERENTIATORS.filter((key) => !KNOWN_FEATURE_GATE_KEYS.includes(key)),
      ).toEqual([]);

      const unjustified = plansForAudience('artisan')
        .filter(
          (plan) =>
            plan.priceNumber !== null &&
            monthlyEquivalentEuros(plan)! > GENERALIST_MARKET_CEILING_EUR,
        )
        .filter(
          (plan) =>
            !plan.features.some(
              (feature) =>
                feature.gateKey !== null &&
                DIFFERENTIATORS.includes(feature.gateKey),
            ),
        )
        .map(
          (plan) =>
            `${plan.key} à ${plan.priceNumber} €${plan.period} ` +
            `(${monthlyEquivalentEuros(plan)!.toFixed(2)} €/mois)`,
        );

      expect(unjustified).toEqual([]);
    });
  });

  describe('7. le périmètre métier annoncé correspond aux ouvrages réels', () => {
    it('rattache chaque ouvrage connu à un métier couvert', () => {
      // Un ouvrage seedé sans métier le porte est invendable : personne ne sait
      // à qui il s'adresse.
      const claimed = new Set(
        COVERED_TRADES.flatMap((trade) => trade.workTypes),
      );
      const orphans = Object.keys(WORK_TYPE_ICONS).filter(
        (code) => !claimed.has(code),
      );

      expect(orphans).toEqual([]);
    });

    it("n'annonce aucun métier adossé à un ouvrage inexistant", () => {
      const known = Object.keys(WORK_TYPE_ICONS);
      const overreach = COVERED_TRADES.flatMap((trade) =>
        trade.workTypes
          .filter((code) => !known.includes(code))
          .map((code) => `${trade.label} → ${code}`),
      );

      expect(overreach).toEqual([]);
    });

    it('ne déclare pas un même corps d’état couvert et hors périmètre', () => {
      const covered = COVERED_TRADES.map((trade) => trade.label.toLowerCase());
      const contradictory = TRADES_NOT_COVERED.filter((trade) =>
        covered.some((label) => label.includes(trade.toLowerCase())),
      );

      expect(contradictory).toEqual([]);
    });

    it('nomme explicitement les corps d’état hors périmètre', () => {
      // Taire ce que le produit ne fait pas est ce qui a permis de vendre
      // « les artisans du bâtiment » sur un catalogue de finition.
      expect(TRADES_NOT_COVERED.length).toBeGreaterThan(0);
    });
  });
});
