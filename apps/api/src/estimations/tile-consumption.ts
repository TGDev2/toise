/**
 * E1-5 — ce que le format du carreau change à la consommation des consommables
 * de carrelage.
 *
 * D'où vient ce module. `tile_format` était seedé `required: true` sur
 * `floor_tiling`, affiché à l'écran, validé côté serveur, stocké dans
 * `custom_params` — et lu par **aucun calcul**. Choisir 20 × 20 ou 60 × 60
 * donnait la même colle au kilo près et le même joint. L'invariant I6 du
 * harnais nommait ce défaut depuis E1-1.
 *
 * Ce que ce module porte, et ce qu'il ne porte pas
 * ------------------------------------------------
 * Il porte la **loi de forme** : comment la consommation varie avec la
 * géométrie du carreau. Il ne porte **aucun niveau** de consommation absolu :
 * celui-ci reste dans `materials_catalog.yield_per_unit`, seule source du
 * chiffre. Les facteurs rendus ici sont donc **normalisés à 1 sur une
 * géométrie de référence** (`REFERENCE_TILE_FORMAT`), qui est aussi celle à
 * laquelle le rendement de chaque matériau marqué est exprimé au registre
 * `docs/SOURCES_CATALOGUE.md`.
 *
 *     rendement effectif = yield_per_unit / facteur(géométrie)
 *
 * Conséquence voulue : un rendement retouché par un administrateur déplace
 * toute la courbe, et rien n'est décrit deux fois — le catalogue dit *combien*,
 * ce module dit *comment ça varie*.
 *
 * Le moteur ne connaît aucun code d'ouvrage. La destination (sol ou mur) lui
 * vient de `surface_target`, qu'il lit déjà pour la géométrie de la pièce.
 *
 * Sources
 * -------
 * **Seuil de double encollage — NF DTU 52.2 (juin 2022).** Le texte intégral
 * est payant et n'a pas été lu. Les seuils ci-dessous viennent du mémento
 * « Les points-clés — LA RÉGLEMENTATION DTU 52.2 », retrouvé **identique sur
 * deux hôtes indépendants** (checkmy-house.fr, carrelage-au-carre.com), ce qui
 * écarte l'erreur de transcription d'un seul site. Le « 900 cm² » qui circule
 * sur les pages marchandes n'est corroboré par aucune de ces deux copies : il
 * est écarté explicitement.
 *
 * **Consommation de colle — Cermix, consistance normale.** La même table est
 * publiée par quatre fiches de **classes différentes** — CERMICOL EXTRA (C1 E),
 * CERMIPLUS 2.0 (C2), CERMIPLUS RAPID (C2 rapide) et CERMIFLEX (C2S1 ET). C'est
 * le résultat qui décide de tout ici : **aucune fiche ne fait dépendre la
 * consommation de la classe de colle.** Elle dépend du peigne, que le format
 * sélectionne. Un mortier « grand format » ne consomme pas plus qu'un C2 à
 * format égal — il consomme plus parce qu'on le pose sur du grand format.
 *
 * **Consommation de joint — Cermix CERMIJOINT COLOR (CG2WA).** La fiche publie
 * sa formule : `0,17 × ép(mm) × largeur de joint(mm) × (L + l) / (L × l)`, avec
 * L et l en centimètres. En millimètres partout, c'est la formule fabricant
 * standard `((L + l) / (L × l)) × e × j × d` avec une densité apparente
 * `d = 1,7 kg/dm³`. Vérifiée contre la table publiée de la même fiche :
 * 20 × 20 à 3 mm → 0,4 ; 45 × 45 à 3 mm → 0,2 ; 60 × 60 à 2 mm → 0,1 kg/m².
 *
 * La densité **n'apparaît pas dans ce module** : elle se simplifie dans le
 * rapport de deux géométries. C'est elle, et elle seule, qui distingue un joint
 * fin d'un joint époxy — donc elle appartient au rendement catalogue du
 * produit, pas à la loi de forme.
 *
 * Toutes les fiches ont été chargées le 2026-08-07. URL au registre.
 */

// Le type vit avec la colonne qui le porte, comme `MaterialQuantityDriver`.
import type { TileConsumptionModel } from '../materials/entities/material-catalog.entity';

export type { TileConsumptionModel };

export const TILE_CONSUMPTION_MODELS: TileConsumptionModel[] = [
  'tile_adhesive',
  'tile_grout',
];

