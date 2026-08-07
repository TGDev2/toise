/**
 * Données du catalogue matériaux seedé par la migration
 * `1711468800006-SeedMaterialsCatalog`.
 *
 * Extrait tel quel de la migration (valeurs strictement identiques) pour que
 * les tests puissent faire tourner le moteur d'estimation sur le catalogue
 * réellement inséré en base, et non sur un fixture inventé. La migration
 * importe ce module : il n'existe qu'une seule source de vérité.
 */

import {
  MaterialQuantityDriver,
  TileConsumptionModel,
} from './entities/material-catalog.entity';

export interface SeedMaterial {
  name: string;
  category: 'painting' | 'tiling' | 'flooring' | 'partition' | 'wall_covering';
  unit: string;
  /**
   * Quantité d'assiette couverte par une unité du matériau, **dans l'unité que
   * désigne `quantity_driver`** : m² de surface d'ouvrage, m² de parement, ou
   * mètre de trame. Un rail à 1 dit qu'un mètre de rail couvre un mètre de
   * lisse — l'identité, jusqu'à ce qu'un recouvrement d'emboîtement soit sourcé.
   */
  yield_per_unit: number;
  /** Absent = `work_surface`, comme le défaut de la colonne. */
  quantity_driver?: MaterialQuantityDriver;
  /**
   * E1-4 — la quantité de ce matériau est proportionnelle au `number_of_coats`
   * saisi par l'utilisateur. Vrai des seuls revêtements appliqués en couches
   * successives sur la surface (peintures, lasures, vernis).
   *
   * Absent = `false`, comme la valeur par défaut de la colonne
   * `materials_catalog.applies_coats` : un matériau ne se multiplie par les
   * couches que s'il le déclare. Les sous-couches et le fixateur de fond sont
   * volontairement à `false` — une impression s'applique en une passe, quel
   * que soit le nombre de couches de finition choisi.
   */
  applies_coats?: boolean;
  /**
   * E1-5 — loi de consommation en fonction de la géométrie du carreau posé.
   * Absent = aucune, `yield_per_unit` vaut tel quel.
   *
   * Quand elle est présente, `yield_per_unit` cesse d'être « le rendement » pour
   * devenir « le rendement **à la géométrie de référence du modèle** »
   * (`estimations/tile-consumption.ts`) : 45 × 45 cm au sol en double encollage
   * pour `tile_adhesive`, 45 × 45 cm d'épaisseur 9 mm à joint de 3 mm pour
   * `tile_grout`. Deux valeurs de ce champ ne sont donc comparables entre elles
   * que parce qu'elles sont exprimées à la même référence — c'est ce qui rend
   * lisible que les quatre mortiers-colle consomment la même chose à format
   * égal, et que ce qui les distingue est le format sur lequel on les pose.
   */
  consumption_model?: TileConsumptionModel;
  /**
   * E1-6 — dimensions du rouleau dans lequel le matériau se débite, en cm.
   * Absentes = le matériau ne se pose pas en lés, `yield_per_unit` vaut tel
   * quel. Présentes, elles **remplacent** `yield_per_unit` : la quantité vient
   * de la découpe (`estimations/wallpaper-strips.ts`), qui dépend de la hauteur
   * sous plafond, du raccord et de la longueur des pans — ce qu'un rendement au
   * mètre carré ne peut pas porter.
   *
   * Le conditionnement d'un matériau qui les déclare doit valoir exactement
   * `roll_width_cm × roll_length_cm` : c'est le même rouleau, décrit deux fois.
   */
  roll_width_cm?: number;
  roll_length_cm?: number;
  packagings: { label: string; quantity_per_unit: number; unit: string }[];
  waste_factors: {
    pose_type: string;
    skill_level: 'beginner' | 'intermediate' | 'expert';
    factor_percent: number;
  }[];
}

// ---------------------------------------------------------------------------
// Helper: standard paint packagings
// ---------------------------------------------------------------------------
const paintPkg = (): SeedMaterial['packagings'] => [
  { label: 'Pot 0.5 L', quantity_per_unit: 0.5, unit: 'L' },
  { label: 'Pot 2.5 L', quantity_per_unit: 2.5, unit: 'L' },
  { label: 'Pot 5 L', quantity_per_unit: 5, unit: 'L' },
  { label: 'Pot 10 L', quantity_per_unit: 10, unit: 'L' },
];

const paintWaste = (): SeedMaterial['waste_factors'] => [
  { pose_type: 'standard', skill_level: 'beginner', factor_percent: 15 },
  { pose_type: 'standard', skill_level: 'intermediate', factor_percent: 10 },
  { pose_type: 'standard', skill_level: 'expert', factor_percent: 5 },
];

const accessoryWaste = (): SeedMaterial['waste_factors'] => [
  { pose_type: 'standard', skill_level: 'beginner', factor_percent: 10 },
  { pose_type: 'standard', skill_level: 'intermediate', factor_percent: 5 },
  { pose_type: 'standard', skill_level: 'expert', factor_percent: 2 },
];

const tileStraightWaste = (): SeedMaterial['waste_factors'] => [
  { pose_type: 'straight', skill_level: 'beginner', factor_percent: 15 },
  { pose_type: 'straight', skill_level: 'intermediate', factor_percent: 10 },
  { pose_type: 'straight', skill_level: 'expert', factor_percent: 5 },
];

const tileDiagonalWaste = (): SeedMaterial['waste_factors'] => [
  { pose_type: 'diagonal', skill_level: 'beginner', factor_percent: 20 },
  { pose_type: 'diagonal', skill_level: 'intermediate', factor_percent: 15 },
  { pose_type: 'diagonal', skill_level: 'expert', factor_percent: 10 },
];

const tileWaste = (): SeedMaterial['waste_factors'] => [
  ...tileStraightWaste(),
  ...tileDiagonalWaste(),
];

const floorStandardWaste = (): SeedMaterial['waste_factors'] => [
  { pose_type: 'standard', skill_level: 'beginner', factor_percent: 10 },
  { pose_type: 'standard', skill_level: 'intermediate', factor_percent: 7 },
  { pose_type: 'standard', skill_level: 'expert', factor_percent: 5 },
];

const floorDiagonalWaste = (): SeedMaterial['waste_factors'] => [
  { pose_type: 'diagonal', skill_level: 'beginner', factor_percent: 15 },
  { pose_type: 'diagonal', skill_level: 'intermediate', factor_percent: 10 },
  { pose_type: 'diagonal', skill_level: 'expert', factor_percent: 7 },
];

const floorWaste = (): SeedMaterial['waste_factors'] => [
  ...floorStandardWaste(),
  ...floorDiagonalWaste(),
];

const partitionWaste = (): SeedMaterial['waste_factors'] => [
  { pose_type: 'standard', skill_level: 'beginner', factor_percent: 12 },
  { pose_type: 'standard', skill_level: 'intermediate', factor_percent: 8 },
  { pose_type: 'standard', skill_level: 'expert', factor_percent: 4 },
];

