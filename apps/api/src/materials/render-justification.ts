import type { MaterialJustification } from '../estimations/entities/estimation-result.entity';

/**
 * E1-11 — le seul endroit où le réglage « afficher les marques »
 * (`company_profiles.show_material_brands`) est lu. Les deux phrases sont
 * déjà écrites (`estimations/material-justification.ts`) ; ce n'est qu'une
 * pioche, jamais une reconstruction — même discipline que
 * `inclusion_reason_fr`, qui n'est jamais retraduit côté web.
 *
 * `justification_url` n'est jamais rendu quand les marques sont masquées :
 * l'URL de la fiche (`cermix.com/…`) trahit le fabricant autant que son nom.
 */
export function pickJustification(
  justification: MaterialJustification | undefined,
  showBrands: boolean,
): { justification_fr?: string; justification_url?: string } {
  if (!justification) return {};
  if (showBrands) {
    return {
      justification_fr: justification.text_fr,
      ...(justification.source_url
        ? { justification_url: justification.source_url }
        : {}),
    };
  }
  return { justification_fr: justification.text_unbranded_fr };
}