/** Géométrie d'un format de carreau, en millimètres. */
export interface TileGeometry {
  length_mm: number;
  width_mm: number;
  /**
   * Épaisseur du carreau. **Interpolation à l'intérieur d'une plage publiée,
   * pas un chiffre de fiche** : CERMIJOINT COLOR annonce « 7-10 mm » pour tous
   * les formats de 20 × 20 à 100 × 100 sans les distinguer. La progression
   * retenue (8 / 9 / 10 mm du petit au grand format, 7 mm pour la faïence
   * murale) reste dans cette plage et suit le fait qu'un grand format se fait
   * plus épais pour ne pas casser. C'est le terme le moins déterminant de la
   * formule : il varie de 30 % quand la largeur de joint varie de 300 %.
   */
  thickness_mm: number;
  /**
   * Largeur de joint retenue quand l'utilisateur répond « Recommandé pour ce
   * format ».
   *
   * Le NF DTU 52.2 ne donne que des **minimums** : 2 mm pour un carreau NF UPEC
   * en sol intérieur, 2 mm pour un carreau rectifié en mur intérieur, 3 mm pour
   * un carreau pressé non rectifié de plus de 500 cm² en mur intérieur. Au-delà
   * de ces planchers, la valeur ci-dessous est un **défaut de catalogue** : le
   * joint s'élargit quand le format rétrécit, parce qu'un petit format multiplie
   * les lignes de joint et pardonne moins un joint fin. Ce n'est pas une
   * prescription — la question est posée à l'écran et la réponse prime.
   */
  default_joint_width_mm: number;
}

/**
 * Les cinq formats proposés par `work_types.contextual_questions` sur
 * `floor_tiling`, plus la faïence 25 × 40 qui n'est proposée nulle part mais
 * qui est l'hypothèse murale écrite au registre depuis E1-7.
 */
export const TILE_FORMATS: Readonly<Record<string, TileGeometry>> = {
  '20x20': {
    length_mm: 200,
    width_mm: 200,
    thickness_mm: 8,
    default_joint_width_mm: 5,
  },
  '30x30': {
    length_mm: 300,
    width_mm: 300,
    thickness_mm: 8,
    default_joint_width_mm: 3,
  },
  '45x45': {
    length_mm: 450,
    width_mm: 450,
    thickness_mm: 9,
    default_joint_width_mm: 3,
  },
  '60x60': {
    length_mm: 600,
    width_mm: 600,
    thickness_mm: 10,
    default_joint_width_mm: 2,
  },
  '30x60': {
    length_mm: 300,
    width_mm: 600,
    thickness_mm: 9,
    default_joint_width_mm: 3,
  },
  // Faïence murale : hypothèse `wall_tiling` de docs/SOURCES_CATALOGUE.md.
  '25x40': {
    length_mm: 250,
    width_mm: 400,
    thickness_mm: 7,
    default_joint_width_mm: 3,
  },
};

/**
 * Format retenu quand l'ouvrage ne demande pas la question — `wall_tiling`
 * aujourd'hui — ou quand la réponse est absente. Ce sont exactement les deux
 * hypothèses déjà écrites dans `docs/SOURCES_CATALOGUE.md` : « `floor_tiling` :
 * carreau par défaut 45 × 45 cm » et « `wall_tiling` : faïence 25 × 40 cm ».
 */
const DEFAULT_FORMAT_BY_SURFACE: Readonly<Record<string, string>> = {
  floor: '45x45',
  ceiling: '45x45',
  wall: '25x40',
};

/**
 * Géométrie de référence des deux modèles : celle à laquelle le rendement
 * catalogue de chaque matériau marqué est exprimé au registre. Le facteur y
 * vaut 1 par construction, et le chiffrage d'un 45 × 45 au sol est donc
 * **exactement** ce que le catalogue annonce.
 */
export const REFERENCE_TILE_FORMAT = '45x45';
export const REFERENCE_SURFACE_TARGET = 'floor';

/** Réponse `joint_width_mm` qui délègue la largeur au format choisi. */
export const AUTO_JOINT_WIDTH = 'auto';

const areaCm2 = (geometry: TileGeometry): number =>
  (geometry.length_mm * geometry.width_mm) / 100;

// ---------------------------------------------------------------------------
// Double encollage — NF DTU 52.2
// ---------------------------------------------------------------------------

/**
 * Porosité du carreau sous laquelle le DTU bascule la tranche 500-1 200 cm² en
 * double encollage au sol. Le catalogue ne porte pas la porosité de ses
 * carreaux : l'hypothèse assumée, écrite au registre, est le **grès cérame**
 * (porosité couramment < 0,5 %), ce qui rend la condition toujours vraie pour
 * les carrelages sol du catalogue V1. La constante est écrite pour que
 * l'hypothèse soit lisible, et pour que le jour où la porosité sera saisie il
 * n'y ait qu'un prédicat à brancher.
 */