/**
 * E1-6 — le rouleau de papier peint standard européen, 10,05 m × 0,53 m.
 *
 * Bricoflor : « Un rouleau de papier peint de taille standard en Europe présente
 * une longueur de 10,05 mètres. La largeur de lés est de 0,53 m. »
 *
 * Les dimensions et le conditionnement se déclarent **ensemble**, par cet objet,
 * parce qu'ils décrivent le même rouleau : le conditionnement vaut exactement
 * `0,53 × 10,05 = 5,3265 m²`. Les 5,3 m² arrondis d'avant ce lot faisaient
 * racheter un rouleau dès qu'un besoin tombait sur un compte entier — le séjour
 * en L de référence, qui demande exactement 12 rouleaux, en achetait 13.
 */
const standardWallpaperRoll = (): Pick<
  SeedMaterial,
  'roll_width_cm' | 'roll_length_cm' | 'packagings'
> => ({
  roll_width_cm: 53,
  roll_length_cm: 1005,
  packagings: [
    {
      label: 'Rouleau 10.05m x 0.53m (5.33 m²)',
      quantity_per_unit: 5.3265,
      unit: 'm2',
    },
  ],
});

const wallCoveringPlainWaste = (): SeedMaterial['waste_factors'] => [
  { pose_type: 'plain', skill_level: 'beginner', factor_percent: 10 },
  { pose_type: 'plain', skill_level: 'intermediate', factor_percent: 7 },
  { pose_type: 'plain', skill_level: 'expert', factor_percent: 3 },
];

const wallCoveringPatternedWaste = (): SeedMaterial['waste_factors'] => [
  { pose_type: 'patterned', skill_level: 'beginner', factor_percent: 18 },
  { pose_type: 'patterned', skill_level: 'intermediate', factor_percent: 12 },
  { pose_type: 'patterned', skill_level: 'expert', factor_percent: 7 },
];

const wallCoveringWaste = (): SeedMaterial['waste_factors'] => [
  ...wallCoveringPlainWaste(),
  ...wallCoveringPatternedWaste(),
];

