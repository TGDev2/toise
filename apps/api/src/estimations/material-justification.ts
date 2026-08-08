/**
 * E1-11 — composer la justification affichée d'une ligne de chiffrage : le
 * ratio, sa source, et la règle appliquée à l'exécution (double encollage
 * déclenché, pare-vapeur requis…).
 *
 * Généralise le mécanisme déjà en place pour `inclusion_reason_fr`
 * (`vapour-barrier.ts`, `wet-room.ts`, `floor-prep.ts`) : composé **une
 * seule fois**, ici, jamais retraduit côté web. Le réglage « afficher les
 * marques » (`company_profiles.show_material_brands`) n'intervient pas dans
 * ce module — il choisit seulement, à la réponse, laquelle des deux phrases
 * déjà écrites renvoyer (`materials/render-justification.ts`).
 *
 * Deux sources de texte, jamais trois :
 *  1. La clause de taux — obligatoire, tirée de `materials_catalog.source_*`
 *     pour tout matériau, sauf le carrelage à `consumption_model:
 *     'tile_adhesive'` : sa fiche est sourcée à une géométrie de référence
 *     (45×45), donc son qualificatif technique (« en U9 ») doit être
 *     recalculé sur le carreau réellement posé
 *     (`tile-consumption.ts::explainAdhesiveRate`), jamais lu tel quel au
 *     catalogue.
 *  2. Au plus une clause de règle — le double encollage s'il a déclenché la
 *     quantité, sinon la raison d'inclusion conditionnelle déjà rédigée par
 *     les modules de présence. La perte majorée par la pose reste hors
 *     périmètre : c'est un lookup catalogue, déjà visible ailleurs à l'écran
 *     (`waste_factor_percent` · `pose_type`), pas une règle de ce genre.
 */
import type { TileConsumptionModel } from '../materials/entities/material-catalog.entity';
import type { MaterialJustification } from './entities/estimation-result.entity';
import {
  adhesiveRateKgPerM2,
  explainAdhesiveRate,
  resolveTileGeometry,
  tileAreaCm2,
} from './tile-consumption';

export interface MaterialJustificationInput {
  material_unit: string;
  source_manufacturer?: string | null;
  source_product?: string | null;
  source_url?: string | null;
  source_consulted_on?: string | null;
  source_basis_fr?: string | null;
  consumption_model?: TileConsumptionModel | null;
  /**
   * Requis quand `consumption_model === 'tile_adhesive'` : sans lui, la
   * clause de taux retombe sur `source_basis_fr`, qui décrit la géométrie de
   * référence et non le carreau réellement posé.
   */
  tile_context?: {
    custom_params: Record<string, unknown>;
    surface_target: string;
  };
  /**
   * Raison d'inclusion déjà rédigée par `vapour-barrier.ts`/`wet-room.ts`/
   * `floor-prep.ts` — reprise verbatim, jamais retraduite ici.
   */
  inclusion_reason_fr?: string;
}

/** Nombre au format français : virgule décimale, pas de zéro superflu. */
function formatRate(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded % 1 === 0
    ? String(rounded)
    : String(rounded).replace('.', ',');
}

/** `2026-08-07` → `07/08/2026`. */
function formatConsultedOn(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function buildMaterialJustification(
  input: MaterialJustificationInput,
): MaterialJustification | undefined {
  if (!input.source_basis_fr) return undefined;

  let descriptiveClause_fr = input.source_basis_fr;
  let ruleClause_fr: string | undefined = input.inclusion_reason_fr;

  if (input.consumption_model === 'tile_adhesive' && input.tile_context) {
    const geometry = resolveTileGeometry(
      input.tile_context.custom_params,
      input.tile_context.surface_target,
    );
    const areaCm2 = tileAreaCm2(geometry);
    const rateKgM2 = adhesiveRateKgPerM2(
      areaCm2,
      input.tile_context.surface_target,
    );
    const explanation = explainAdhesiveRate(
      areaCm2,
      input.tile_context.surface_target,
    );
    descriptiveClause_fr = `${formatRate(rateKgM2)} kg/m² ${explanation.classification_fr}`;
    // Le double encollage explique la quantité : il prime sur une raison
    // d'inclusion conditionnelle si, un jour, un matériau portait les deux.
    ruleClause_fr = explanation.rule_fr ?? ruleClause_fr;
  }

  // Rendement définitionnel : `source_basis_fr` est déjà une phrase complète
  // et brand-free, il n'y a pas de fiche à citer.
  if (!input.source_manufacturer) {
    const text_fr = [descriptiveClause_fr, ruleClause_fr]
      .filter(Boolean)
      .join(' ');
    return { text_fr, text_unbranded_fr: text_fr };
  }

  const consulted_fr = input.source_consulted_on
    ? ` consultée le ${formatConsultedOn(input.source_consulted_on)}`
    : '';
  const product_fr = input.source_product ? ` ${input.source_product}` : '';

  const branded_fr = `${descriptiveClause_fr} selon la fiche technique ${input.source_manufacturer}${product_fr}${consulted_fr}.`;
  const unbranded_fr = `${descriptiveClause_fr} selon la fiche technique du fabricant${consulted_fr}.`;

  const text_fr = [branded_fr, ruleClause_fr].filter(Boolean).join(' ');
  const text_unbranded_fr = [unbranded_fr, ruleClause_fr]
    .filter(Boolean)
    .join(' ');

  return {
    text_fr,
    text_unbranded_fr,
    ...(input.source_url ? { source_url: input.source_url } : {}),
  };
}