export const LOW_POROSITY_ASSUMED = true;

/**
 * Le double encollage est-il imposé par le NF DTU 52.2 (juin 2022) ?
 *
 * Mémento « Les points-clés — LA RÉGLEMENTATION DTU 52.2 », verbatim :
 *
 *  - murs intérieurs — « Double encollage obligatoire à partir de 500 cm², que
 *    ce soit avec un mortier-colle (jusqu'à 3 600 cm²) ou un adhésif (jusqu'à
 *    2 200 cm²). »
 *  - sols intérieurs — « Double encollage obligatoire […] En intérieur au-delà
 *    de 1 200 cm² quelle que soit la porosité. En intérieur entre 500 et
 *    1 200 cm² uniquement si la porosité < 0,5 (ou < 2,0 pour la pierre
 *    naturelle). »
 *
 * L'extérieur (« quelle que soit la porosité et le format du carreau, sauf
 * surface ≤ 50 cm² ») n'est pas couvert par la V1 : aucun ouvrage du catalogue
 * ne pose en extérieur.
 *
 * **Le mur est plus restrictif que le sol** : à 800 cm², un carreau exige le
 * double encollage au mur, et ne l'exige au sol que par sa faible porosité.
 */
export function requiresDoubleButtering(
  tileAreaCm2: number,
  surfaceTarget: string,
): boolean {
  if (surfaceTarget === 'wall') {
    return tileAreaCm2 >= 500;
  }
  if (tileAreaCm2 > 1200) {
    return true;
  }
  return tileAreaCm2 >= 500 && LOW_POROSITY_ASSUMED;
}

// ---------------------------------------------------------------------------
// Colle — table Cermix par tranche de surface
// ---------------------------------------------------------------------------

interface AdhesiveBand {
  /** Borne haute **incluse** de la tranche, en cm². */
  max_area_cm2: number;
  /**
   * Cellule de fiche en simple encollage, `null` quand la fiche n'en publie pas
   * pour cette tranche — le DTU y impose de toute façon le double.
   */
  simple_kg_m2: number | null;
  /** Cellule de fiche en double encollage, ou cellule simple + supplément. */
  double_kg_m2: number;
  /** Ce que la fiche écrit, pour que la valeur se relise sans elle. */
  basis: string;
}

/**
 * Supplément de double encollage, note (1) des fiches Cermix : « Double
 * encollage si carreaux à faible porosité (DTU 52.2) : soit une consommation
 * supplémentaire de 1 à 1.5 kg/m² ».
 *
 * **Additif, jamais multiplicatif** — c'est ce que publient les quatre
 * fabricants qui séparent les deux colonnes : Weber +1,5 exactement sur ses
 * trois lignes (3 → 4,5 ; 4 → 5,5 ; 5 → 6,5), Mapei +1,5 (U6, U9), PRB +1,5 à
 * +2,5. Un facteur multiplicatif constant, calé sur le petit format (× 1,5),
 * surestimerait la colle de 15 à 20 % au-delà de 1 200 cm².
 *
 * 1,5 est retenu plutôt que 1 : c'est la borne haute de la fourchette Cermix et
 * la valeur exacte des trois autres fabricants.
 */
const DOUBLE_BUTTERING_SUPPLEMENT_KG_M2 = 1.5;

/**
 * Sol intérieur, consistance normale. Cellules identiques chez CERMICOL EXTRA
 * (C1 E), CERMIPLUS 2.0 (C2), CERMIPLUS RAPID et CERMIFLEX (C2S1 ET).
 */
