import type { EstimationLineItem } from './estimation-types';

/**
 * Contrôle de cohérence d'un devis reçu (GTM-10) — source **unique** de la
 * formulation.
 *
 * ## La décision que ce fichier tient
 *
 * § 4.7 de PRODUCT_STRATEGY : **Chiffréo mesure, il n'arbitre pas.** Le produit
 * répond « combien faut-il ? », jamais « est-ce trop cher ? ». Trois conséquences
 * s'appliquent ici, et `quote-check-wording.spec.ts` les vérifie une par une :
 *
 *  1. aucune phrase ne contient de lexique tarifaire (prix, tarif, euro, médiane)
 *     ni prescriptif (trop cher, abusif, excessif, contester, arnaque) ;
 *  2. chaque statut de l'union fermée a exactement une formulation, et aucune
 *     formulation n'est orpheline ;
 *  3. `above_reference` porte **obligatoirement** sa réserve, qui nomme les causes
 *     légitimes d'un écart.
 *
 * Le point 3 est le garde-fou central. Un verdict « au-dessus » lu sans réserve
 * peut faire perdre un chantier à une entreprise honnête, sur la foi d'un calcul
 * qui ne connaît ni la contrainte de chantier, ni la découpe réelle, ni la
 * politique de stock. La réserve n'est donc pas une précaution rédactionnelle
 * qu'on peut oublier : c'est un champ obligatoire du type.
 *
 * Écrire ces phrases dans le composant les mettrait hors de portée du test — la
 * porte par laquelle la dérive rentre à chaque fois (leçon 15).
 */

/* -------------------------------------------------------------------------- */
/* Contrat d'API                                                               */
/* -------------------------------------------------------------------------- */

/** Miroir de `QuoteCoherenceStatus` (apps/api/src/estimations/quote-coherence.ts). */
export type QuoteCoherenceStatus =
  | 'below_reference'
  | 'within_reference'
  | 'above_reference'
  | 'not_comparable';

export const QUOTE_COHERENCE_STATUSES: QuoteCoherenceStatus[] = [
  'below_reference',
  'within_reference',
  'above_reference',
  'not_comparable',
];

export interface WasteReferenceRange {
  pose_type: string;
  min_percent: number;
  max_percent: number;
  by_skill: { skill_level: string; percent: number }[];
  is_default: boolean;
}

/**
 * Miroir de `PublicQuoteCheckResponse`. **Aucun champ de prix**, et le test
 * interdit d'en ajouter un : le jour où quelqu'un en voudra un, il devra rouvrir
 * la décision, pas seulement ce fichier.
 */
export interface QuoteCheckResponse {
  work_type_code: string;
  work_type_label: string;
  surface_target: string;
  gross_surface_m2: number;
  net_surface_m2: number;
  deducted_m2: number;
  declared_surface_m2: number;
  implied_waste_percent: number | null;
  reference: WasteReferenceRange;
  status: QuoteCoherenceStatus;
  items: EstimationLineItem[];
}

/* -------------------------------------------------------------------------- */
/* Formulation des verdicts                                                    */
/* -------------------------------------------------------------------------- */

export interface QuoteCoherenceWording {
  status: QuoteCoherenceStatus;
  /** Titre court, factuel. Décrit une position, ne qualifie pas un devis. */
  headline: string;
  /** Ce que le chiffre veut dire, en une phrase. */
  body: string;
  /**
   * Réserve obligatoire sur les verdicts qui constatent un écart : les causes
   * légitimes que le calcul ignore. `null` là où il n'y a pas d'écart à tempérer.
   */
  caveat: string | null;
  /** Teinte de l'encart. Volontairement neutre : aucun rouge, aucune alarme. */
  tone: 'neutral' | 'attention';
}

export const QUOTE_COHERENCE_WORDING: Record<
  QuoteCoherenceStatus,
  QuoteCoherenceWording
