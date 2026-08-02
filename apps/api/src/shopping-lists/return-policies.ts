/**
 * BACKLOG DATA-5 : conditions de reprise des enseignes de bricolage françaises.
 *
 * Pourquoi un fichier de code plutôt qu'une table : ces conditions changent
 * rarement, mais une erreur se paie en confiance. En code, toute modification
 * passe par une relecture de diff et par `return-policies.spec.ts`, qui refuse
 * une entrée sans `source_url` ni `verified_on`. En base, elle serait entrée
 * par un `UPDATE`.
 *
 * ⚠️ Ce que ce fichier n'est pas : un engagement. Chaque entrée reproduit ce
 * que l'enseigne **publie**, avec l'URL et la date de relevé, et l'écran le
 * présente comme tel (« à confirmer en magasin »). Une enseigne absente de
 * cette liste n'affiche aucun délai — jamais une valeur par défaut.
 *
 * Constat de relevé (02/08/2026) : la croyance commune « 30 jours » est fausse
 * pour les deux leaders. Castorama annonce 365 jours, Leroy Merlin 6 mois.
 * Un compte à rebours à 30 jours déclarerait donc « délai dépassé » à un
 * client qui dispose encore de onze mois — c'est l'erreur que cette liste
 * existe pour empêcher, et c'est pourquoi les délais ne sont pas devinés.
 */

import { normalizeText } from '../price-comparison/matching/text-normalize';

export interface ReturnPolicy {
  /** Identifiant stable, utilisé par les tests et la télémétrie. */
  slug: string;
  /** Nom affiché, orthographié comme l'enseigne l'écrit. */
  label: string;
  /**
   * Graphies acceptées dans le champ libre `store_name`. Toutes sont
   * comparées après `normalizeText` : inutile d'y décliner accents et casse.
   */
  aliases: readonly string[];
  /** Délai commercial annoncé, en jours. `null` = aucun délai fixe publié. */
  window_days: number | null;
  /** Délai étendu réservé au programme de fidélité, si l'enseigne en publie un. */
  loyalty_window_days: number | null;
  /** Nom du programme, pour pouvoir le citer sans le paraphraser. */
  loyalty_program: string | null;
  requires_receipt: boolean;
  /** Conditions cumulatives, telles que publiées. */
  conditions_fr: readonly string[];
  /** Catégories exclues de la reprise, telles que publiées. */
  excluded_fr: readonly string[];
  /** Page de l'enseigne où un humain vérifie. Obligatoire. */
  source_url: string;
  /** Date du relevé, ISO `yyyy-mm-dd`. Obligatoire. */
  verified_on: string;
}

/**
 * Trois enseignes seulement, et c'est délibéré : ce sont celles dont la page
 * officielle a pu être lue le 02/08/2026. Brico Dépôt (30 jours) et
 * Mr.Bricolage (pas de délai fixe) circulent sur des sites tiers et sont
 * volontairement absents — une donnée de seconde main sur un délai de retour
 * n'a pas sa place ici. Leur ajout demande une lecture de la page de
 * l'enseigne, pas une recherche.
 */
