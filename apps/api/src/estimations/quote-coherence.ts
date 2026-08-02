/**
 * Cohérence d'une quantité annoncée face à la pièce (GTM-10).
 *
 * Le moteur d'estimation répond « quelle quantité cet ouvrage demande-t-il dans
 * cette pièce ? ». La même opération, retournée, répond « la quantité portée par
 * ce devis est-elle cohérente avec la pièce ? » : on compare la quantité déclarée
 * à la surface nette, et on exprime l'écart comme un **taux de perte impliqué**,
 * confronté à la fourchette du catalogue pour cette pose.
 *
 * ## Ce que ce module ne fait pas, et ne fera pas
 *
 * Il ne connaît aucun prix, et n'en connaîtra aucun : la décision produit (§ 4.7
 * de PRODUCT_STRATEGY) est que Chiffréo **mesure et n'arbitre pas**. Deux raisons
 * qui tiennent ensemble :
 *
 *  - *technique* : il n'existe aucun prix de référence dans le système.
 *    `materials_catalog` n'a pas de colonne de prix, et `cost_benchmarks` porte en
 *    base `CHECK (organization_count >= 5 AND sample_size >= 10)` avec une médiane
 *    `NOT NULL` — une cellule non publiable ne peut même pas être stockée ;
 *  - *produit* : un verdict « ce devis est excessif » peut faire perdre un chantier
 *    à une entreprise honnête, sur la foi d'un calcul qui ignore la contrainte de
 *    chantier et la découpe réelle.
 *
 * Corollaire de conception : ce module renvoie des **codes**, jamais du texte. La
 * formulation française vit à un seul endroit, côté web (`lib/quote-check.ts`), où
 * un test lui interdit le lexique prescriptif et tarifaire. Rendre du texte ici
 * ouvrirait une deuxième description de la même chose — le mode d'entrée exact de
 * la dérive corrigée par GTM-7 (leçon 15).
 */

import { WasteFactorInput, resolveWasteFactor } from './estimation-engine';

/**
 * Verdict de cohérence d'une quantité déclarée. Union **fermée** : chaque code
 * doit avoir une formulation côté web, et toute formulation doit correspondre à un
 * code (`quote-check-wording.spec.ts`). Ajouter un code sans sa phrase casse le
 * build, ce qui est le but.
 */
export type QuoteCoherenceStatus =
  /** Sous la fourchette : moins de perte que la pose la plus économe ne l'admet. */
  | 'below_reference'
  /** Dans la fourchette du catalogue pour cette pose. */
  | 'within_reference'
  /** Au-dessus de la fourchette. Descriptif : l'écart est constaté, pas qualifié. */
  | 'above_reference'
  /** Rien à comparer (surface nette nulle) — l'absence de verdict est un verdict. */
  | 'not_comparable';

/** Niveaux de compétence semés, du plus permissif au plus économe en perte. */
const SKILL_LEVELS = ['beginner', 'intermediate', 'expert'] as const;

export interface WasteReferenceBySkill {
  skill_level: string;
  percent: number;
}

export interface WasteReferenceRange {
  /** Pose effectivement retenue après repli — peut différer de celle demandée. */
  pose_type: string;
  min_percent: number;
  max_percent: number;
  by_skill: WasteReferenceBySkill[];
  /**
   * `true` quand aucune ligne du catalogue ne couvrait cette pose et que la
   * fourchette se réduit au défaut générique. La page doit le dire plutôt que de
   * présenter un défaut comme une référence de pose (leçon 13 : ne jamais laisser
   * « pas de référence » et « référence » produire le même écran).
   */
  is_default: boolean;
}

/**
 * Fourchette de perte du catalogue pour une pose, tous niveaux confondus.
 *
 * Déléguée à `resolveWasteFactor` niveau par niveau plutôt que réimplémentée : la
 * chaîne de repli (pose exacte → pose `standard` du même niveau → défaut générique)
 * doit rester **la même** que celle qui a servi à chiffrer, sinon la référence
 * affichée ne serait pas celle appliquée. C'est la raison pour laquelle
 * `resolveWasteFactor` est exportée comme fonction pure.
 */
