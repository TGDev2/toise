/**
 * Ce qu'un être humain peut atteindre, et ce que personne ne doit atteindre.
 *
 * `feature-gates-catalogue.ts` décrit **ce que la base applique** ;
 * `offer-catalogue.spec.ts` interdit de *vendre* une gate qui n'existe pas ou
 * qui est gelée. Ni l'un ni l'autre ne dit si une gate est *atteignable*. C'est
 * l'objet de ce fichier, et de `src/__tests__/navigation-reachability.spec.ts`
 * qui le confronte au relevé statique de la navigation.
 *
 * La règle est au §3.4 de l'ADR 0001 — « toute ligne vendue doit être
 * atteignable depuis la navigation par un compte du palier concerné » — étendue
 * ici : **et rien de gelé ne doit être atteignable par personne.**
 *
 * ⚠️ Rien ici n'est facultatif : toute route de `src/app/**\/page.tsx` doit être
 * une racine, être atteignable depuis une racine, ou figurer à
 * `CLOSED_SURFACES`. Une page qui n'est dans aucun de ces trois cas fait rougir
 * la suite — c'est ce qui empêche d'ajouter un écran sans que personne décide
 * s'il est atteignable.
 */

/**
 * Routes qu'une personne atteint **sans** navigation interne. Elles amorcent le
 * parcours en largeur : tout ce qui n'en descend pas est inatteignable.
 *
 * Déclarer une entrée qui serait de toute façon atteignable in-app ne coûte
 * rien et protège d'un affaiblissement silencieux : si le lien interne
 * disparaît un jour, la route reste correctement traitée comme atteignable, au
 * lieu de devenir un angle mort où une gate gelée pourrait se glisser.
 */
export const NAVIGATION_ROOTS: Record<string, string> = {
  // ── Entrées applicatives ───────────────────────────────────────────────
  '/': 'Vitrine publique : la première page de tout visiteur.',
  '/dashboard':
    "Entrée de l'espace authentifié — destination de toute connexion, de toute inscription et de tout retour de paiement.",
  '/admin/analytics':
    "Entrée du back-office. Aucune surface du produit n'y mène : un administrateur saisit l'URL. Sans cette racine, tout le back-office serait tenu pour inatteignable et pourrait accueillir une gate gelée sans que rien ne le signale.",

  // ── Entrées indexées (déclarées par `app/sitemap.ts`) ──────────────────
  '/pricing': 'Indexée (sitemap, priorité 0,8).',
  '/calculateurs': 'Indexée (priorité 0,8). Aucun lien in-app n’y mène.',
  '/calculateurs/[type]': 'Indexée (priorité 0,8), une entrée par ouvrage.',
  '/community': 'Indexée (priorité 0,7).',
  '/login': 'Indexée (priorité 0,5).',
  '/register': 'Indexée (priorité 0,5).',
  '/privacy': 'Indexée (priorité 0,2).',
  '/cgu': 'Indexée (priorité 0,2).',
  '/cgv': 'Indexée (priorité 0,2).',
  '/mentions-legales': 'Indexée (priorité 0,2).',

  // ── Entrées par lien externe ───────────────────────────────────────────
  '/shared/shopping-list/[token]':
    "Lien de partage envoyé au client : l'URL est l'unique moyen d'y entrer, et elle n'exige aucun compte.",
  '/subscription/success': 'Retour de Stripe Checkout.',
  '/subscription/cancel': 'Retour de Stripe Checkout.',
};

export interface ClosedSurface {
  /** Route Next.js, groupes retirés. */
  route: string;
  /** Pourquoi aucun élément de navigation n'y mène. */
  reason: string;
  /**
   * Gelée par l'ADR indépendamment de `is_enabled` en base.
   *
   * Distinction nécessaire : `site_tracking` est gelée **en base** et le miroir
   * le porte, donc le garde-fou la trouve seul. `logbook` est `is_enabled =
   * true` (migration 049, jamais éteinte) et `referrals` n'a *aucune* gate —
   * leur gel est une décision de périmètre, invisible de la base. Sans ce
   * drapeau, rien dans le dépôt ne pourrait la faire respecter.
   */
  frozenByAdr: boolean;
}

/**
 * Écrans qui existent encore mais vers lesquels plus rien ne navigue.
 *
 * Ils ne sont pas supprimés : la décision D3 conserve le code gelé dans git
 * jusqu'au verdict de l'étape 5. Ce qui change, c'est que leur isolement est
 * désormais **une déclaration vérifiée** et non un état de fait tacite —
 * rétablir un lien vers l'un d'eux fait rougir la suite.
 */
export const CLOSED_SURFACES: ClosedSurface[] = [
  {
    route: '/projects/[id]/site-tracking',
    reason:
      "Gate `site_tracking` gelée (`is_enabled = false`, migration 065, ADR 0001 D3). Le bouton « Suivi de chantier » de chaque carte projet menait ici, et le premier effet de la page est d'ouvrir un paywall : `min_tier` valant le palier payant, `PaywallModal` prenait sa branche payante et proposait à un abonné de souscrire au palier qu'il détient déjà, pour une fonctionnalité refusée à tous les paliers.",
    frozenByAdr: false,
  },
  {
    route: '/logbook',
    reason:
      "Gelé comme non prioritaire par l'ADR 0001 §3.1 : antidote au churn du particulier, construit avant que la cible artisan soit tranchée. La ligne d'offre correspondante a été retirée du palier gratuit dans le même lot — la retirer de la navigation sans la retirer de l'offre aurait créé le défaut inverse, une ligne vendue inatteignable.",
    frozenByAdr: true,
  },
  {
    route: '/referrals',
    reason:
      "Gelé comme non prioritaire par l'ADR 0001 §3.1. Sans gate d'aucune sorte (choix d'origine : le parrainage devait rester ouvert au palier gratuit), donc invisible de `feature_gates` — et la page promet « 1 mois de Pro offert » alors que le palier `pro` n'existe plus depuis E3-1.",
    frozenByAdr: true,
  },
];

/**
 * Gates vendues qu'aucune surface web ne consulte, avec la raison.
 *
 * La direction « vendue ⇒ atteignable » se mécanise en cherchant un écran
 * atteignable qui consulte la gate. Certaines lignes n'ont pas de contrepartie
 * côté client : elles sont appliquées par le serveur et livrées sans condition.
 * Les déclarer nomme l'angle mort au lieu de le laisser silencieux — et la
 * déclaration est vérifiée dans les deux sens : périmée si la gate n'est plus
 * vendue, périmée aussi si une surface se met à la consulter.
 */
export const SOLD_WITHOUT_CLIENT_GATE: Record<string, string> = {
  advanced_loss_factors:
    "Appliquée par le moteur d'estimation, côté serveur : les facteurs de perte sourcés sont dans chaque ligne de la liste d'achat, avec leur justification. Aucun écran n'a de raison d'interroger la gate, puisqu'il n'y a rien à masquer ni à déverrouiller.",
};
