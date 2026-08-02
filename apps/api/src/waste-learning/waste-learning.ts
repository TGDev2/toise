import { WasteFactorInput } from '../estimations/estimation-engine';

/**
 * BACKLOG DATA-3 : statistiques des facteurs de perte appris. Module **pur**
 * (aucune dépendance Nest ni TypeORM) pour que la méthode soit testable seule,
 * et que le service ne porte que la collecte et la persistance.
 *
 * Une observation compare, sur un chantier terminé, ce que le moteur avait
 * prédit d'acheter à ce que l'utilisateur a réellement acheté. La perte
 * impliquée s'en déduit :
 *
 *     ratio       = acheté / estimé            (en conditionnements)
 *     perte_impl. = (1 + appliqué/100) × ratio − 1
 *
 * `appliqué` est le facteur figé sur la ligne d'estimation, pas la valeur
 * catalogue courante : une observation reste ainsi correctement interprétée
 * après un ré-apprentissage, et l'estimateur converge au lieu de dériver.
 *
 * Deux propriétés portent toute la méthode :
 *  - `ratio = 1` ⇒ perte impliquée = perte appliquée. **Ne rien ajuster est un
 *    point fixe** : l'inaction ne produit aucune dérive. C'est aussi ce qui
 *    neutralise l'arrondi au conditionnement, présent des deux côtés du ratio.
 *  - les lignes non ajustées sont **conservées**. Les exclure ne garderait que
 *    les erreurs (biais de sélection massif). Un utilisateur qui néglige
 *    d'ajuster tire vers `ratio = 1`, donc vers le statu quo : biais
 *    conservateur, assumé.
 */

export interface WasteObservation {
  material_id: string;
  pose_type: string;
  skill_level: string;
  /** Facteur de perte appliqué par le moteur au moment de l'estimation (%). */
  applied_percent: number;
  /** Conditionnements prédits par le moteur (> 0). */
  estimated_units: number;
  /** Conditionnements réellement achetés (> 0). */
  actual_units: number;
  /** Organisation propriétaire du chantier — plafonnement par organisation. */
  organization_id: string;
  /** Date de finalisation du budget — départage le plafonnement. */
  observed_at: Date;
}

export type WasteLearningStatus =
  | 'learned'
  | 'insufficient_volume'
  | 'too_dispersed'
  | 'no_change';

export interface WasteLearningOutcome {
  material_id: string;
  pose_type: string;
  skill_level: string;
  status: WasteLearningStatus;
  /** Valeur catalogue (DTU) vers laquelle on rétrécit. */
  baseline_percent: number;
  /** Médiane robuste des pertes impliquées, avant crédibilité et bornes. */
  observed_percent: number | null;
  /** Valeur retenue, après crédibilité et bornes. Non nulle si `learned`. */
  factor_percent: number | null;
  /** Observations retenues, après plafonnement par organisation. */
  sample_size: number;
  /**
   * Observations **avant** plafonnement. Sans elle, une cellule bloquée est
   * indiagnosticable : `sample_size` stagne sans dire si c'est faute de
   * chantiers ou parce que ceux qui existent viennent tous du même client.
   */
  raw_sample_size: number;
  /** Organisations distinctes contribuant à la cellule. */
  organization_count: number;
}

/** Ce qui manque à une cellule pour franchir le seuil de volume. */
export interface WasteLearningShortfall {
  /** Observations manquantes, à nombre d'organisations constant. */
  missing_observations: number;
  /**
   * Organisations manquantes. Non nul ⇒ **aucun chantier supplémentaire des
   * organisations déjà présentes ne débloquera la cellule** : le plafond par
   * organisation borne l'échantillon à `organization_count × cap`.
   */
  missing_organizations: number;
}

export interface WasteLearningOptions {
  /** En deçà, aucune valeur apprise : le catalogue DTU reste seul maître. */
  minObservations: number;
  /**
   * Plafond de politique par organisation et par cellule (les plus récentes).
   * Le plafond réellement appliqué est `organizationObservationCap`, qui ne
   * dépasse jamais celui-ci mais peut le resserrer.
   */
  maxObservationsPerOrg: number;
  /** Constante de crédibilité (Bühlmann) : poids = n / (n + K). */
  credibilityK: number;
  /** Écart maximal autorisé à la valeur catalogue, en points. */
  maxDeviationPoints: number;
  /** Écart absolu médian maximal toléré dans une cellule, en points. */
  maxMadPoints: number;
  /** En deçà, on n'écrit rien : du bruit sans valeur. */
  minAdjustmentPoints: number;
  minFactorPercent: number;
  maxFactorPercent: number;
}