> = {
  within_reference: {
    status: 'within_reference',
    headline: 'Les quantités correspondent à la pièce décrite',
    body: 'La quantité portée par ce devis se situe dans la marge de perte que le catalogue retient pour cette pose, du chantier de débutant à celui de professionnel confirmé.',
    caveat: null,
    tone: 'neutral',
  },
  above_reference: {
    status: 'above_reference',
    headline: 'La quantité dépasse la marge de perte de référence',
    body: 'Rapportée à la surface réellement à traiter, la quantité annoncée correspond à une marge de perte supérieure à celle que le catalogue retient pour cette pose.',
    caveat:
      'Un écart n’est pas une anomalie. La découpe réelle, une trame ou un calepinage imposés, une réserve laissée sur place pour les retouches, un lot commandé en une seule fois pour garantir la teinte, ou une contrainte de chantier que ce calcul ignore l’expliquent couramment. La question à poser est « comment cette quantité est-elle établie ? », et la réponse appartient à l’entreprise qui a vu la pièce.',
    tone: 'attention',
  },
  below_reference: {
    status: 'below_reference',
    headline: 'La quantité est inférieure à la marge de perte de référence',
    body: 'La quantité annoncée laisse moins de marge de découpe que le catalogue n’en retient pour cette pose, y compris pour un professionnel confirmé.',
    caveat:
      'Cela se rencontre quand une partie de la fourniture est comptée ailleurs sur le devis, quand du matériau déjà sur place est réemployé, ou quand la surface retenue diffère de celle décrite ici. Il vaut la peine de vérifier ce que cette ligne recouvre au juste.',
    tone: 'attention',
  },
  not_comparable: {
    status: 'not_comparable',
    headline: 'Il n’y a rien à comparer',
    body: 'Les dimensions saisies ne laissent aucune surface à traiter — les ouvertures et les zones exclues couvrent toute la pièce. Reprenez la description de la pièce pour obtenir une comparaison.',
    caveat: null,
    tone: 'neutral',
  },
};

/* -------------------------------------------------------------------------- */
/* Ouvrages contrôlables                                                       */
/* -------------------------------------------------------------------------- */

export interface QuoteCheckWorkType {
  code: string;
  label: string;
  /** Unité affichée à côté du champ de quantité, telle qu'elle figure au devis. */
  unitLabel: string;
  params?: {
    key: 'number_of_coats' | 'tile_format' | 'laying_pattern';
    label: string;
    options: { value: string; label: string }[];
    defaultValue: string;
  }[];
}

/**
 * Les cinq ouvrages que `PUBLIC_WORK_TYPE_CODES` autorise sur le chemin public.
 * `laying_pattern` est proposé là où le catalogue sème des lignes de pose
 * distinctes : sans lui, la référence retombe sur le défaut générique et le
 * verdict perd la moitié de sa valeur.
 */
