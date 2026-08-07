import { ContextualQuestion, FrameSpec } from './entities/work-type.entity';

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
  /**
   * E1-2 — comment la quantité d'ouvrage se détermine. `room_surface` : dérivée
   * de la géométrie de la pièce via `surface_target` (tous les ouvrages de
   * recouvrement, comportement inchangé). `declared` : saisie par l'utilisateur
   * (linéaire, hauteur, faces à parementer — `project_work_items.declared_*`),
   * pour un ouvrage qu'on **crée** plutôt qu'on ne recouvre. Orthogonal à
   * `surface_target`, que le moteur ne lit plus que pour un `room_surface`
   * depuis qu'E1-3 a câblé la lecture de ce champ.
   */
  quantity_basis: 'room_surface' | 'declared';
  /**
   * E1-3 — trame de l'ouvrage. `null` pour un ouvrage sans ossature : c'est ce
   * qui rend `frame_runner`/`frame_stud` inapplicable à ses matériaux.
   */
  frame_spec: FrameSpec | null;
}

/**
 * Les seules questions contextuelles seedées : le format, la largeur de joint
 * et le type de pose du carrelage sol. Les six autres ouvrages n'en portent
 * aucune.
 *
 * E1-5 — `tile_format` pilote enfin quelque chose : la consommation de colle
 * (par le peigne que le format impose et par le double encollage que le NF DTU
 * 52.2 déclenche au-delà d'un seuil de surface) et celle de joint (par le
 * volume de joint sous un m²). La troisième question est la largeur de joint,
 * qui pèse plus que tout le reste sur le joint — un 20 × 20 à 5 mm en consomme
 * trois fois plus qu'un 60 × 60 à 2 mm.
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
    /**
     * E1-5 — largeur de joint, en millimètres.
     *
     * `auto` est la première option et la réponse attendue par défaut : le
     * moteur retient alors la largeur recommandée pour le format choisi
     * (`estimations/tile-consumption.ts`, `default_joint_width_mm`). C'est
     * volontairement le **moteur** qui décide, et pas le formulaire : une table
     * format → joint recopiée côté web finirait par diverger de celle qui
     * chiffre, et l'écran promettrait une valeur que la liste d'achat
     * ignorerait.
     *
     * Requise plutôt que facultative pour la même raison qu'elle est posée : un
     * champ laissé vide donnerait une largeur par défaut que l'artisan n'aurait
     * jamais vue passer. Ici il la choisit, fût-ce en acceptant la recommandée.
     */
    key: 'joint_width_mm',
    type: 'select',
    label_fr: 'Largeur de joint',
    options: [
      { value: 'auto', label_fr: 'Recommandé pour ce format' },
      { value: '2', label_fr: '2 mm' },
      { value: '3', label_fr: '3 mm' },
      { value: '5', label_fr: '5 mm' },
      { value: '8', label_fr: '8 mm' },
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
    quantity_basis: 'room_surface',
    frame_spec: null,
  },
  {
    code: 'ceiling_painting',
    label_fr: 'Peinture plafond',
    category: 'painting',
    surface_target: 'ceiling',
    waste_factor_base: 1.1,
    contextual_questions: [],
    display_order: 2,
    quantity_basis: 'room_surface',
    frame_spec: null,
  },
  {
    code: 'floor_tiling',
    label_fr: 'Carrelage sol',
    category: 'tiling',
    surface_target: 'floor',
    waste_factor_base: 1.1,
    contextual_questions: floorTilingQuestions,
    display_order: 3,
    quantity_basis: 'room_surface',
    frame_spec: null,
  },
  {
    code: 'wall_tiling',
    label_fr: 'Carrelage mural',
    category: 'tiling',
    surface_target: 'wall',
    waste_factor_base: 1.1,
    contextual_questions: [],
    display_order: 4,
    quantity_basis: 'room_surface',
    frame_spec: null,
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
    quantity_basis: 'room_surface',
    frame_spec: null,
  },
  {
    code: 'drywall',
    label_fr: 'Cloison seche',
    category: 'partition',
    surface_target: 'wall',
    waste_factor_base: 1.05,
    contextual_questions: [],
    display_order: 6,
    // E1-2 : ouvrage qu'on crée, pas qu'on recouvre — assiette saisie
    // (`project_work_items.declared_length_m/height_m/clad_faces`), câblée
    // dans le moteur par E1-3. `surface_target` reste 'wall' et ne sert plus à
    // rien pour cet ouvrage : le moteur ne le lit que pour un `room_surface`.
    quantity_basis: 'declared',
    // Cloison 72/48 : montants simples à l'entraxe 0,60 m, lisse haute et
    // lisse basse. `extra_studs: 0` — le seul ouvrage seedé ne déclare ni rive
    // ni huisserie ; la saisie d'une huisserie viendra avec l'interface (E1-4)
    // et n'aura qu'à incrémenter ce nombre.
    frame_spec: { stud_spacing_m: 0.6, extra_studs: 0, runner_courses: 2 },
  },
  {
    code: 'wall_covering',
    label_fr: 'Revetement mural',
    category: 'wall_covering',
    surface_target: 'wall',
    waste_factor_base: 1.1,
    contextual_questions: [],
    display_order: 7,
    quantity_basis: 'room_surface',
    frame_spec: null,
  },
];