export const DEFAULT_WASTE_LEARNING_OPTIONS: WasteLearningOptions = {
  minObservations: 8,
  maxObservationsPerOrg: 5,
  credibilityK: 12,
  maxDeviationPoints: 10,
  maxMadPoints: 15,
  minAdjustmentPoints: 0.5,
  minFactorPercent: 0,
  maxFactorPercent: 30,
};

/** Identité d'une cellule d'apprentissage : matériau × pose × niveau. */
export function wasteCellKey(cell: {
  material_id: string;
  pose_type: string;
  skill_level: string;
}): string {
  return `${cell.material_id}|${cell.pose_type}|${cell.skill_level}`;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Écart absolu médian, **non redressé** (pas de facteur 1,4826) : le seuil
 * `maxMadPoints` s'exprime donc directement en points de perte.
 */
export function medianAbsoluteDeviation(
  values: number[],
  center: number,
): number {
  return median(values.map((v) => Math.abs(v - center)));
}

/** Perte impliquée par une observation, en pourcentage. */
export function impliedWastePercent(observation: WasteObservation): number {
  const ratio = observation.actual_units / observation.estimated_units;
  return ((1 + observation.applied_percent / 100) * ratio - 1) * 100;
}

/**
 * Poids maximal d'une organisation dans une cellule, **dérivé** de
 * `minObservations` et non réglé indépendamment.
 *
 * La médiane ne protège que tant qu'aucun contributeur ne détient la moitié de
 * l'échantillon : au-delà, il la place où il veut, et son unanimité annule au
 * passage le MAD — le test de dispersion, seul autre garde-fou, laisse alors
 * tout passer. Deux constantes indépendantes (`minObservations: 8`,
 * `maxObservationsPerOrg: 5`) laissaient précisément un tenant peser 62,5 %.
 *
 * Dériver la valeur plutôt que la choisir petite est ce qui rend l'oubli sûr :
 * régler `minObservations` ne peut plus rouvrir le trou en silence. Un minimum
 * fixé sous 3 donne un plafond nul et rend la cellule inapprenable — la panne
 * va dans le bon sens, celui du catalogue DTU inchangé.
 */
export function organizationObservationCap(
  options: WasteLearningOptions,
): number {
  const strictMinority = Math.ceil(options.minObservations / 2) - 1;
  return Math.max(0, Math.min(options.maxObservationsPerOrg, strictMinority));
}

/**
 * Distance d'une cellule au seuil de volume, exprimée dans les deux unités qui
 * la commandent réellement. Le plafond par organisation rend les deux
 * nécessaires : à 2 organisations et un cap de 3, une cellule plafonne à 6
 * observations retenues et n'apprendra **jamais**, quel que soit le nombre de
 * chantiers ajoutés. Ne rapporter que les observations manquantes laisserait
 * croire à une attente qui n'aboutira pas.
 */
export function wasteLearningShortfall(
  outcome: Pick<WasteLearningOutcome, 'sample_size' | 'organization_count'>,
  options: WasteLearningOptions = DEFAULT_WASTE_LEARNING_OPTIONS,
): WasteLearningShortfall {
  // Plancher à 1 : un plafond nul (configuration dégénérée, `minObservations`
  // sous 3) rend la cellule inapprenable de toute façon — `sample_size` y reste
  // à 0, donc les deux manques sortent au maximum. Pas de sentinelle à faire
  // traverser au JSON pour un cas qui n'a pas de vocabulaire à lui.
  const cap = Math.max(1, organizationObservationCap(options));
  const requiredOrganizations = Math.ceil(options.minObservations / cap);
  return {
    missing_observations: Math.max(
      0,
      options.minObservations - outcome.sample_size,
    ),
    missing_organizations: Math.max(
      0,
      requiredOrganizations - outcome.organization_count,
    ),
  };
}

/**
 * Plafonne le nombre d'observations qu'une même organisation peut peser dans
 * une cellule : sans cela, une entreprise qui enchaîne les mêmes chantiers
 * deviendrait à elle seule la vérité du catalogue pour tous les autres. Les
 * plus récentes sont conservées.
 */
function capPerOrganization(
  observations: WasteObservation[],
  maxPerOrg: number,
): WasteObservation[] {
  const byOrg = new Map<string, WasteObservation[]>();
  for (const obs of observations) {
    const group = byOrg.get(obs.organization_id);
    if (group) group.push(obs);
    else byOrg.set(obs.organization_id, [obs]);
  }

  const kept: WasteObservation[] = [];
  for (const group of byOrg.values()) {
    group.sort((a, b) => b.observed_at.getTime() - a.observed_at.getTime());
    kept.push(...group.slice(0, maxPerOrg));
  }
  return kept;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Calcule, cellule par cellule, le facteur de perte appris. `resolveBaseline`
 * fournit la valeur catalogue de la cellule, résolue exactement comme le
 * moteur (exact → `standard` → défaut) : c'est vers elle qu'on rétrécit, donc
 * l'étalonnage DTU d'ENG-5 reste la référence et non un simple point de départ.
 *
 * Retourne une ligne par cellule observée, y compris celles écartées, pour que
 * l'admin puisse voir *pourquoi* une cellule n'apprend pas. Seules les cellules
 * `learned` sont persistées (`WasteLearningService.persist`) : les autres ne
 * vivent que le temps du run, dans son résumé.
 */
export function learnWasteFactors(
  observations: WasteObservation[],
  resolveBaseline: (cell: {
    material_id: string;
    pose_type: string;
    skill_level: string;
  }) => number,
  options: WasteLearningOptions = DEFAULT_WASTE_LEARNING_OPTIONS,
): WasteLearningOutcome[] {
  const cells = new Map<string, WasteObservation[]>();
  for (const obs of observations) {
    const key = wasteCellKey(obs);
    const group = cells.get(key);
    if (group) group.push(obs);
    else cells.set(key, [obs]);
  }

  const outcomes: WasteLearningOutcome[] = [];

  for (const group of cells.values()) {
    const { material_id, pose_type, skill_level } = group[0];
    const baseline = resolveBaseline({ material_id, pose_type, skill_level });
    const retained = capPerOrganization(
      group,
      organizationObservationCap(options),
    );
    const n = retained.length;

    const cell = {
      material_id,
      pose_type,
      skill_level,
      sample_size: n,
      raw_sample_size: group.length,
      organization_count: new Set(retained.map((o) => o.organization_id)).size,
    };

    if (n < options.minObservations) {
      outcomes.push({
        ...cell,
        status: 'insufficient_volume',
        baseline_percent: baseline,
        observed_percent: null,
        factor_percent: null,
      });
      continue;
    }

    const implied = retained.map(impliedWastePercent);
    const observed = median(implied);

    // Une médiane sur un échantillon bimodal (moitié achète le double, moitié
    // la moitié) ne décrit rien : mieux vaut ne pas apprendre que « apprendre »
    // le milieu de deux populations qui n'ont rien en commun.
    if (medianAbsoluteDeviation(implied, observed) > options.maxMadPoints) {
      outcomes.push({
        ...cell,
        status: 'too_dispersed',
        baseline_percent: baseline,
        observed_percent: round2(observed),
        factor_percent: null,
      });
      continue;
    }

    // Crédibilité (Bühlmann) : on ne saute pas sur la médiane observée, on s'en
    // rapproche d'autant plus que l'échantillon est grand.
    const credibility = n / (n + options.credibilityK);
    const target = baseline + credibility * (observed - baseline);

    const bounded = clamp(
      clamp(
        target,
        baseline - options.maxDeviationPoints,
        baseline + options.maxDeviationPoints,
      ),
      options.minFactorPercent,
      options.maxFactorPercent,
    );
    const learned = round2(bounded);

    outcomes.push({
      ...cell,
      status:
        Math.abs(learned - baseline) < options.minAdjustmentPoints
          ? 'no_change'
          : 'learned',
      baseline_percent: baseline,
      observed_percent: round2(observed),
      factor_percent: learned,
    });
  }

  return outcomes;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Superpose les facteurs appris au catalogue avant de nourrir le moteur : une
 * valeur apprise remplace la cellule catalogue de même (pose, niveau), et en
 * crée une si elle n'existait pas — un couple appris devient alors un point de
 * résolution exact là où le moteur retombait sur `standard` ou sur le défaut.
 * Le catalogue DTU lui-même n'est jamais réécrit.
 */
export function overlayLearnedWasteFactors(
  catalogFactors: WasteFactorInput[],
  learnedFactors: {
    pose_type: string;
    skill_level: string;
    factor_percent: number;
  }[],
): WasteFactorInput[] {
  if (learnedFactors.length === 0) return catalogFactors;

  const merged = [...catalogFactors];
  for (const learned of learnedFactors) {
    const entry: WasteFactorInput = {
      pose_type: learned.pose_type,
      skill_level: learned.skill_level,
      factor_percent: Number(learned.factor_percent),
      source: 'learned',
    };
    const index = merged.findIndex(
      (wf) =>
        wf.pose_type === learned.pose_type &&
        wf.skill_level === learned.skill_level,
    );
    if (index >= 0) merged[index] = entry;
    else merged.push(entry);
  }
  return merged;
}
