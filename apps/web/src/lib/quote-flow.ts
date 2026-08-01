/**
 * Le tunnel « devis-minute » (PRO-5).
 *
 * Les six écrans qui mènent d'une photo prise chez le client à un devis PDF
 * existaient déjà, mais comme six pages indépendantes : chacune réimplémentait
 * son lien retour et aucune n'indiquait où l'on en était ni ce qu'il restait.
 *
 * Source unique de vérité de l'enchaînement, pour que `FlowProgress` et les
 * pages elles-mêmes ne puissent pas diverger sur l'ordre ou les libellés.
 */

export const QUOTE_FLOW_STEPS = [
  { key: 'photos', label: 'Photos', segment: 'photos' },
  { key: 'dimensions', label: 'Mesures', segment: 'dimensions' },
  { key: 'work', label: 'Travaux', segment: 'work-selection' },
  { key: 'estimate', label: 'Estimation', segment: 'estimate' },
  { key: 'prices', label: 'Prix', segment: 'shopping-list' },
  { key: 'quote', label: 'Devis', segment: 'quote/new' },
] as const;

export type QuoteFlowStepKey = (typeof QUOTE_FLOW_STEPS)[number]['key'];

export const QUOTE_FLOW_TOTAL = QUOTE_FLOW_STEPS.length;

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
  if (!step) return `/projects/${projectId}`;
  return `/projects/${projectId}/${step.segment}`;
}