// ---------------------------------------------------------------------------
// PAINTING (~50 materials)
// ---------------------------------------------------------------------------
export const paintingMaterials: SeedMaterial[] = [
  // Interior wall paints
  {
    name: 'Peinture acrylique mate',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 11,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture acrylique satinée',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 11,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture acrylique velours',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 10,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture glycéro satinée',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 12,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture glycéro brillante',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 12,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  // Ceiling paints
  {
    name: 'Peinture plafond mate',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 10,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture plafond anti-traces',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 10,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  // Primers / Undercoats
  {
    name: 'Sous-couche universelle',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 10,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Sous-couche plâtre',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 10,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Sous-couche bois',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 11,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Sous-couche carrelage',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 10,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Fixateur de fond',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 12,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  // Specialty paints
  {
    name: 'Peinture cuisine et salle de bain',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 10,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture anti-humidité',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 8,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture laque',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 10,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture tableau noir',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 8,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture magnétique',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 8,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  // Accessories
  {
    name: 'Rouleau laqueur 180mm',
    category: 'painting',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Rouleau méché 180mm',
    category: 'painting',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Rouleau mousse 110mm',
    category: 'painting',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Pinceau plat 50mm',
    category: 'painting',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Pinceau plat 75mm',
    category: 'painting',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Pinceau à rechampir 25mm',
    category: 'painting',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Bac à peinture',
    category: 'painting',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: "Grille d'essorage",
    category: 'painting',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Ruban de masquage 50m',
    category: 'painting',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Rouleau', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Bâche de protection 4x5m',
    category: 'painting',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Mélangeur',
    category: 'painting',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Perche télescopique 1.2-2.4m',
    category: 'painting',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  // More paints
  {
    name: 'Peinture fer antirouille',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 10,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture radiateur',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 10,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture sol garage',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 8,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture boiseries',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 11,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture façade',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 8,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Enduit de lissage',
    category: 'painting',
    unit: 'kg',
    yield_per_unit: 0.8,
    packagings: [
      { label: 'Seau 5 kg', quantity_per_unit: 5, unit: 'kg' },
      { label: 'Seau 15 kg', quantity_per_unit: 15, unit: 'kg' },
    ],
    waste_factors: paintWaste(),
  },
  {
    name: 'Enduit de rebouchage',
    category: 'painting',
    unit: 'kg',
    yield_per_unit: 2,
    packagings: [
      { label: 'Tube 330g', quantity_per_unit: 0.33, unit: 'kg' },
      { label: 'Seau 1.5 kg', quantity_per_unit: 1.5, unit: 'kg' },
      { label: 'Seau 5 kg', quantity_per_unit: 5, unit: 'kg' },
    ],
    waste_factors: paintWaste(),
  },
  {
    name: 'Papier abrasif grain 120',
    category: 'painting',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [
      { label: 'Lot de 10 feuilles', quantity_per_unit: 10, unit: 'unit' },
    ],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Papier abrasif grain 80',
    category: 'painting',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [
      { label: 'Lot de 10 feuilles', quantity_per_unit: 10, unit: 'unit' },
    ],
    waste_factors: accessoryWaste(),
  },
  // Extra painting materials to reach ~50
  {
    name: 'Peinture acrylique brillante',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 11,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture acrylique extra-mate',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 10,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture glycéro mate',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 12,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture effet béton ciré',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 6,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture effet sablé',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 6,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Lasure bois intérieur',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 10,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Lasure bois extérieur',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 8,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Vernis bois incolore mat',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 12,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Vernis bois incolore satiné',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 12,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture multi-supports',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 10,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture aérosol multi-usage 400ml',
    category: 'painting',
    unit: 'unit',
    yield_per_unit: 2,
    applies_coats: true,
    packagings: [{ label: 'Bombe 400 ml', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: paintWaste(),
  },
  {
    name: 'Décapant peinture gel',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 3,
    packagings: [
      { label: 'Pot 1 L', quantity_per_unit: 1, unit: 'L' },
      { label: 'Pot 2.5 L', quantity_per_unit: 2.5, unit: 'L' },
    ],
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture alkyde émulsion satinée',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 11,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture alkyde émulsion mate',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 11,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'Peinture époxy sol',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 7,
    applies_coats: true,
    packagings: paintPkg(),
    waste_factors: paintWaste(),
  },
  {
    name: 'White spirit 1L',
    category: 'painting',
    unit: 'L',
    yield_per_unit: 1,
    packagings: [{ label: 'Bidon 1 L', quantity_per_unit: 1, unit: 'L' }],
    waste_factors: accessoryWaste(),
  },
];

// ---------------------------------------------------------------------------
// TILING (~50 materials)
// ---------------------------------------------------------------------------
export const tilingMaterials: SeedMaterial[] = [
  // Floor tiles
  {
    name: 'Carrelage sol 20x20 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Boîte 1 m²', quantity_per_unit: 1, unit: 'm2' },
      { label: 'Boîte 1.5 m²', quantity_per_unit: 1.5, unit: 'm2' },
    ],
    waste_factors: tileWaste(),
  },
  {
    name: 'Carrelage sol 30x30 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Boîte 1 m²', quantity_per_unit: 1, unit: 'm2' },
      { label: 'Boîte 1.5 m²', quantity_per_unit: 1.5, unit: 'm2' },
    ],
    waste_factors: tileWaste(),
  },
  {
    name: 'Carrelage sol 45x45 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Boîte 1 m²', quantity_per_unit: 1, unit: 'm2' },
      { label: 'Boîte 1.5 m²', quantity_per_unit: 1.5, unit: 'm2' },
    ],
    waste_factors: tileWaste(),
  },
  {
    name: 'Carrelage sol 60x60 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Boîte 1.08 m²', quantity_per_unit: 1.08, unit: 'm2' },
      { label: 'Boîte 1.44 m²', quantity_per_unit: 1.44, unit: 'm2' },
    ],
    waste_factors: tileWaste(),
  },
  {
    name: 'Carrelage sol 30x60 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Boîte 1.08 m²', quantity_per_unit: 1.08, unit: 'm2' },
      { label: 'Boîte 1.44 m²', quantity_per_unit: 1.44, unit: 'm2' },
    ],
    waste_factors: tileWaste(),
  },
  // Wall tiles
  {
    name: 'Carrelage mural 10x10 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 1 m²', quantity_per_unit: 1, unit: 'm2' }],
    waste_factors: tileWaste(),
  },
  {
    name: 'Carrelage mural 15x15 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 1 m²', quantity_per_unit: 1, unit: 'm2' }],
    waste_factors: tileWaste(),
  },
  {
    name: 'Carrelage mural 20x20 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 1 m²', quantity_per_unit: 1, unit: 'm2' }],
    waste_factors: tileWaste(),
  },
  {
    name: 'Carrelage mural 20x40 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 1 m²', quantity_per_unit: 1, unit: 'm2' }],
    waste_factors: tileWaste(),
  },
  {
    name: 'Carrelage mural 30x60 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Boîte 1.08 m²', quantity_per_unit: 1.08, unit: 'm2' },
    ],
    waste_factors: tileWaste(),
  },
  {
    name: 'Mosaïque 30x30 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Plaque 0.09 m²', quantity_per_unit: 0.09, unit: 'm2' },
    ],
    waste_factors: tileWaste(),
  },
  {
    name: 'Faïence murale 25x40 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 1 m²', quantity_per_unit: 1, unit: 'm2' }],
    waste_factors: tileWaste(),
  },
  // Adhesives
  //
  // E1-5 — les quatre mortiers portent le **même** rendement, et ce n'est pas
  // un oubli : les tables de consommation de Cermix sont identiques d'une
  // classe à l'autre (CERMICOL EXTRA C1 E, CERMIPLUS 2.0 C2, CERMIPLUS RAPID,
  // CERMIFLEX C2S1 ET). Aucune fiche lue ne fait dépendre la consommation de la
  // classe de colle : elle dépend du peigne, que le format du carreau
  // sélectionne. 0,14 = 7,14 kg/m², la cellule « 1 200 < S ≤ 2 200 cm², sol
  // intérieur : 7 (U9) » où tombe le 45 × 45 de référence, double encollage
  // imposé par le NF DTU 52.2 au-delà de 1 200 cm².
  //
  // C'est ce qui corrige l'inversion du « grand format » : il ne consommait pas
  // moins que le C2 parce qu'il est meilleur, il était simplement mal seedé. Ce
  // qui le fait consommer plus, c'est le 60 × 60 sur lequel on le pose — 8 kg/m²
  // (E10) contre 7 — et cela, c'est le moteur qui le calcule désormais.
  {
    name: 'Mortier-colle standard (C1)',
    category: 'tiling',
    unit: 'kg',
    yield_per_unit: 0.14,
    consumption_model: 'tile_adhesive',
    packagings: [{ label: 'Sac 25 kg', quantity_per_unit: 25, unit: 'kg' }],
    waste_factors: tileWaste(),
  },
  {
    name: 'Mortier-colle flexible (C2)',
    category: 'tiling',
    unit: 'kg',
    yield_per_unit: 0.14,
    consumption_model: 'tile_adhesive',
    packagings: [{ label: 'Sac 25 kg', quantity_per_unit: 25, unit: 'kg' }],
    waste_factors: tileWaste(),
  },
  {
    name: 'Mortier-colle rapide (C2F)',
    category: 'tiling',
    unit: 'kg',
    yield_per_unit: 0.14,
    consumption_model: 'tile_adhesive',
    packagings: [{ label: 'Sac 25 kg', quantity_per_unit: 25, unit: 'kg' }],
    waste_factors: tileWaste(),
  },
  {
    name: 'Mortier-colle grand format (C2S1)',
    category: 'tiling',
    unit: 'kg',
    yield_per_unit: 0.14,
    consumption_model: 'tile_adhesive',
    packagings: [{ label: 'Sac 25 kg', quantity_per_unit: 25, unit: 'kg' }],
    waste_factors: tileWaste(),
  },
  {
    name: "Colle en pâte prête à l'emploi",
    category: 'tiling',
    unit: 'kg',
    yield_per_unit: 0.22,
    packagings: [
      { label: 'Seau 7 kg', quantity_per_unit: 7, unit: 'kg' },
      { label: 'Seau 15 kg', quantity_per_unit: 15, unit: 'kg' },
    ],
    waste_factors: tileWaste(),
  },
  // Grout
  //
  // E1-5 — 5 = 0,200 kg/m², la cellule « 45 × 45 cm, joint 3 mm » de la table
  // CERMIJOINT COLOR, qui est aussi la géométrie de référence du modèle. La
  // constante de 0,25 kg/m² qui tenait lieu de rendement jusqu'ici ne
  // correspondait à aucune ligne de fiche, et surtout ne bougeait ni avec le
  // format ni avec la largeur de joint : elle valait +25 % sur un 45 × 45 à
  // 3 mm et −63 % sur un 20 × 20 à 5 mm.
  //
  // `Joint large 5-20mm` et `Joint époxy` restent **non marqués et inchangés** :
  // aucun ouvrage V1 ne les sert, et leur coefficient de densité n'a pas pu être
  // lu sur une fiche fabricant dans cette session. Les marquer sans avoir lu
  // leur référence reviendrait à faire dire à leur rendement une géométrie qui
  // n'est pas la sienne. Cf. docs/SOURCES_CATALOGUE.md.
  {
    name: 'Joint fin 1-6mm',
    category: 'tiling',
    unit: 'kg',
    yield_per_unit: 5,
    consumption_model: 'tile_grout',
    packagings: [
      { label: 'Sac 5 kg', quantity_per_unit: 5, unit: 'kg' },
      { label: 'Sac 10 kg', quantity_per_unit: 10, unit: 'kg' },
    ],
    waste_factors: tileWaste(),
  },
  {
    name: 'Joint large 5-20mm',
    category: 'tiling',
    unit: 'kg',
    yield_per_unit: 1,
    packagings: [
      { label: 'Sac 5 kg', quantity_per_unit: 5, unit: 'kg' },
      { label: 'Sac 10 kg', quantity_per_unit: 10, unit: 'kg' },
    ],
    waste_factors: tileWaste(),
  },
  {
    name: 'Joint époxy',
    category: 'tiling',
    unit: 'kg',
    yield_per_unit: 0.8,
    packagings: [
      { label: 'Seau 2.5 kg', quantity_per_unit: 2.5, unit: 'kg' },
      { label: 'Seau 5 kg', quantity_per_unit: 5, unit: 'kg' },
    ],
    waste_factors: tileWaste(),
  },
  {
    name: 'Joint souple silicone',
    category: 'tiling',
    unit: 'unit',
    yield_per_unit: 6,
    packagings: [
      { label: 'Cartouche 300 ml', quantity_per_unit: 1, unit: 'unit' },
    ],
    waste_factors: tileWaste(),
  },
  // Accessories
  {
    name: 'Croisillons 2mm (x200)',
    category: 'tiling',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [
      { label: 'Sachet 200 pcs', quantity_per_unit: 1, unit: 'unit' },
    ],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Croisillons 3mm (x200)',
    category: 'tiling',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [
      { label: 'Sachet 200 pcs', quantity_per_unit: 1, unit: 'unit' },
    ],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Croisillons 5mm (x100)',
    category: 'tiling',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [
      { label: 'Sachet 100 pcs', quantity_per_unit: 1, unit: 'unit' },
    ],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Système de nivelage (kit 100)',
    category: 'tiling',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Kit 100 pcs', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Profilé de finition alu 2.5m',
    category: 'tiling',
    unit: 'm',
    yield_per_unit: 1,
    packagings: [{ label: 'Barre 2.5 m', quantity_per_unit: 2.5, unit: 'm' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: "Profilé d'angle rentrant 2.5m",
    category: 'tiling',
    unit: 'm',
    yield_per_unit: 1,
    packagings: [{ label: 'Barre 2.5 m', quantity_per_unit: 2.5, unit: 'm' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Coupe-carreaux manuel 600mm',
    category: 'tiling',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Éponge de carreleur',
    category: 'tiling',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Baguette de finition PVC 2.5m',
    category: 'tiling',
    unit: 'm',
    yield_per_unit: 1,
    packagings: [{ label: 'Barre 2.5 m', quantity_per_unit: 2.5, unit: 'm' }],
    waste_factors: accessoryWaste(),
  },
  // Waterproofing
  {
    name: "SEL (Système d'Étanchéité Liquide)",
    category: 'tiling',
    unit: 'L',
    yield_per_unit: 0.7,
    packagings: [
      { label: 'Bidon 6 L', quantity_per_unit: 6, unit: 'L' },
      { label: 'Bidon 12 L', quantity_per_unit: 12, unit: 'L' },
    ],
    waste_factors: tileWaste(),
  },
  {
    name: "Bande d'étanchéité 120mm",
    category: 'tiling',
    unit: 'm',
    yield_per_unit: 1,
    packagings: [
      { label: 'Rouleau 10 m', quantity_per_unit: 10, unit: 'm' },
      { label: 'Rouleau 50 m', quantity_per_unit: 50, unit: 'm' },
    ],
    waste_factors: tileWaste(),
  },
  {
    name: 'Natte de découplage',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Rouleau 5 m²', quantity_per_unit: 5, unit: 'm2' },
      { label: 'Rouleau 30 m²', quantity_per_unit: 30, unit: 'm2' },
    ],
    waste_factors: tileWaste(),
  },
  // More tiling
  {
    name: 'Carrelage imitation bois 20x120 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 1.2 m²', quantity_per_unit: 1.2, unit: 'm2' }],
    waste_factors: tileWaste(),
  },
  {
    name: 'Carrelage imitation pierre 60x60 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Boîte 1.08 m²', quantity_per_unit: 1.08, unit: 'm2' },
    ],
    waste_factors: tileWaste(),
  },
  {
    name: 'Carrelage extérieur antidérapant 30x30 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 1 m²', quantity_per_unit: 1, unit: 'm2' }],
    waste_factors: tileWaste(),
  },
  {
    name: 'Plinthe carrelage 8x30 cm',
    category: 'tiling',
    unit: 'm',
    yield_per_unit: 1,
    packagings: [{ label: 'Lot de 10 (3 m)', quantity_per_unit: 3, unit: 'm' }],
    waste_factors: tileWaste(),
  },
  {
    name: 'Carrelage hexagonal 20cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Boîte 0.98 m²', quantity_per_unit: 0.98, unit: 'm2' },
    ],
    waste_factors: tileWaste(),
  },
  // Extra tiling
  {
    name: "Primaire d'accrochage carrelage",
    category: 'tiling',
    unit: 'L',
    yield_per_unit: 5,
    packagings: [
      { label: 'Bidon 1 L', quantity_per_unit: 1, unit: 'L' },
      { label: 'Bidon 5 L', quantity_per_unit: 5, unit: 'L' },
    ],
    waste_factors: tileWaste(),
  },
  {
    name: 'Ragréage autolissant',
    category: 'tiling',
    unit: 'kg',
    yield_per_unit: 0.2,
    packagings: [{ label: 'Sac 25 kg', quantity_per_unit: 25, unit: 'kg' }],
    waste_factors: tileWaste(),
  },
  {
    name: 'Carrelage sol 80x80 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Boîte 1.28 m²', quantity_per_unit: 1.28, unit: 'm2' },
    ],
    waste_factors: tileWaste(),
  },
  {
    name: 'Carrelage métro 7.5x15 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 1 m²', quantity_per_unit: 1, unit: 'm2' }],
    waste_factors: tileWaste(),
  },
  {
    name: 'Croisillons auto-nivelants (x100)',
    category: 'tiling',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [
      { label: 'Sachet 100 pcs', quantity_per_unit: 1, unit: 'unit' },
    ],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Peigne à colle 6mm',
    category: 'tiling',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Peigne à colle 10mm',
    category: 'tiling',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Listel décoratif inox 2m',
    category: 'tiling',
    unit: 'm',
    yield_per_unit: 1,
    packagings: [{ label: 'Barre 2 m', quantity_per_unit: 2, unit: 'm' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Carrelage mural 10x30 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 1 m²', quantity_per_unit: 1, unit: 'm2' }],
    waste_factors: tileWaste(),
  },
  {
    name: 'Mortier de ragréage extérieur',
    category: 'tiling',
    unit: 'kg',
    yield_per_unit: 0.2,
    packagings: [{ label: 'Sac 25 kg', quantity_per_unit: 25, unit: 'kg' }],
    waste_factors: tileWaste(),
  },
];

// ---------------------------------------------------------------------------
// FLOORING (~40 materials)
// ---------------------------------------------------------------------------
export const flooringMaterials: SeedMaterial[] = [
  // Laminate
  {
    name: 'Stratifié 7mm AC3',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 2.47 m²', quantity_per_unit: 2.47, unit: 'm2' },
    ],
    waste_factors: floorWaste(),
  },
  {
    name: 'Stratifié 8mm AC4',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 2.49 m²', quantity_per_unit: 2.49, unit: 'm2' },
    ],
    waste_factors: floorWaste(),
  },
  {
    name: 'Stratifié 10mm AC4',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 2.22 m²', quantity_per_unit: 2.22, unit: 'm2' },
    ],
    waste_factors: floorWaste(),
  },
  {
    name: 'Stratifié 12mm AC5',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 1.48 m²', quantity_per_unit: 1.48, unit: 'm2' },
    ],
    waste_factors: floorWaste(),
  },
  // Engineered parquet
  {
    name: 'Parquet contrecollé chêne 14mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 1.58 m²', quantity_per_unit: 1.58, unit: 'm2' },
    ],
    waste_factors: floorWaste(),
  },
  {
    name: 'Parquet contrecollé chêne 10mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 2.03 m²', quantity_per_unit: 2.03, unit: 'm2' },
    ],
    waste_factors: floorWaste(),
  },
  {
    name: 'Parquet massif chêne 22mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 1.17 m²', quantity_per_unit: 1.17, unit: 'm2' },
    ],
    waste_factors: floorWaste(),
  },
  {
    name: 'Parquet bambou 15mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 1.83 m²', quantity_per_unit: 1.83, unit: 'm2' },
    ],
    waste_factors: floorWaste(),
  },
  // Vinyl / LVT
  {
    name: 'Lame vinyle clipsable 4mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 2.12 m²', quantity_per_unit: 2.12, unit: 'm2' },
    ],
    waste_factors: floorWaste(),
  },
  {
    name: 'Lame vinyle clipsable 5mm SPC',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 2.22 m²', quantity_per_unit: 2.22, unit: 'm2' },
    ],
    waste_factors: floorWaste(),
  },
  {
    name: 'Lame vinyle à coller 2.5mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 3.34 m²', quantity_per_unit: 3.34, unit: 'm2' },
    ],
    waste_factors: floorWaste(),
  },
  {
    name: 'Dalle vinyle 60x60 cm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Boîte 2.16 m²', quantity_per_unit: 2.16, unit: 'm2' },
    ],
    waste_factors: floorWaste(),
  },
  {
    name: 'Sol PVC en rouleau',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Rouleau (au m²)', quantity_per_unit: 1, unit: 'm2' },
    ],
    waste_factors: floorWaste(),
  },
  // Underlay
  {
    name: 'Sous-couche mousse 2mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Rouleau 15 m²', quantity_per_unit: 15, unit: 'm2' }],
    waste_factors: floorStandardWaste(),
  },
  {
    name: 'Sous-couche mousse 3mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Rouleau 15 m²', quantity_per_unit: 15, unit: 'm2' }],
    waste_factors: floorStandardWaste(),
  },
  {
    name: 'Sous-couche liège 2mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Rouleau 10 m²', quantity_per_unit: 10, unit: 'm2' }],
    waste_factors: floorStandardWaste(),
  },
  {
    name: 'Sous-couche acoustique 5mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Rouleau 10 m²', quantity_per_unit: 10, unit: 'm2' }],
    waste_factors: floorStandardWaste(),
  },
  {
    name: 'Film pare-vapeur PE',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 0.8,
    packagings: [{ label: 'Rouleau 20 m²', quantity_per_unit: 20, unit: 'm2' }],
    waste_factors: floorStandardWaste(),
  },
  // Skirting & transitions
  {
    name: 'Plinthe MDF 60mm 2.4m',
    category: 'flooring',
    unit: 'm',
    yield_per_unit: 1,
    packagings: [{ label: 'Barre 2.4 m', quantity_per_unit: 2.4, unit: 'm' }],
    waste_factors: floorStandardWaste(),
  },
  {
    name: 'Plinthe MDF 80mm 2.4m',
    category: 'flooring',
    unit: 'm',
    yield_per_unit: 1,
    packagings: [{ label: 'Barre 2.4 m', quantity_per_unit: 2.4, unit: 'm' }],
    waste_factors: floorStandardWaste(),
  },
  {
    name: 'Plinthe chêne 70mm 2.4m',
    category: 'flooring',
    unit: 'm',
    yield_per_unit: 1,
    packagings: [{ label: 'Barre 2.4 m', quantity_per_unit: 2.4, unit: 'm' }],
    waste_factors: floorStandardWaste(),
  },
  {
    name: 'Barre de seuil alu 93cm',
    category: 'flooring',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Barre de seuil alu 180cm',
    category: 'flooring',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Profilé de jonction 2.7m',
    category: 'flooring',
    unit: 'm',
    yield_per_unit: 1,
    packagings: [{ label: 'Barre 2.7 m', quantity_per_unit: 2.7, unit: 'm' }],
    waste_factors: floorStandardWaste(),
  },
  {
    name: 'Coins de plinthe',
    category: 'flooring',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Lot de 2', quantity_per_unit: 2, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Clips de plinthe (x20)',
    category: 'flooring',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [
      { label: 'Sachet 20 pcs', quantity_per_unit: 1, unit: 'unit' },
    ],
    waste_factors: accessoryWaste(),
  },
  // Adhesive / clips
  {
    name: 'Colle parquet',
    category: 'flooring',
    unit: 'kg',
    yield_per_unit: 0.9,
    packagings: [
      { label: 'Seau 7 kg', quantity_per_unit: 7, unit: 'kg' },
      { label: 'Seau 15 kg', quantity_per_unit: 15, unit: 'kg' },
    ],
    waste_factors: floorStandardWaste(),
  },
  {
    name: 'Kit de pose stratifié (cale+tire-lame+maillet)',
    category: 'flooring',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Kit', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  // More flooring
  {
    name: 'Parquet pin 22mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 1.36 m²', quantity_per_unit: 1.36, unit: 'm2' },
    ],
    waste_factors: floorWaste(),
  },
  {
    name: 'Sous-couche fibre de bois 5mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Paquet 7 m²', quantity_per_unit: 7, unit: 'm2' }],
    waste_factors: floorStandardWaste(),
  },
  {
    name: 'Ruban adhésif pare-vapeur',
    category: 'flooring',
    unit: 'm',
    yield_per_unit: 1,
    packagings: [{ label: 'Rouleau 50 m', quantity_per_unit: 50, unit: 'm' }],
    waste_factors: accessoryWaste(),
  },
  // Extra flooring
  {
    name: 'Colle vinyle',
    category: 'flooring',
    unit: 'kg',
    yield_per_unit: 3,
    packagings: [
      { label: 'Seau 6 kg', quantity_per_unit: 6, unit: 'kg' },
      { label: 'Seau 12 kg', quantity_per_unit: 12, unit: 'kg' },
    ],
    waste_factors: floorStandardWaste(),
  },
  {
    name: 'Moquette aiguilletée',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Rouleau (au m²)', quantity_per_unit: 1, unit: 'm2' },
    ],
    waste_factors: floorWaste(),
  },
  {
    name: 'Jonc de mer',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Rouleau (au m²)', quantity_per_unit: 1, unit: 'm2' },
    ],
    waste_factors: floorWaste(),
  },
  {
    name: 'Sisal naturel',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Rouleau (au m²)', quantity_per_unit: 1, unit: 'm2' },
    ],
    waste_factors: floorWaste(),
  },
  {
    name: 'Bande de seuil adhésive',
    category: 'flooring',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Ragréage fibré sol',
    category: 'flooring',
    unit: 'kg',
    yield_per_unit: 0.2,
    packagings: [{ label: 'Sac 25 kg', quantity_per_unit: 25, unit: 'kg' }],
    waste_factors: floorStandardWaste(),
  },
  {
    name: "Primaire d'accrochage sol",
    category: 'flooring',
    unit: 'L',
    yield_per_unit: 5,
    packagings: [
      { label: 'Bidon 1 L', quantity_per_unit: 1, unit: 'L' },
      { label: 'Bidon 5 L', quantity_per_unit: 5, unit: 'L' },
    ],
    waste_factors: floorStandardWaste(),
  },
  {
    name: 'Lame PVC adhésive',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 2.08 m²', quantity_per_unit: 2.08, unit: 'm2' },
    ],
    waste_factors: floorWaste(),
  },
  {
    name: 'Cale de dilatation (x40)',
    category: 'flooring',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [
      { label: 'Sachet 40 pcs', quantity_per_unit: 1, unit: 'unit' },
    ],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Scotch double face moquette',
    category: 'flooring',
    unit: 'm',
    yield_per_unit: 1,
    packagings: [{ label: 'Rouleau 25 m', quantity_per_unit: 25, unit: 'm' }],
    waste_factors: accessoryWaste(),
  },
];

