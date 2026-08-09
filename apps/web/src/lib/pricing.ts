import {
  type FeatureGateKey,
  type PlanTier,
  TIER_ORDER,
} from './feature-gates-catalogue';

export type { PlanTier };
export { TIER_ORDER };

/**
 * À qui s'adresse une offre. C'est la donnée qui manquait : sans elle, chaque
 * page réécrivait son propre découpage et la landing finissait par parler au
 * particulier dans son hero et à l'artisan dans sa section suivante.
 *
 * Il n'en reste qu'une depuis E3-1 (ADR 0002 D4). La table survit à la
 * fusion pour la raison qui l'avait fait naître : tant qu'aucun endroit ne
 * nomme l'audience, chaque page réinvente à qui elle parle.
 */
export const AUDIENCES = ['artisan'] as const;
export type Audience = (typeof AUDIENCES)[number];

export interface AudienceDefinition {
  /** Intitulé de la strate sur /pricing. */
  title: string;
  /** Une phrase : à qui, pour quoi. */
  tagline: string;
}

/**
 * Une audience, une surface : `/`. Le palier DIY à 9,99 € et la landing
 * particulier ont été supprimés par E3-1 — le canal particulier reste ouvert
 * (calculateurs publics indexables, mode invité jusqu'à la liste d'achat), mais
 * il n'a plus ni page d'accueil propre ni offre à lui.
 */
export const AUDIENCE_DEFINITIONS: Record<Audience, AudienceDefinition> = {
  artisan: {
    // « Vous êtes du métier » laissait entendre tous les métiers. Le moteur ne
    // chiffre que la finition (voir COVERED_TRADES) : l'accroche doit le dire
    // avant le prix, pas après la souscription.
    title: 'Vous êtes des métiers de finition',
    tagline:
      'Peintre, carreleur, plaquiste, solier : chiffrez et envoyez un devis conforme depuis le chantier, pas le soir au bureau.',
  },
};

/**
 * Pourquoi une ligne d'offre n'est pas adossée à une gate. Ensemble fermé
 * volontairement : sans lui, `gateKey: null` redeviendrait la porte par laquelle
 * une fonctionnalité inexistante entre dans une carte tarifaire.
 */
export type NonGateReason =
  /** Volume autorisé, pas une capacité (« un projet » pour un invité). */
  | 'quota'
  /** Socle produit disponible à tous les paliers, jamais gaté. */
  | 'socle'
  /** Renvoi au palier inférieur (« Tout le gratuit compris »). */
  | 'heritage';

export interface PlanFeature {
  label: string;
  /** Gate de `feature_gates` derrière la promesse, ou `null` si ce n'en est pas une. */
  gateKey: FeatureGateKey | null;
  /** Obligatoire dès lors que `gateKey` vaut `null`. */
  nonGateReason?: NonGateReason;
}

export interface OfferPlan {
  /**
   * `contractor_premium` (49 €) et `contractor_standard` (29 €) ont existé ici
   * jusqu'au gel de l'ADR 0001 (D3) puis à la fusion en palier unique (D4,
   * E3-4) ; `pro` (9,99 €, particulier) a disparu avec la landing DIY (ADR 0002
   * D4, E3-1). Leurs rangs restent dans `TIER_ORDER` : des comptes peuvent
   * encore les porter en base.
   */
  key: 'free' | 'contractor_essentiel';
  /**
   * Clé correspondante dans GET /subscriptions/plans (résolue en price_id
   * Stripe à l'exécution pour un utilisateur connecté). Absente pour le plan
   * gratuit. Les prix affichés ici sont indicatifs : le checkout n'envoie
   * jamais un montant, uniquement un price_id fourni par l'API.
   */
  apiPlanKey?: 'contractor_essentiel';
  tier: PlanTier;
  audience: Audience;
  name: string;
  priceLabel: string;
  /**
   * Montant facturé **par période**. `null` pour une offre sur devis : exclue
   * des agrégats de prix (JSON-LD).
   */
  priceNumber: number | null;
  /**
   * Périodicité affichée. `'/mois'` a disparu du type avec l'offre mensuelle
   * (E3-3) : rétablir du mensuel demande de toucher ce type, donc de relire
   * tout ce qui en dépend, plutôt que de changer une valeur en douce.
   */
  period: '' | '/an';
  description: string;
  features: PlanFeature[];
  highlighted?: boolean;
  /**
   * Durée de la garantie « satisfait ou remboursé », en jours. Elle remplace
   * l'ancien `trialDays` : sur un produit dont le chiffrage est déjà gratuit et
   * illimité, l'essai *est* le palier gratuit, et un essai ne prélève rien —
   * donc ne rembourse rien. Miroir de `REFUND_WINDOW_DAYS` dans
   * `apps/api/src/subscriptions/plans.constants.ts`, seule source de ce qui est
   * réellement appliqué.
   */
  refundWindowDays?: number;
  ctaLabel: string;
}

