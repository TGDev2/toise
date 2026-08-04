/**
 * Le tunnel « devis-minute » (PRO-5).
 *
 * Les cinq écrans qui mènent de la mesure d'une pièce à un devis PDF
 * existaient déjà, mais comme des pages indépendantes : chacune réimplémentait
 * son lien retour et aucune n'indiquait où l'on en était ni ce qu'il restait.
 *
 * L'étape photo/analyse automatique a été retirée du tunnel (ADR 0001 D2, le
 * service de vision par ordinateur est débranché de la production) : la
 * saisie manuelle des dimensions est désormais la première étape.
 *
 * Source unique de vérité de l'enchaînement, pour que `FlowProgress` et les
 * pages elles-mêmes ne puissent pas diverger sur l'ordre ou les libellés.
 */

export const QUOTE_FLOW_STEPS = [
  { key: 'dimensions', label: 'Mesures', segment: 'dimensions' },
  { key: 'work', label: 'Travaux', segment: 'work-selection' },
  { key: 'estimate', label: 'Estimation', segment: 'estimate' },
  { key: 'prices', label: 'Prix', segment: 'shopping-list' },
  { key: 'quote', label: 'Devis', segment: 'quote/new' },
] as const;

export type QuoteFlowStepKey = (typeof QUOTE_FLOW_STEPS)[number]['key'];

export const QUOTE_FLOW_TOTAL = QUOTE_FLOW_STEPS.length;

/**
 * Étapes réellement atteignables par l'utilisateur courant.
 *
 * Seule l'étape « Devis » est gardée par un palier (`export_devis`) : un
 * particulier ou un Pro ne l'atteint jamais, un Contractor Essentiel et plus
 * si. `FlowProgress` s'en sert pour ne jamais annoncer un total que
 * l'utilisateur ne pourra pas atteindre.
 */
export function quoteFlowReachableSteps(quoteAllowed: boolean) {
  return quoteAllowed
    ? QUOTE_FLOW_STEPS
    : QUOTE_FLOW_STEPS.filter((s) => s.key !== 'quote');
}

/** Rang 1-indexé de l'étape, tel qu'affiché (« Étape 3 / 6 »). */
export function quoteFlowStepNumber(key: QuoteFlowStepKey): number {
  return QUOTE_FLOW_STEPS.findIndex((s) => s.key === key) + 1;
}

export function quoteFlowStepLabel(key: QuoteFlowStepKey): string {
  return QUOTE_FLOW_STEPS.find((s) => s.key === key)?.label ?? '';
}

/**
 * URL de l'étape pour un projet donné.
 *
 * L'étape « Devis » est la seule à ne pas être une simple étape de projet : elle
 * est gardée par `export_devis` côté serveur, d'où l'absence de lien direct
 * depuis la barre de progression (cf. `FlowProgress`, non cliquable en avant).
 */
export function quoteFlowStepHref(
  key: QuoteFlowStepKey,
  projectId: string,
): string {
  const step = QUOTE_FLOW_STEPS.find((s) => s.key === key);
  // `key` est typé `QuoteFlowStepKey` : ce repli ne s'exécute jamais en
  // pratique. Il évite seulement de construire `/projects/{id}`, qui n'a
  // jamais eu de page (404) -- le tableau de bord reste la destination sûre.
  if (!step) return '/dashboard';
  return `/projects/${projectId}/${step.segment}`;
}