const FLOOR_ADHESIVE_BANDS: AdhesiveBand[] = [
  {
    max_area_cm2: 300,
    simple_kg_m2: 3.5,
    double_kg_m2: 3.5 + DOUBLE_BUTTERING_SUPPLEMENT_KG_M2,
    basis: 'Cermix, sol intérieur, S ≤ 300 cm² : « 3,5 (U6) »',
  },
  {
    max_area_cm2: 500,
    simple_kg_m2: 4.5,
    double_kg_m2: 4.5 + DOUBLE_BUTTERING_SUPPLEMENT_KG_M2,
    basis: 'Cermix, sol intérieur, 300 < S ≤ 500 cm² : « 4,5 (U9) »',
  },
  {
    max_area_cm2: 1200,
    simple_kg_m2: 4.5,
    double_kg_m2: 4.5 + DOUBLE_BUTTERING_SUPPLEMENT_KG_M2,
    basis:
      'Cermix, sol intérieur, 500 < S ≤ 1 200 cm² : « 4,5 (U9) » + note (1) « consommation supplémentaire de 1 à 1.5 kg/m² »',
  },
  {
    max_area_cm2: 2200,
    simple_kg_m2: null,
    double_kg_m2: 7,
    basis: 'Cermix, sol intérieur, 1 200 < S ≤ 2 200 cm² : « 7 (U9) »',
  },
  {
    max_area_cm2: 3600,
    simple_kg_m2: null,
    double_kg_m2: 8,
    basis: 'Cermix, sol intérieur, 2 200 < S ≤ 3 600 cm² : « 8 (E10) »',
  },
  {
    max_area_cm2: 8100,
    simple_kg_m2: null,
    double_kg_m2: 8,
    basis:
      'Cermix CERMIPLUS 2.0, sol, 3 600 < S ≤ 8 100 cm² : « 8 (E10) », carreaux céramiques uniquement',
  },
];

/**
 * Mur intérieur, consistance normale, mêmes fiches. La marche de 3,5 à 7 kg/m²
 * à 500 cm² est exactement le seuil de double encollage du DTU au mur : la
 * fiche et la norme se recoupent sans qu'on ait à les rapprocher à la main.
 *
 * Aucun matériau du catalogue V1 n'emprunte cette table aujourd'hui — la colle
 * murale seedée est une pâte D2, dont la fiche est distincte, et `wall_tiling`
 * ne demande pas le format. Elle est écrite parce que le seuil mural **est** la
 * moitié de la question posée, et elle est éprouvée par `tile-consumption.spec.ts`.
 */
const WALL_ADHESIVE_BANDS: AdhesiveBand[] = [
  {
    max_area_cm2: 300,
    simple_kg_m2: 3.5,
    double_kg_m2: 3.5 + DOUBLE_BUTTERING_SUPPLEMENT_KG_M2,
    basis: 'Cermix, mur intérieur, S ≤ 300 cm² : « 3,5 (U6) »',
  },
  {
    max_area_cm2: 500,
    simple_kg_m2: 3.5,
    double_kg_m2: 3.5 + DOUBLE_BUTTERING_SUPPLEMENT_KG_M2,
    basis:
      'Cermix, mur intérieur, 300 < S ≤ 500 cm² : « 3,5 (U6) » + note (1) « consommation supplémentaire de 1 à 1.5 kg/m² »',
  },
  {
    max_area_cm2: 1200,
    simple_kg_m2: null,
    double_kg_m2: 7,
    basis: 'Cermix, mur intérieur, 500 < S ≤ 1 200 cm² : « 7 (U9) »',
  },
  {
    max_area_cm2: 2200,
    simple_kg_m2: null,
    double_kg_m2: 7,
    basis: 'Cermix, mur intérieur, 1 200 < S ≤ 2 200 cm² : « 7 (U9) »',
  },
  {
    max_area_cm2: 3600,
    simple_kg_m2: null,
    double_kg_m2: 8,
    basis:
      'Cermix CERMIFLEX, mur intérieur, 2 200 < S ≤ 3 600 cm² : « 8 (E10) »',
  },
];

const bandsFor = (surfaceTarget: string): AdhesiveBand[] =>
  surfaceTarget === 'wall' ? WALL_ADHESIVE_BANDS : FLOOR_ADHESIVE_BANDS;

/**
 * Consommation de mortier-colle, en kg par m² d'ouvrage, pour un carreau de
 * cette surface posé sur cette destination. Le mode d'encollage n'est pas un
 * paramètre : il est **déduit** du format et de la destination par le seuil
 * DTU, parce que c'est une obligation de mise en œuvre et non un choix.
 */
export function adhesiveRateKgPerM2(
  tileAreaCm2: number,
  surfaceTarget: string,
): number {
  const bands = bandsFor(surfaceTarget);
  const band =
    bands.find((candidate) => tileAreaCm2 <= candidate.max_area_cm2) ??
    bands[bands.length - 1];

  if (requiresDoubleButtering(tileAreaCm2, surfaceTarget)) {
    return band.double_kg_m2;
  }
  // Une tranche sans valeur en simple encollage est une tranche où le DTU
  // l'interdit : le prédicat ci-dessus a donc déjà rendu la main. Le repli
  // existe pour qu'un seuil desserré un jour ne renvoie pas `null`.
  return band.simple_kg_m2 ?? band.double_kg_m2;
}