export function wasteReferenceRange(
  wasteFactors: WasteFactorInput[],
  poseType: string,
): WasteReferenceRange {
  const by_skill = SKILL_LEVELS.map((skill_level) => ({
    skill_level,
    resolved: resolveWasteFactor(wasteFactors, poseType, skill_level),
  }));

  const percents = by_skill.map((s) => s.resolved.percent);

  // La pose retenue n'est `poseType` que si au moins une ligne l'a servie telle
  // quelle ; sinon la fourchette décrit `standard`, ou le défaut générique.
  const servedExactly = wasteFactors.some((wf) => wf.pose_type === poseType);
  const isDefault = by_skill.every((s) => s.resolved.source === 'default');

  return {
    pose_type: servedExactly ? poseType : 'standard',
    min_percent: Math.min(...percents),
    max_percent: Math.max(...percents),
    by_skill: by_skill.map(({ skill_level, resolved }) => ({
      skill_level,
      percent: resolved.percent,
    })),
    is_default: isDefault,
  };
}

/**
 * Fourchette dominante d'un ouvrage, tous ses matériaux confondus.
 *
 * Le catalogue attache un facteur de perte **par matériau**, or la quantité que
 * porte un devis vise **l'ouvrage**. Il faut donc désigner laquelle des fourchettes
 * fait référence, et le faire sur une règle et non au jugé.
 *
 * Règle retenue : celle que **le plus grand nombre de matériaux de l'ouvrage
 * partagent**. Elle tombe juste sur les cinq catégories semées, parce que les
 * accessoires comptables (croisillons, pinceaux, cales…) sont toujours minoritaires
 * face aux matériaux de l'ouvrage : carrelage → 5–15 % en pose droite, peinture →
 * 5–15 %, sol → 5–10 %. Une règle par unité (`m2`) ou par nom échouerait : la
 * peinture se compte en litres, et le white-spirit aussi tout en portant la
 * fourchette des accessoires.
 *
 * Égalité tranchée par la fourchette **la plus large**. C'est le sens prudent : une
 * fourchette large produit moins de verdicts « au-dessus », et le risque nommé par
 * cette fonctionnalité est de signaler un écart chez une entreprise honnête, pas
 * d'en manquer un.
 */
export function dominantWasteReference(
  materials: { waste_factors: WasteFactorInput[] }[],
  poseType: string,
): WasteReferenceRange {
  const ranges = materials.map((m) =>
    wasteReferenceRange(m.waste_factors, poseType),
  );

  if (ranges.length === 0) {
    return wasteReferenceRange([], poseType);
  }

  const byShape = new Map<
    string,
    { range: WasteReferenceRange; count: number }
  >();
  for (const range of ranges) {
    // La forme est la suite des pourcentages par niveau : deux matériaux qui
    // chiffrent pareil à tous les niveaux portent la même fourchette.
    const shape = range.by_skill.map((s) => s.percent).join('/');
    const seen = byShape.get(shape);
    if (seen) {
      seen.count += 1;
    } else {
      byShape.set(shape, { range, count: 1 });
    }
  }

  let best: { range: WasteReferenceRange; count: number } | null = null;
  for (const candidate of byShape.values()) {
    if (
      !best ||
      candidate.count > best.count ||
      (candidate.count === best.count &&
        candidate.range.max_percent - candidate.range.min_percent >
          best.range.max_percent - best.range.min_percent)
    ) {
      best = candidate;
    }
  }

  return best!.range;
}

/**
 * Taux de perte que la quantité déclarée implique par rapport à la surface
 * réellement à traiter : `declared / required - 1`, en pourcentage.
 *
 * `null` quand il n'y a rien à comparer (surface nette nulle ou négative) — une
 * division par zéro rendrait `Infinity`, qui s'afficherait comme un écart record
 * alors qu'il n'y a aucune information. Arrondi au dixième de point : au-delà, on
 * afficherait une précision que la mesure d'une pièce ne porte pas.
 */
export function impliedWastePercent(
  declaredQty: number,
  requiredQty: number,
): number | null {
  if (!(requiredQty > 0)) {
    return null;
  }
  return Math.round((declaredQty / requiredQty - 1) * 1000) / 10;
}

/**
 * Position de la quantité déclarée vis-à-vis de la fourchette du catalogue.
 *
 * Les bornes sont **inclusives** : une quantité qui tombe exactement sur la perte
 * d'un niveau semé est dans la fourchette, pas au-dessus. Un devis à +15 % en pose
 * droite décrit exactement un chantier de débutant ; le classer « au-dessus »
 * signalerait un écart là où le catalogue dit qu'il n'y en a pas.
 */
export function classifyDeclared(
  impliedPercent: number | null,
  reference: WasteReferenceRange,
): QuoteCoherenceStatus {
  if (impliedPercent === null) {
    return 'not_comparable';
  }
  if (impliedPercent < reference.min_percent) {
    return 'below_reference';
  }
  if (impliedPercent > reference.max_percent) {
    return 'above_reference';
  }
  return 'within_reference';
}
