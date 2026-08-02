// `median` est déjà exportée et testée par DATA-3 : dupliquer une médiane dans
// la même base de code coûterait deux implémentations à garder d'accord.
import { median } from '../waste-learning/waste-learning';

/**
 * BACKLOG DATA-4 : benchmark de coûts anonymisé. Module **pur** (aucune
 * dépendance Nest ni TypeORM), comme `waste-learning.ts` : la méthode
 * statistique et ses garde-fous d'anonymat sont testables seuls, le service ne
 * porte que la collecte et la persistance.
 *
 * Ce module publie des chiffres calculés sur les dépenses réelles de gens qui
 * ne les ont pas rendues publiques. Tout y est donc organisé autour d'une seule
 * règle : **une cellule qui ne satisfait pas le k-anonymat n'est pas produite**.
 * Elle n'est pas produite puis filtrée à la lecture — elle n'existe jamais, de
 * sorte qu'aucune évolution ultérieure du chemin de lecture ne puisse la
 * divulguer.
 *
 * Trois seuils, écrits avant toute collecte pour qu'ils ne se rationalisent pas
 * après coup (cf. `tasks/lessons.md` n°1) :
 *  - `minOrganizations` — le k proprement dit ;
 *  - `minObservations` — le seuil de volume ;
 *  - `maxObservationsPerOrg` — pour qu'aucune organisation ne constitue à elle
 *    seule la cohorte, et donc ne puisse relire sa propre dépense dans la
 *    médiane publiée.
 *
 * Seule la **médiane** est publiée. Un minimum, un maximum ou un quartile sont
 * des dépenses individuelles réelles : les exposer reviendrait à désigner un
 * chantier précis, k-anonymat ou non.
 */

export type SurfaceBand = 'small' | 'medium' | 'large';

/**
 * Le coût au m² n'est pas comparable à surface libre : le conditionnement est
 * indivisible (un pot entier pour 2 m²), si bien qu'un petit chantier paraît
 * toujours cher. Sans bandes, le benchmark annoncerait un dépassement à tout
 * petit chantier — un artefact d'emballage présenté comme un mauvais achat.
 *
 * Trois bandes seulement : chaque bande supplémentaire divise le volume par
 * cellule, donc retarde d'autant le franchissement du k-anonymat.
 */
export const SURFACE_BANDS: {
  band: SurfaceBand;
  /** Borne supérieure exclue, en m². `null` = pas de borne. */
  max_m2: number | null;
  label_fr: string;
}[] = [
  { band: 'small', max_m2: 10, label_fr: 'moins de 10 m²' },
  { band: 'medium', max_m2: 30, label_fr: 'de 10 à 30 m²' },
  { band: 'large', max_m2: null, label_fr: '30 m² et plus' },
];

export function resolveSurfaceBand(surfaceM2: number): SurfaceBand {
  for (const { band, max_m2 } of SURFACE_BANDS) {
    if (max_m2 === null || surfaceM2 < max_m2) return band;
  }
  return 'large';
}

export function surfaceBandLabel(band: SurfaceBand): string {
  return SURFACE_BANDS.find((b) => b.band === band)?.label_fr ?? '';
}

/** Un type d'ouvrage d'un chantier terminé, ramené au m². */
export interface CostObservation {
  work_type_code: string;
  /** Surface de l'ouvrage, dédoublonnée par (pièce × work item). */
  surface_m2: number;
  /** Coût matériaux réel de cet ouvrage rapporté au m² (> 0). */
  cost_per_m2: number;
  /** Organisation propriétaire — plafonnement et comptage du k-anonymat. */
  organization_id: string;
  /** Date de finalisation du budget — départage le plafonnement. */
  observed_at: Date;
}

export type BenchmarkCellStatus =
  | 'published'
  | 'insufficient_volume'
  | 'insufficient_anonymity';

export interface BenchmarkCell {
  work_type_code: string;
  surface_band: SurfaceBand;
  status: BenchmarkCellStatus;
  /** Non nul **si et seulement si** `status === 'published'`. */
  median_cost_per_m2: number | null;
  /** Observations retenues, après plafonnement par organisation. */
  sample_size: number;
  organization_count: number;
}

export interface CostBenchmarkOptions {
  /** Seuil de volume : en deçà, une médiane ne décrit rien. */
  minObservations: number;
  /** Le k du k-anonymat : organisations distinctes derrière une médiane. */
  minOrganizations: number;
  /** Observations retenues par organisation et par cellule (les plus récentes). */
  maxObservationsPerOrg: number;
  /** En deçà en valeur absolue, on annonce « dans la médiane » (%). */
  neutralBandPercent: number;
}

export const DEFAULT_COST_BENCHMARK_OPTIONS: CostBenchmarkOptions = {
  minObservations: 10,
  minOrganizations: 5,
  maxObservationsPerOrg: 3,
  neutralBandPercent: 3,
};

/** Identité d'une cellule de benchmark : type d'ouvrage × bande de surface. */
export function benchmarkCellKey(cell: {
  work_type_code: string;
  surface_band: SurfaceBand;
}): string {
  return `${cell.work_type_code}|${cell.surface_band}`;
}

/**
 * Plafonne le nombre d'observations qu'une même organisation pèse dans une
 * cellule. Double effet : une entreprise qui enchaîne les chantiers ne devient
 * pas à elle seule « la médiane du marché », et elle ne peut pas relire sa
 * propre dépense dans le chiffre publié. Les plus récentes sont conservées.
 */
