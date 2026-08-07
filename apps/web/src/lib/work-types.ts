export interface ContextualQuestionOption {
  value: string;
  label_fr: string;
}

export interface ContextualQuestion {
  key: string;
  type: 'select' | 'number';
  label_fr: string;
  options?: ContextualQuestionOption[];
  required: boolean;
}

export interface WorkTypeRef {
  id: string;
  code: string;
  label_fr: string;
  category: string;
  surface_target: string;
  quantity_basis: string;
  contextual_questions: ContextualQuestion[];
}

/**
 * E1-4 — valeur de `WorkTypeRef.quantity_basis` pour un ouvrage qu'on crée
 * plutôt qu'on ne recouvre (aujourd'hui : la cloison sèche). L'assiette est
 * alors saisie par l'utilisateur (`declared_*`) au lieu d'être dérivée de la
 * géométrie de la pièce. Voir `work_types.quantity_basis` côté API.
 */
export const DECLARED_QUANTITY_BASIS = 'declared';

export interface WorkItemSelection {
  work_type_id: string;
  skill_level: string;
  custom_params: Record<string, unknown>;
  /** E1-4 — assiette saisie, uniquement quand `quantity_basis === DECLARED_QUANTITY_BASIS`. */
  declared_length_m?: number;
  declared_height_m?: number;
  declared_clad_faces?: number;
}

export interface SavedWorkItem {
  id: string;
  work_type: WorkTypeRef;
  skill_level: string;
  custom_params: Record<string, unknown>;
  declared_length_m?: number | null;
  declared_height_m?: number | null;
  declared_clad_faces?: number | null;
}

/**
 * E4-4 — sélection d'ouvrages reprise d'ailleurs, proposée à l'étape
 * « Travaux » d'une pièce encore vierge.
 *
 * `source` n'est pas décoratif : ce qui est repris est **annoncé à l'écran**.
 * `skill_level` pilote le facteur de perte donc les quantités ; pré-cocher en
 * silence mettrait un choix dans la bouche de l'artisan.
 */
export interface WorkSelectionSuggestion {
  work_type_ids: string[];
  skill_level: string;
  custom_params: Record<string, Record<string, unknown>>;
  source: 'room' | 'project';
}

/** Réponse de `GET /projects/:id/work-items/last-selection`. */
export interface LastWorkSelectionItem {
  work_type_id: string;
  skill_level: string;
  custom_params: Record<string, unknown>;
}

export const SKILL_LEVELS = [
  {
    value: 'beginner',
    label: 'Débutant',
    description:
      'Le facteur de perte sera augmenté pour compenser les erreurs de découpe plus fréquentes.',
  },
  {
    value: 'intermediate',
    label: 'Intermédiaire',
    description: '',
  },
  {
    value: 'expert',
    label: 'Confirmé',
    description: '',
  },
] as const;

export const WORK_TYPE_ICONS: Record<string, string> = {
  wall_painting: '\u{1F3A8}',
  ceiling_painting: '\u{2B06}\u{FE0F}',
  floor_tiling: '\u{1FAA8}',
  wall_tiling: '\u{1F9F1}',
  parquet_flooring: '\u{1FAB5}',
  drywall: '\u{1F9F1}',
  wall_covering: '\u{1F5BC}\u{FE0F}',
};

/** Code de `work_types`, tel que seedé par la migration `...003`. */
export type WorkTypeCode = keyof typeof WORK_TYPE_ICONS;

/**
 * Les métiers que le moteur sait réellement chiffrer, et eux seuls.
 *
 * Cette table existe parce que les surfaces artisan vendaient « les artisans du
 * bâtiment » alors que les sept ouvrages seedés sont tous de finition : un plombier
 * ou un électricien ne peut produire aucun devis réel avec ce catalogue. Annoncer
 * le périmètre est la contrepartie honnête d'un prix, pas une réserve juridique.
 *
 * `workTypes` est adossé aux codes de `work_types` : le test du catalogue d'offre
 * échoue si un ouvrage seedé n'est rattaché à aucun métier.
 */
export interface CoveredTrade {
  label: string;
  workTypes: WorkTypeCode[];
}

export const COVERED_TRADES: CoveredTrade[] = [
  { label: 'Peintre', workTypes: ['wall_painting', 'ceiling_painting'] },
  { label: 'Carreleur', workTypes: ['floor_tiling', 'wall_tiling'] },
  { label: 'Solier, poseur de parquet', workTypes: ['parquet_flooring'] },
  { label: 'Plaquiste', workTypes: ['drywall'] },
  { label: 'Poseur de revêtement mural', workTypes: ['wall_covering'] },
];

/**
 * Les corps d'état hors périmètre, nommés. Les taire reviendrait à laisser un
 * artisan souscrire pour découvrir après coup que son métier n'est pas chiffrable.
 */
export const TRADES_NOT_COVERED = [
  'Plomberie',
  'Électricité',
  'Isolation',
  'Maçonnerie',
  'Menuiserie',
] as const;