// ---------------------------------------------------------------------------
// PARTITION / DRYWALL (~30 materials)
// ---------------------------------------------------------------------------
export const partitionMaterials: SeedMaterial[] = [
  // Plasterboard
  {
    name: 'Plaque BA13 standard 2.5x1.2m',
    category: 'partition',
    unit: 'm2',
    // 2,10 m² par m² d'ouvrage à deux faces (fiche Placo 72/48) = 1,05 m² par
    // m² de parement — c'est cette dernière que le rendement exprime depuis
    // E1-3, le nombre de faces étant désormais porté par l'assiette.
    yield_per_unit: 0.96,
    quantity_driver: 'clad_faces',
    packagings: [{ label: 'Plaque (3 m²)', quantity_per_unit: 3, unit: 'm2' }],
    waste_factors: partitionWaste(),
  },
  {
    name: 'Plaque BA13 hydro 2.5x1.2m',
    category: 'partition',
    unit: 'm2',
    yield_per_unit: 0.96,
    quantity_driver: 'clad_faces',
    packagings: [{ label: 'Plaque (3 m²)', quantity_per_unit: 3, unit: 'm2' }],
    waste_factors: partitionWaste(),
  },
  {
    name: 'Plaque BA13 feu 2.5x1.2m',
    category: 'partition',
    unit: 'm2',
    yield_per_unit: 1,
    quantity_driver: 'clad_faces',
    packagings: [{ label: 'Plaque (3 m²)', quantity_per_unit: 3, unit: 'm2' }],
    waste_factors: partitionWaste(),
  },
  {
    name: 'Plaque BA10 standard 2.5x1.2m',
    category: 'partition',
    unit: 'm2',
    yield_per_unit: 1,
    quantity_driver: 'clad_faces',
    packagings: [{ label: 'Plaque (3 m²)', quantity_per_unit: 3, unit: 'm2' }],
    waste_factors: partitionWaste(),
  },
  {
    name: 'Plaque BA18 standard 2.5x1.2m',
    category: 'partition',
    unit: 'm2',
    yield_per_unit: 1,
    quantity_driver: 'clad_faces',
    packagings: [{ label: 'Plaque (3 m²)', quantity_per_unit: 3, unit: 'm2' }],
    waste_factors: partitionWaste(),
  },
  {
    name: 'Plaque placo phonique 2.5x1.2m',
    category: 'partition',
    unit: 'm2',
    yield_per_unit: 1,
    quantity_driver: 'clad_faces',
    packagings: [{ label: 'Plaque (3 m²)', quantity_per_unit: 3, unit: 'm2' }],
    waste_factors: partitionWaste(),
  },
  // Metal studs
  {
    name: 'Rail R48 3m',
    category: 'partition',
    unit: 'm',
    // Un mètre de rail couvre un mètre de lisse. La fiche Placo donnait
    // 0,90 m/m² de cloison, un ratio qui n'a de sens qu'à une hauteur donnée —
    // depuis E1-3 la lisse est métrée sur le linéaire réel de l'ouvrage.
    yield_per_unit: 1,
    quantity_driver: 'frame_runner',
    packagings: [{ label: 'Barre 3 m', quantity_per_unit: 3, unit: 'm' }],
    waste_factors: partitionWaste(),
  },
  {
    name: 'Rail R70 3m',
    category: 'partition',
    unit: 'm',
    yield_per_unit: 1,
    quantity_driver: 'frame_runner',
    packagings: [{ label: 'Barre 3 m', quantity_per_unit: 3, unit: 'm' }],
    waste_factors: partitionWaste(),
  },
  {
    name: 'Rail R90 3m',
    category: 'partition',
    unit: 'm',
    yield_per_unit: 1,
    quantity_driver: 'frame_runner',
    packagings: [{ label: 'Barre 3 m', quantity_per_unit: 3, unit: 'm' }],
    waste_factors: partitionWaste(),
  },
  {
    name: 'Montant M48 2.7m',
    category: 'partition',
    unit: 'm',
    // Un mètre de montant couvre un mètre de trame. Les 2,10 m/m² de la fiche
    // Placo étaient l'entraxe 0,60 replié sur une surface : le nombre de
    // montants se compte désormais sur la longueur, et leur longueur sur la
    // hauteur (`work_types.frame_spec`).
    yield_per_unit: 1,
    quantity_driver: 'frame_stud',
    packagings: [{ label: 'Barre 2.7 m', quantity_per_unit: 2.7, unit: 'm' }],
    waste_factors: partitionWaste(),
  },
  {
    name: 'Montant M70 2.7m',
    category: 'partition',
    unit: 'm',
    yield_per_unit: 1,
    quantity_driver: 'frame_stud',
    packagings: [{ label: 'Barre 2.7 m', quantity_per_unit: 2.7, unit: 'm' }],
    waste_factors: partitionWaste(),
  },
  {
    name: 'Montant M90 2.7m',
    category: 'partition',
    unit: 'm',
    yield_per_unit: 1,
    quantity_driver: 'frame_stud',
    packagings: [{ label: 'Barre 2.7 m', quantity_per_unit: 2.7, unit: 'm' }],
    waste_factors: partitionWaste(),
  },
  // Insulation
  {
    name: 'Laine de verre 45mm',
    category: 'partition',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Rouleau 9.6 m²', quantity_per_unit: 9.6, unit: 'm2' },
    ],
    waste_factors: partitionWaste(),
  },
  {
    name: 'Laine de verre 75mm',
    category: 'partition',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Rouleau 7.2 m²', quantity_per_unit: 7.2, unit: 'm2' },
    ],
    waste_factors: partitionWaste(),
  },
  {
    name: 'Laine de verre 100mm',
    category: 'partition',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Rouleau 6 m²', quantity_per_unit: 6, unit: 'm2' }],
    waste_factors: partitionWaste(),
  },
  {
    name: 'Laine de roche 45mm',
    category: 'partition',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Panneau (lot 5.4 m²)', quantity_per_unit: 5.4, unit: 'm2' },
    ],
    waste_factors: partitionWaste(),
  },
  {
    name: 'Laine de roche 75mm',
    category: 'partition',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Panneau (lot 4.32 m²)', quantity_per_unit: 4.32, unit: 'm2' },
    ],
    waste_factors: partitionWaste(),
  },
  // Joint & finishing
  {
    name: 'Bande à joint papier 23m',
    category: 'partition',
    unit: 'm',
    // 2,80 m par m² d'ouvrage à deux faces = 1,40 m par m² de parement.
    yield_per_unit: 0.72,
    quantity_driver: 'clad_faces',
    packagings: [{ label: 'Rouleau 23 m', quantity_per_unit: 23, unit: 'm' }],
    waste_factors: partitionWaste(),
  },
  {
    name: 'Bande armée fibre 45m',
    category: 'partition',
    unit: 'm',
    yield_per_unit: 1,
    quantity_driver: 'clad_faces',
    packagings: [{ label: 'Rouleau 45 m', quantity_per_unit: 45, unit: 'm' }],
    waste_factors: partitionWaste(),
  },
  {
    name: 'Enduit à joint poudre 5kg',
    category: 'partition',
    unit: 'kg',
    // 0,66 kg par m² d'ouvrage à deux faces = 0,33 kg par m² de parement.
    yield_per_unit: 3.04,
    quantity_driver: 'clad_faces',
    packagings: [
      { label: 'Sac 5 kg', quantity_per_unit: 5, unit: 'kg' },
      { label: 'Sac 25 kg', quantity_per_unit: 25, unit: 'kg' },
    ],
    waste_factors: partitionWaste(),
  },
  {
    name: 'Enduit à joint prêt 7kg',
    category: 'partition',
    unit: 'kg',
    // 1 kg par m² d'ouvrage à deux faces = 0,50 kg par m² de parement, dans la
    // plage des fiches (Placomix 0,47 kg/m² de parement, Siniat 0,40-0,45).
    yield_per_unit: 2,
    quantity_driver: 'clad_faces',
    packagings: [
      { label: 'Seau 7 kg', quantity_per_unit: 7, unit: 'kg' },
      { label: 'Seau 20 kg', quantity_per_unit: 20, unit: 'kg' },
    ],
    waste_factors: partitionWaste(),
  },
  {
    name: 'Enduit de finition placo',
    category: 'partition',
    unit: 'kg',
    yield_per_unit: 1.5,
    quantity_driver: 'clad_faces',
    packagings: [{ label: 'Seau 7 kg', quantity_per_unit: 7, unit: 'kg' }],
    waste_factors: partitionWaste(),
  },
  {
    name: 'Calicot adhésif 50m',
    category: 'partition',
    unit: 'm',
    yield_per_unit: 1,
    quantity_driver: 'clad_faces',
    packagings: [{ label: 'Rouleau 50 m', quantity_per_unit: 50, unit: 'm' }],
    waste_factors: partitionWaste(),
  },
  // Fixings
  {
    name: 'Vis placo 25mm (x500)',
    category: 'partition',
    unit: 'unit',
    // 22 vis par m² d'ouvrage à deux faces = 11 par m² de parement, en boîtes
    // de 500 → 500 ÷ 11 ≈ 45,4 m² de parement par boîte.
    yield_per_unit: 45.4,
    quantity_driver: 'clad_faces',
    packagings: [
      { label: 'Boîte 500 pcs', quantity_per_unit: 1, unit: 'unit' },
    ],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Vis placo 35mm (x500)',
    category: 'partition',
    unit: 'unit',
    yield_per_unit: 1,
    quantity_driver: 'clad_faces',
    packagings: [
      { label: 'Boîte 500 pcs', quantity_per_unit: 1, unit: 'unit' },
    ],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Vis placo 45mm (x250)',
    category: 'partition',
    unit: 'unit',
    yield_per_unit: 1,
    quantity_driver: 'clad_faces',
    packagings: [
      { label: 'Boîte 250 pcs', quantity_per_unit: 1, unit: 'unit' },
    ],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Cheville Molly M4',
    category: 'partition',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [
      { label: 'Boîte 100 pcs', quantity_per_unit: 100, unit: 'unit' },
    ],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Cheville Molly M6',
    category: 'partition',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [
      { label: 'Boîte 100 pcs', quantity_per_unit: 100, unit: 'unit' },
    ],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Fixation fourrure',
    category: 'partition',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [
      { label: 'Boîte 50 pcs', quantity_per_unit: 50, unit: 'unit' },
    ],
    waste_factors: accessoryWaste(),
  },
  // More partition
  {
    name: 'Fourrure F530 3m',
    category: 'partition',
    unit: 'm',
    yield_per_unit: 1,
    // Une fourrure est un montant de doublage : posée à l'entraxe, sur la
    // hauteur. Même assiette que les montants.
    quantity_driver: 'frame_stud',
    packagings: [{ label: 'Barre 3 m', quantity_per_unit: 3, unit: 'm' }],
    waste_factors: partitionWaste(),
  },
  {
    name: 'Suspente',
    category: 'partition',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [
      { label: 'Boîte 50 pcs', quantity_per_unit: 50, unit: 'unit' },
    ],
    waste_factors: accessoryWaste(),
  },
  {
    name: "Cornière de protection d'angle 2.5m",
    category: 'partition',
    unit: 'm',
    yield_per_unit: 1,
    packagings: [{ label: 'Barre 2.5 m', quantity_per_unit: 2.5, unit: 'm' }],
    waste_factors: partitionWaste(),
  },
];