export const RETURN_POLICIES: readonly ReturnPolicy[] = [
  {
    slug: 'castorama',
    label: 'Castorama',
    aliases: ['castorama', 'casto'],
    window_days: 365,
    loyalty_window_days: 1095,
    loyalty_program: 'carte de fidélité Castorama',
    requires_receipt: true,
    conditions_fr: [
      "Article dans son emballage et dans son état d'origine",
      'Ticket de caisse (ou carte de fidélité)',
    ],
    excluded_fr: [
      'Produits sur-mesure ou vendus à la découpe',
      'Articles Marketplace (retour auprès du vendeur)',
    ],
    source_url: 'https://www.castorama.fr/services/retours',
    verified_on: '2026-08-02',
  },
  {
    slug: 'leroymerlin',
    label: 'Leroy Merlin',
    aliases: ['leroy merlin', 'leroymerlin', 'leroy'],
    window_days: 180,
    loyalty_window_days: 365,
    loyalty_program: 'LEROY&MOI',
    requires_receipt: true,
    conditions_fr: [
      "Article non utilisé, dans son emballage d'origine avec ses accessoires",
      'Carte de fidélité ou, à défaut, ticket de caisse ou facture',
    ],
    excluded_fr: [
      'Produits sur-mesure : découpe, peinture teintée en machine',
      'Produits descellés pour raison d’hygiène ou de sécurité (pot de peinture ouvert)',
      'Végétaux',
    ],
    source_url:
      'https://www.leroymerlin.fr/services/service-client/retour-et-remboursement.html',
    verified_on: '2026-08-02',
  },
  {
    slug: 'entrepot-du-bricolage',
    label: "L'Entrepôt du Bricolage",
    aliases: ['entrepot du bricolage', 'l entrepot du bricolage', 'entrepot'],
    window_days: 365,
    loyalty_window_days: null,
    loyalty_program: 'Carte Sourire (sans limite de durée)',
    requires_receipt: true,
    conditions_fr: [
      "Produit neuf, dans son emballage d'origine",
      'Ticket de caisse (illimité et sans ticket avec la Carte Sourire)',
    ],
    excluded_fr: [
      'Produits sur-mesure ou vendus à la découpe',
      'Produits périssables',
      'Produits soumis à contrainte de sécurité',
    ],
    source_url:
      'https://www.entrepot-du-bricolage.fr/informations-client/retours-et-echanges-facilites',
    verified_on: '2026-08-02',
  },
];

/**
 * Catégories de matériaux que les enseignes excluent couramment de la reprise.
 *
 * La conséquence est volontairement forte : une ligne de cette catégorie n'est
 * **jamais** comptée dans le montant récupérable annoncé. Un pot de peinture
 * teinté en machine ou déjà ouvert n'est repris ni chez Leroy Merlin ni chez
 * Castorama ; l'annoncer « récupérable » serait précisément la promesse fausse
 * qui coûte plus que le service ne rapporte.
 */
export const RESTRICTED_CATEGORIES: Readonly<Record<string, string>> = {
  painting:
    'Une peinture teintée en machine ou un pot déjà ouvert n’est pas repris. Un pot non ouvert de teinte standard l’est généralement.',
};

/**
 * Apparie un `store_name` libre à une enseigne connue.
 *
 * L'appariement est volontairement strict — inclusion de l'alias normalisé
 * dans le nom saisi normalisé, alias le plus long d'abord. Aucune distance
 * d'édition : sur trois entrées, une approximation ne gagnerait qu'une faute
 * de frappe et pourrait attribuer à une enseigne le délai d'une autre.
 */
export function matchReturnPolicy(
  storeName: string | null | undefined,
): ReturnPolicy | null {
  if (!storeName) {
    return null;
  }

  const haystack = normalizeText(storeName);
  if (haystack.length === 0) {
    return null;
  }

  const candidates = RETURN_POLICIES.flatMap((policy) =>
    policy.aliases.map((alias) => ({ policy, alias: normalizeText(alias) })),
  ).sort((a, b) => b.alias.length - a.alias.length);

  for (const { policy, alias } of candidates) {
    if (alias.length > 0 && haystack.includes(alias)) {
      return policy;
    }
  }

  return null;
}

/**
 * Échéance de reprise, au format ISO `yyyy-mm-dd`.
 *
 * Le délai retenu est toujours le délai **de base**, jamais celui du programme
 * de fidélité : l'application ne sait pas si l'utilisateur y adhère, et
 * annoncer l'échéance longue à quelqu'un qui n'a que la courte est la seule
 * erreur des deux qui fasse perdre de l'argent. L'écran mentionne l'extension
 * comme un « si », pas comme une date.
 */
export function returnDeadline(
  policy: ReturnPolicy,
  purchasedOn: string,
): string | null {
  if (policy.window_days === null) {
    return null;
  }

  const purchase = new Date(`${purchasedOn}T00:00:00Z`);
  if (Number.isNaN(purchase.getTime())) {
    return null;
  }

  purchase.setUTCDate(purchase.getUTCDate() + policy.window_days);
  return purchase.toISOString().slice(0, 10);
}