/**
 * Plafond du marché français du devis-facture artisan, relevé en août 2026 :
 * Boby 14,99 €, Tolteck 19 €, Obat 29 €, EBP Bâtiment 29,25 €, Costructor gratuit,
 * BatiChiffrage 30 €+ (et 80 000 travaux unitaires en bibliothèque).
 *
 * Chiffréo couvre sept ouvrages de finition et un bloc de main-d'œuvre : une
 * couverture partielle n'autorise pas un premium de prix. Le palier payant doit
 * rester sous ce plafond ; il valait 50 € avant GTM-8. Un palier peut le
 * dépasser, mais seulement en portant des capacités que ces outils ne vendent
 * pas à ce prix.
 *
 * Les capacités qui le justifiaient ayant été gelées par l'ADR 0001 (D3), plus
 * aucun palier artisan ne peut aujourd'hui dépasser le plafond : le palier
 * Premium à 49 € a été retiré avec elles.
 *
 * **Ce plafond est mensuel**, et il l'est resté quand l'offre est passée à
 * l'annuel (E3-3) : les concurrents relevés vendent au mois. Le comparer à un
 * prix annuel n'aurait aucun sens — c'est l'équivalent mensuel qui se compare,
 * et c'est ce que fait `monthlyEquivalentEuros` ci-dessous.
 */
export const GENERALIST_MARKET_CEILING_EUR = 30;

/**
 * Le prix d'un plan ramené au mois, pour toute comparaison avec un marché qui
 * s'exprime au mois.
 *
 * Miroir de la fonction du même nom côté API. Elle existe des deux côtés parce
 * que le garde-fou de `offer-catalogue.spec.ts` doit pouvoir la calculer sans
 * appeler l'API — mais la grandeur, elle, est définie au même endroit que le
 * prix : `apps/api/src/subscriptions/plans.constants.ts`.
 */
export function monthlyEquivalentEuros(plan: OfferPlan): number | null {
  if (plan.priceNumber === null) return null;
  return plan.period === '/an' ? plan.priceNumber / 12 : plan.priceNumber;
}

export const OFFER_PLANS: OfferPlan[] = [
  {
    key: 'free',
    tier: 'free',
    audience: 'artisan',
    name: 'Gratuit',
    priceLabel: '0 €',
    priceNumber: 0,
    period: '',
    description:
      'Tout le chiffrage, sur autant de chantiers que vous voulez, sans carte bancaire.',
    features: [
      {
        // Pas une gate, et c'est le correctif d'E3-2 : une gate **accorde** une
        // capacité à partir d'un palier, alors que l'illimité est l'absence
        // d'un quota. Adossée à `unlimited_projects`, la promesse héritait du
        // caractère fail-closed du mécanisme — ligne supprimée ou gelée, et
        // deux projets actifs revenaient en silence. La limite est désormais
        // retirée du code ; seul un invité non inscrit reste borné à un projet.
        label: 'Chantiers illimités',
        gateKey: null,
        nonGateReason: 'quota',
      },
      {
        label: 'Estimation complète des quantités',
        gateKey: null,
        nonGateReason: 'socle',
      },
      {
        label: 'Facteurs de perte sourcés, par type de pose et par niveau',
        gateKey: 'advanced_loss_factors',
      },
      {
        label: 'Liste d’achats avec export PDF',
        gateKey: null,
        nonGateReason: 'socle',
      },
      { label: 'Suivi budgétaire', gateKey: 'budget_tracking' },
      {
        // Volontairement sans nom d'enseigne : les adaptateurs ManoMano et
        // Leroy Merlin existent mais sont derrière `MANOMANO_ENABLED` /
        // `LEROY_MERLIN_ENABLED`, à `false` par défaut et sans flux configuré
        // (.env.example). Citer les marques promettrait ce qu'un déploiement
        // non provisionné ne tient pas.
        label: 'Comparateur de prix entre enseignes',
        gateKey: 'price_comparison',
      },
      {
        label: 'Carnet du logement : l’historique des pièces mesurées',
        gateKey: 'logbook',
      },
      {
        label: 'Clôture de chantier : vos restes et ce qui se rend encore',
        gateKey: 'project_closeout',
      },
    ],
    ctaLabel: 'Commencer gratuitement',
  },
  {
    key: 'contractor_essentiel',
    apiPlanKey: 'contractor_essentiel',
    tier: 'contractor_essentiel',
    audience: 'artisan',
    name: 'Essentiel',
    priceLabel: '279 € HT',
    priceNumber: 279,
    period: '/an',
    description:
      'Les indispensables du devis professionnel, sur les ouvrages de finition. Annuel uniquement.',
    features: [
      {
        label: 'Tout le gratuit, chantiers illimités compris',
        gateKey: null,
        nonGateReason: 'heritage',
      },
      {
        label: 'Devis PDF conformes (TVA, HT/TTC, mentions)',
        gateKey: 'export_devis',
      },
      {
        label: 'Fichier clients et historique de chantiers',
        gateKey: 'client_management',
      },
      {
        label: 'Facturation : du devis accepté à la facture numérotée',
        gateKey: 'invoicing',
      },
    ],
    highlighted: true,
    // Miroir de `REFUND_WINDOW_DAYS` (API), seule source de ce qui est
    // réellement appliqué. Remplace les 7 jours d'essai : un essai ne prélève
    // rien, donc ne rembourse rien — annoncer les deux ferait de la garantie
    // une promesse inapplicable pendant la semaine où elle rassure.
    refundWindowDays: 30,
    ctaLabel: "S'abonner pour un an",
  },
];

export function plansForAudience(audience: Audience): OfferPlan[] {
  return OFFER_PLANS.filter((plan) => plan.audience === audience);
}

export function getPlan(key: OfferPlan['key']): OfferPlan {
  const plan = OFFER_PLANS.find((candidate) => candidate.key === key);
  if (!plan) throw new Error(`Plan inconnu : ${key}`);
  return plan;
}
