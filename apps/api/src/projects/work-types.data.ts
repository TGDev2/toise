import { ContextualQuestion } from './entities/work-type.entity';

/**
 * Les 7 ouvrages seedés par la migration
 * `1711468800003-CreateWorkTypesAndProjectWorkItems`.
 *
 * Extrait tel quel de la migration (valeurs strictement identiques) pour que les
 * tests puissent énumérer les ouvrages RÉELLEMENT seedés plutôt que d'en
 * recopier une liste — `surface_target` décide de la surface que le moteur
 * calcule, un ouvrage recopié à la main teste sa propre copie. La migration
 * importe ce module : il n'existe qu'une seule source de vérité, comme pour
 * `materials/seed-catalog.data.ts` et `materials/work-type-materials.data.ts`.
 *
 * Une entrée ajoutée ici n'atteint que les bases **vierges** : la migration
 * `…003` ne se rejoue pas sur une base déjà migrée. Un 8e ouvrage demande donc,
 * comme pour le catalogue matériaux, une migration de delta (cf. `…067`, `…071`).
 */
export interface SeedWorkType {
  code: string;
  label_fr: string;
  category: string;
  /** Surface sur laquelle le moteur chiffre l'ouvrage (`estimation-engine.ts`). */
  surface_target: 'wall' | 'floor' | 'ceiling';
  waste_factor_base: number;
  contextual_questions: ContextualQuestion[];
  display_order: number;
}

/**
 * Les seules questions contextuelles seedées : le format et le type de pose du
 * carrelage sol. Les six autres ouvrages n'en portent aucune.
 */
const floorTilingQuestions: ContextualQuestion[] = [
  {
    key: 'tile_format',
    type: 'select',
    label_fr: 'Format du carreau',
    options: [
      { value: '20x20', label_fr: '20 x 20 cm' },
      { value: '30x30', label_fr: '30 x 30 cm' },
      { value: '45x45', label_fr: '45 x 45 cm' },
      { value: '60x60', label_fr: '60 x 60 cm' },
      { value: '30x60', label_fr: '30 x 60 cm' },
    ],
    required: true,
  },
  {
    key: 'laying_pattern',
    type: 'select',
    label_fr: 'Type de pose',
    options: [
      { value: 'straight', label_fr: 'Pose droite' },
      { value: 'diagonal', label_fr: 'Pose diagonale' },
    ],
    required: true,
  },
];

export const seedWorkTypes: SeedWorkType[] = [
  {
    code: 'wall_painting',
    label_fr: 'Peinture murale',
    category: 'painting',
    surface_target: 'wall',
    waste_factor_base: 1.1,
    contextual_questions: [],
    display_order: 1,
  },
  {
    code: 'ceiling_painting',
    label_fr: 'Peinture plafond',
    category: 'painting',
    surface_target: 'ceiling',
    waste_factor_base: 1.1,
    contextual_questions: [],
    display_order: 2,
  },
  {
    code: 'floor_tiling',
    label_fr: 'Carrelage sol',
    category: 'tiling',
    surface_target: 'floor',
    waste_factor_base: 1.1,
    contextual_questions: floorTilingQuestions,
    display_order: 3,
  },
  {
    code: 'wall_tiling',
    label_fr: 'Carrelage mural',
    category: 'tiling',
    surface_target: 'wall',
    waste_factor_base: 1.1,
    contextual_questions: [],
    display_order: 4,
  },
  {
    // Libellés sans accent : tels qu'insérés par la migration `…003`.
    code: 'parquet_flooring',
    label_fr: 'Parquet ou stratifie',
    category: 'flooring',
    surface_target: 'floor',
    waste_factor_base: 1.1,
    contextual_questions: [],
    display_order: 5,
  },
  {
    code: 'drywall',
    label_fr: 'Cloison seche',
    category: 'partition',
    surface_target: 'wall',
    waste_factor_base: 1.05,
    contextual_questions: [],
    display_order: 6,
  },
  {
    code: 'wall_covering',
    label_fr: 'Revetement mural',
    category: 'wall_covering',
    surface_target: 'wall',
    waste_factor_base: 1.1,
    contextual_questions: [],
    display_order: 7,
  },
];