// ---------------------------------------------------------------------------
// Joint — formule Cermix
// ---------------------------------------------------------------------------

/**
 * Volume de joint par m² de carrelage, en litres.
 *
 * `((L + l) / (L × l)) × e × j` avec tout en millimètres rend directement des
 * litres par m² : la longueur de joint sous un m² vaut `(L + l) / (L × l)` par
 * millimètre, sa section `e × j`. Multiplié par la densité apparente du mortier
 * de jointoiement, on retrouve les kg/m² de la fiche — mais la densité se
 * simplifie dans le rapport rendu par `tileConsumptionFactor`, et c'est
 * justement ce qui permet à la même loi de servir un joint fin, un joint large
 * et un époxy sans qu'aucun d'eux n'ait à déclarer sa densité au moteur.
 */
export function groutVolumeLitresPerM2(
  geometry: TileGeometry,
  jointWidthMm: number,
): number {
  const { length_mm: L, width_mm: l, thickness_mm: e } = geometry;
  return ((L + l) / (L * l)) * e * jointWidthMm;
}

// ---------------------------------------------------------------------------
// Résolution des paramètres d'ouvrage
// ---------------------------------------------------------------------------

/**
 * Géométrie retenue pour cet ouvrage. Un format inconnu — donnée d'avant ce lot,
 * ou appel qui inventerait sa valeur — retombe sur le défaut de la destination,
 * c'est-à-dire sur le comportement d'avant E1-5. Lever ici transformerait une
 * réponse périmée en estimation impossible.
 */
export function resolveTileGeometry(
  customParams: Record<string, unknown>,
  surfaceTarget: string,
): TileGeometry {
  const answered = customParams.tile_format;
  if (typeof answered === 'string' && TILE_FORMATS[answered]) {
    return TILE_FORMATS[answered];
  }
  const fallback =
    DEFAULT_FORMAT_BY_SURFACE[surfaceTarget] ??
    DEFAULT_FORMAT_BY_SURFACE[REFERENCE_SURFACE_TARGET];
  return TILE_FORMATS[fallback];
}

/**
 * Largeur de joint retenue. « Recommandé pour ce format » (`auto`), absence de
 * réponse et valeur illisible rendent toutes le défaut du format — un seul
 * chemin, donc pas d'état où l'écran annonce le recommandé et où le moteur
 * calcule autre chose.
 */
export function resolveJointWidthMm(
  customParams: Record<string, unknown>,
  geometry: TileGeometry,
): number {
  const answered = customParams.joint_width_mm;
  if (answered === undefined || answered === null || answered === '') {
    return geometry.default_joint_width_mm;
  }
  if (answered === AUTO_JOINT_WIDTH) {
    return geometry.default_joint_width_mm;
  }
  const width = Number(answered);
  return Number.isFinite(width) && width > 0
    ? width
    : geometry.default_joint_width_mm;
}

const REFERENCE_GEOMETRY = TILE_FORMATS[REFERENCE_TILE_FORMAT];

/** Consommation de référence des deux modèles, dénominateur des facteurs. */
const REFERENCE_ADHESIVE_KG_M2 = adhesiveRateKgPerM2(
  areaCm2(REFERENCE_GEOMETRY),
  REFERENCE_SURFACE_TARGET,
);
const REFERENCE_GROUT_LITRES_M2 = groutVolumeLitresPerM2(
  REFERENCE_GEOMETRY,
  REFERENCE_GEOMETRY.default_joint_width_mm,
);

/**
 * De combien la consommation de ce matériau s'écarte de celle qu'annonce son
 * rendement catalogue, compte tenu du carreau posé.
 *
 * Vaut exactement 1 sur la géométrie de référence — un 45 × 45 au sol avec son
 * joint recommandé chiffre donc au chiffre près ce que le catalogue annonce.
 */
export function tileConsumptionFactor(
  model: TileConsumptionModel,
  customParams: Record<string, unknown>,
  surfaceTarget: string,
): number {
  const geometry = resolveTileGeometry(customParams, surfaceTarget);

  if (model === 'tile_adhesive') {
    return (
      adhesiveRateKgPerM2(areaCm2(geometry), surfaceTarget) /
      REFERENCE_ADHESIVE_KG_M2
    );
  }

  return (
    groutVolumeLitresPerM2(
      geometry,
      resolveJointWidthMm(customParams, geometry),
    ) / REFERENCE_GROUT_LITRES_M2
  );
}

/** Surface d'un carreau, en cm² — exporté pour les tests et le registre. */
export const tileAreaCm2 = areaCm2;