// ---------------------------------------------------------------------------
// WALL COVERING (~30 materials)
// ---------------------------------------------------------------------------
export const wallCoveringMaterials: SeedMaterial[] = [
  // Wallpaper
  {
    name: 'Papier peint intissé uni',
    category: 'wall_covering',
    unit: 'm2',
    // E1-6 : les cinq papiers peints ci-dessous ne lisent plus ce rendement —
    // leur quantité vient de la découpe en lés. Il reste à 1 parce que c'est la
    // valeur juste du seul énoncé qu'il porte encore, « 1 m² de papier couvre
    // 1 m² de papier », et parce que le registre en fait le contrat de la
    // colonne. Cf. `roll_width_cm` sur `materials_catalog`.
    yield_per_unit: 1,
    ...standardWallpaperRoll(),
    waste_factors: wallCoveringPlainWaste(),
  },
  {
    name: 'Papier peint intissé à motif',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    ...standardWallpaperRoll(),
    waste_factors: wallCoveringWaste(),
  },
  {
    name: 'Papier peint vinyle expansé',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    ...standardWallpaperRoll(),
    waste_factors: wallCoveringWaste(),
  },
  {
    name: 'Papier peint vinyle sur intissé',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    ...standardWallpaperRoll(),
    waste_factors: wallCoveringWaste(),
  },
  {
    name: 'Papier peint traditionnel',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    ...standardWallpaperRoll(),
    waste_factors: wallCoveringWaste(),
  },
  {
    // E1-6 : pas de dimensions de rouleau — un panoramique se vend en panneaux
    // calepinés sur le mur, pas en lés à débiter dans une bobine.
    name: 'Papier peint panoramique',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Panneau (variable)', quantity_per_unit: 3, unit: 'm2' },
    ],
    waste_factors: wallCoveringPatternedWaste(),
  },
  // Paste
  {
    name: 'Colle papier peint intissé',
    category: 'wall_covering',
    unit: 'kg',
    yield_per_unit: 8,
    packagings: [
      { label: 'Seau 5 kg', quantity_per_unit: 5, unit: 'kg' },
      { label: 'Seau 10 kg', quantity_per_unit: 10, unit: 'kg' },
    ],
    waste_factors: wallCoveringPlainWaste(),
  },
  {
    name: 'Colle papier peint vinyle',
    category: 'wall_covering',
    unit: 'kg',
    yield_per_unit: 30,
    packagings: [{ label: 'Seau 5 kg', quantity_per_unit: 5, unit: 'kg' }],
    waste_factors: wallCoveringPlainWaste(),
  },
  {
    name: 'Colle universelle papier peint',
    category: 'wall_covering',
    unit: 'kg',
    yield_per_unit: 30,
    packagings: [
      {
        label: 'Paquet 200g (pour 7 rouleaux)',
        quantity_per_unit: 0.2,
        unit: 'kg',
      },
      {
        label: 'Paquet 400g (pour 14 rouleaux)',
        quantity_per_unit: 0.4,
        unit: 'kg',
      },
    ],
    waste_factors: wallCoveringPlainWaste(),
  },
  {
    name: 'Colle papier peint renforcée (heavy)',
    category: 'wall_covering',
    unit: 'kg',
    yield_per_unit: 30,
    packagings: [{ label: 'Seau 5 kg', quantity_per_unit: 5, unit: 'kg' }],
    waste_factors: wallCoveringPlainWaste(),
  },
  // Lining paper
  {
    name: "Papier d'apprêt lisse",
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    // E1-6 : le conditionnement qui justifie que les dimensions soient une
    // propriété du matériau et non une constante du moteur — 10 × 0,50 m et non
    // 10,05 × 0,53 m. Le rendement d'un rouleau en lés n'a rien d'universel.
    roll_width_cm: 50,
    roll_length_cm: 1000,
    packagings: [
      { label: 'Rouleau 10m x 0.50m (5 m²)', quantity_per_unit: 5, unit: 'm2' },
    ],
    waste_factors: wallCoveringPlainWaste(),
  },
  {
    // E1-6 : pas de dimensions de rouleau. Les toiles et voiles de verre
    // offrent **deux longueurs de bobine** pour la même référence (25 et
    // 50 m²) : une dimension par matériau ne peut pas les décrire, et leur en
    // inventer une seule chiffrerait faux la moitié des achats. Ils restent au
    // calcul surfacique, ce qui est écrit au registre.
    name: 'Toile de verre maille',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Rouleau 25 m²', quantity_per_unit: 25, unit: 'm2' },
      { label: 'Rouleau 50 m²', quantity_per_unit: 50, unit: 'm2' },
    ],
    waste_factors: wallCoveringPlainWaste(),
  },
  {
    name: 'Toile de verre chevron',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Rouleau 25 m²', quantity_per_unit: 25, unit: 'm2' }],
    waste_factors: wallCoveringPlainWaste(),
  },
  {
    name: 'Voile de verre à peindre',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Rouleau 25 m²', quantity_per_unit: 25, unit: 'm2' },
      { label: 'Rouleau 50 m²', quantity_per_unit: 50, unit: 'm2' },
    ],
    waste_factors: wallCoveringPlainWaste(),
  },
  // Wall panels
  {
    name: 'Lambris PVC blanc 2.6m',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 3.9 m²', quantity_per_unit: 3.9, unit: 'm2' },
    ],
    waste_factors: wallCoveringPlainWaste(),
  },
  {
    name: 'Lambris PVC couleur 2.6m',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 3.9 m²', quantity_per_unit: 3.9, unit: 'm2' },
    ],
    waste_factors: wallCoveringPlainWaste(),
  },
  {
    name: 'Lambris bois brut 2m',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 2.5 m²', quantity_per_unit: 2.5, unit: 'm2' },
    ],
    waste_factors: wallCoveringPlainWaste(),
  },
  {
    name: 'Lambris MDF 2.6m',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 3.9 m²', quantity_per_unit: 3.9, unit: 'm2' },
    ],
    waste_factors: wallCoveringPlainWaste(),
  },
  {
    name: 'Parement pierre naturelle',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 0.5 m²', quantity_per_unit: 0.5, unit: 'm2' }],
    waste_factors: wallCoveringPlainWaste(),
  },
  {
    name: 'Parement brique',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 0.5 m²', quantity_per_unit: 0.5, unit: 'm2' }],
    waste_factors: wallCoveringPlainWaste(),
  },
  {
    name: 'Panneau mural 3D',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Panneau 0.25 m²', quantity_per_unit: 0.25, unit: 'm2' },
    ],
    waste_factors: wallCoveringPlainWaste(),
  },
  // Tools / accessories
  {
    name: 'Brosse à maroufler',
    category: 'wall_covering',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Roulette de joint',
    category: 'wall_covering',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Couteau à maroufler',
    category: 'wall_covering',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Cutter de précision',
    category: 'wall_covering',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Table à tapisser',
    category: 'wall_covering',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Fil à plomb',
    category: 'wall_covering',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Règle alu 2m',
    category: 'wall_covering',
    unit: 'unit',
    yield_per_unit: 1,
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: accessoryWaste(),
  },
  // More wall covering
  {
    name: 'Frise murale décorative',
    category: 'wall_covering',
    unit: 'm',
    yield_per_unit: 1,
    packagings: [{ label: 'Rouleau 5 m', quantity_per_unit: 5, unit: 'm' }],
    waste_factors: wallCoveringPatternedWaste(),
  },
  {
    name: 'Colle de fixation lambris',
    category: 'wall_covering',
    unit: 'kg',
    yield_per_unit: 2,
    packagings: [
      { label: 'Cartouche 310 ml', quantity_per_unit: 0.4, unit: 'kg' },
      { label: 'Seau 3 kg', quantity_per_unit: 3, unit: 'kg' },
    ],
    waste_factors: wallCoveringPlainWaste(),
  },
  {
    name: 'Profil de départ lambris PVC',
    category: 'wall_covering',
    unit: 'm',
    yield_per_unit: 1,
    packagings: [{ label: 'Barre 2.6 m', quantity_per_unit: 2.6, unit: 'm' }],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Cornière de finition lambris 2.6m',
    category: 'wall_covering',
    unit: 'm',
    yield_per_unit: 1,
    packagings: [{ label: 'Barre 2.6 m', quantity_per_unit: 2.6, unit: 'm' }],
    waste_factors: accessoryWaste(),
  },
  {
    // Rangé loin de ses cinq semblables dans ce fichier, mais posé sur le même
    // rouleau qu'eux : il suit donc la même loi. Deux bobines identiques
    // chiffrées différemment seraient un piège pour l'administrateur qui les
    // compare à l'écran.
    name: 'Papier peint intissé texturé',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    ...standardWallpaperRoll(),
    waste_factors: wallCoveringWaste(),
  },
];

// ---------------------------------------------------------------------------
// All materials combined
// ---------------------------------------------------------------------------
export const seedMaterials: SeedMaterial[] = [
  ...paintingMaterials,
  ...tilingMaterials,
  ...flooringMaterials,
  ...partitionMaterials,
  ...wallCoveringMaterials,
];