export const QUOTE_CHECK_WORK_TYPES: QuoteCheckWorkType[] = [
  {
    code: 'wall_painting',
    label: 'Peinture murale',
    unitLabel: 'm² de murs',
    params: [
      {
        key: 'number_of_coats',
        label: 'Nombre de couches prévues',
        options: [
          { value: '1', label: '1 couche' },
          { value: '2', label: '2 couches' },
          { value: '3', label: '3 couches' },
        ],
        defaultValue: '2',
      },
    ],
  },
  {
    code: 'ceiling_painting',
    label: 'Peinture plafond',
    unitLabel: 'm² de plafond',
    params: [
      {
        key: 'number_of_coats',
        label: 'Nombre de couches prévues',
        options: [
          { value: '1', label: '1 couche' },
          { value: '2', label: '2 couches' },
          { value: '3', label: '3 couches' },
        ],
        defaultValue: '2',
      },
    ],
  },
  {
    code: 'floor_tiling',
    label: 'Carrelage sol',
    unitLabel: 'm² de carrelage',
    params: [
      {
        key: 'laying_pattern',
        label: 'Pose prévue au devis',
        options: [
          { value: 'straight', label: 'Pose droite' },
          { value: 'diagonal', label: 'Pose en diagonale' },
        ],
        defaultValue: 'straight',
      },
    ],
  },
  {
    code: 'wall_tiling',
    label: 'Carrelage mural',
    unitLabel: 'm² de faïence',
    params: [
      {
        key: 'laying_pattern',
        label: 'Pose prévue au devis',
        options: [
          { value: 'straight', label: 'Pose droite' },
          { value: 'diagonal', label: 'Pose en diagonale' },
        ],
        defaultValue: 'straight',
      },
    ],
  },
  {
    code: 'parquet_flooring',
    label: 'Parquet ou stratifié',
    unitLabel: 'm² de sol',
    params: [
      {
        key: 'laying_pattern',
        label: 'Pose prévue au devis',
        options: [
          { value: 'straight', label: 'Pose droite' },
          { value: 'diagonal', label: 'Pose en diagonale' },
          // E1-7 — la pose la plus coûteuse en chutes, et celle qu'un devis
          // sous-estime le plus souvent : sans elle, un devis en point de
          // Hongrie était comparé à la fourchette d'une pose droite.
          { value: 'herringbone', label: 'Chevrons ou point de Hongrie' },
        ],
        defaultValue: 'straight',
      },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Copie de la page                                                            */
/* -------------------------------------------------------------------------- */

export const QUOTE_CHECK_PAGE = {
  slug: 'verifier-un-devis',
  title: 'Vérifier les quantités d’un devis de travaux',
  metaDescription:
    'Comparez les quantités portées par un devis de peinture, de carrelage ou de parquet à la surface réellement à traiter dans votre pièce. Gratuit, sans inscription.',
  h1: 'Vérifier les quantités d’un devis',
  intro:
    'Décrivez la pièce, indiquez la quantité que porte le devis, et voyez à quelle marge de perte elle correspond. Le calcul est le même que celui qui sert à préparer un achat — il est simplement lu dans l’autre sens.',
  /**
   * La limite est annoncée sur la page, pas découverte après coup. Beaucoup de
   * devis d'artisan sont au forfait, sans quantité : le contrôle est alors
   * impossible, et le dire vaut mieux que de rendre un verdict sur une quantité
   * devinée.
   */
  lumpSum: {
    title: 'Votre devis est au forfait, sans quantités ?',
    body: 'Ce contrôle a besoin d’une quantité pour fonctionner. Un devis qui annonce « rénovation d’une salle de bain » avec un total unique et aucune surface ne permet aucune comparaison — et c’est déjà une information en soi.',
    ask: 'La demande à formuler est simple, et un professionnel la traite couramment : « pouvez-vous détailler les quantités et les surfaces retenues, poste par poste ? ». Vous pourrez revenir ici avec ces chiffres.',
  },
} as const;

export const QUOTE_CHECK_FAQ: { question: string; answer: string }[] = [
  {
    question: 'Ce contrôle dit-il si mon devis est bien chiffré ?',
    answer:
      'Non, et il ne le dira jamais. Il compare une quantité de matériaux à la surface à traiter dans la pièce que vous décrivez, rien d’autre. Il ne connaît ni votre chantier, ni sa difficulté d’accès, ni la main-d’œuvre, ni ce que pratique une entreprise donnée.',
  },
  {
    question: 'D’où vient la marge de perte de référence ?',
    answer:
      'Du catalogue de matériaux de Chiffréo, qui associe une marge à chaque pose et à chaque niveau d’exécution : 5 à 15 % pour une pose droite de carrelage, 10 à 20 % en diagonale, par exemple. C’est la même référence qui sert à chiffrer un achat sur le reste du site.',
  },
  {
    question: 'Un écart signifie-t-il que quelque chose ne va pas ?',
    answer:
      'Non. Une trame imposée, une découpe réelle, une réserve laissée pour les retouches ou un lot commandé en une fois pour garantir la teinte produisent des écarts parfaitement normaux. Un écart est une question à poser, pas une conclusion.',
  },
  {
    question: 'Que faire du résultat ?',
    answer:
      'Le lire, et demander comment la quantité a été établie si l’écart vous surprend. Une entreprise qui a mesuré la pièce sait répondre — et une réponse claire vaut mieux que le chiffre affiché ici.',
  },
  {
    question: 'Mes données sont-elles conservées ?',
    answer:
      'Non. Ce contrôle ne crée ni compte ni projet, et rien n’est enregistré : les dimensions saisies servent au calcul, puis disparaissent.',
  },
];