function capPerOrganization(
  observations: CostObservation[],
  maxPerOrg: number,
): CostObservation[] {
  const byOrg = new Map<string, CostObservation[]>();
  for (const obs of observations) {
    const group = byOrg.get(obs.organization_id);
    if (group) group.push(obs);
    else byOrg.set(obs.organization_id, [obs]);
  }

  const kept: CostObservation[] = [];
  for (const group of byOrg.values()) {
    group.sort((a, b) => b.observed_at.getTime() - a.observed_at.getTime());
    kept.push(...group.slice(0, maxPerOrg));
  }
  return kept;
}

/**
 * Calcule, cellule par cellule, la médiane publiable du coût au m².
 *
 * Retourne une ligne par cellule observée, y compris celles écartées, pour que
 * l'admin voie *pourquoi* une cellule ne publie pas — mais une cellule écartée
 * porte `median_cost_per_m2: null` : la valeur n'est pas calculée puis masquée,
 * elle n'est pas calculée.
 */
export function buildCostBenchmarks(
  observations: CostObservation[],
  options: CostBenchmarkOptions = DEFAULT_COST_BENCHMARK_OPTIONS,
): BenchmarkCell[] {
  const cells = new Map<string, CostObservation[]>();
  for (const obs of observations) {
    // Une surface ou un coût nul ne décrit aucun chantier : la division serait
    // du bruit, ou une division par zéro.
    if (obs.surface_m2 <= 0 || obs.cost_per_m2 <= 0) continue;
    const key = benchmarkCellKey({
      work_type_code: obs.work_type_code,
      surface_band: resolveSurfaceBand(obs.surface_m2),
    });
    const group = cells.get(key);
    if (group) group.push(obs);
    else cells.set(key, [obs]);
  }

  const results: BenchmarkCell[] = [];

  for (const group of cells.values()) {
    const retained = capPerOrganization(group, options.maxObservationsPerOrg);
    const organizationCount = new Set(retained.map((o) => o.organization_id))
      .size;
    const cell = {
      work_type_code: group[0].work_type_code,
      surface_band: resolveSurfaceBand(group[0].surface_m2),
      sample_size: retained.length,
      organization_count: organizationCount,
    };

    if (organizationCount < options.minOrganizations) {
      results.push({
        ...cell,
        status: 'insufficient_anonymity',
        median_cost_per_m2: null,
      });
      continue;
    }

    if (retained.length < options.minObservations) {
      results.push({
        ...cell,
        status: 'insufficient_volume',
        median_cost_per_m2: null,
      });
      continue;
    }

    results.push({
      ...cell,
      status: 'published',
      median_cost_per_m2: round2(median(retained.map((o) => o.cost_per_m2))),
    });
  }

  return results;
}

export type BenchmarkPosition = 'below' | 'around' | 'above';

export interface BenchmarkComparison {
  work_type_code: string;
  surface_band: SurfaceBand;
  surface_m2: number;
  cost: number;
  cost_per_m2: number;
  median_cost_per_m2: number;
  /** > 0 : moins cher que la médiane. */
  delta_percent: number;
  position: BenchmarkPosition;
  sample_size: number;
  organization_count: number;
}

/**
 * Écart au chiffre de référence, en pourcentage **de la référence** : c'est la
 * formulation de la promesse produit (« X % de moins que la médiane »).
 *
 * La bande neutre évite d'annoncer « 0,4 % de moins » — une précision que la
 * méthode ne porte pas, sur une médiane de quelques dizaines d'observations.
 */
export function compareToReference(
  cost: number,
  reference: number,
  options: CostBenchmarkOptions = DEFAULT_COST_BENCHMARK_OPTIONS,
): { delta_percent: number; position: BenchmarkPosition } {
  const deltaPercent = round1(((reference - cost) / reference) * 100);
  if (Math.abs(deltaPercent) < options.neutralBandPercent) {
    return { delta_percent: deltaPercent, position: 'around' };
  }
  return {
    delta_percent: deltaPercent,
    position: deltaPercent > 0 ? 'below' : 'above',
  };
}

export interface BenchmarkOverall {
  /** Coût réel des seuls ouvrages comparables. */
  cost: number;
  /** Ce que les mêmes surfaces auraient coûté au tarif médian. */
  reference_cost: number;
  delta_percent: number;
  position: BenchmarkPosition;
}

/**
 * Agrège les ouvrages comparés en un seul chiffre. On ne moyenne **pas** les
 * pourcentages : chaque ouvrage est revalorisé à sa médiane (`médiane × sa
 * surface`) et l'écart est pris sur les totaux. Moyenner les pourcentages
 * donnerait autant de poids à 2 m² de peinture qu'à 40 m² de carrelage.
 *
 * Seuls les ouvrages effectivement comparés entrent des deux côtés du rapport.
 */
export function rollUpComparisons(
  comparisons: BenchmarkComparison[],
  options: CostBenchmarkOptions = DEFAULT_COST_BENCHMARK_OPTIONS,
): BenchmarkOverall | null {
  if (comparisons.length === 0) return null;

  const cost = comparisons.reduce((sum, c) => sum + c.cost, 0);
  const referenceCost = comparisons.reduce(
    (sum, c) => sum + c.median_cost_per_m2 * c.surface_m2,
    0,
  );
  if (referenceCost <= 0) return null;

  return {
    cost: round2(cost),
    reference_cost: round2(referenceCost),
    ...compareToReference(cost, referenceCost, options),
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
