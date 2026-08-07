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
 * Les questions contextuelles du carrelage sol : le format, la largeur de joint
 * et le type de pose. Le carrelage mural et le parquet portent la leur plus bas
 * (E1-7), le revêtement mural les siennes (E1-6) ; les trois ouvrages restants
 * — les deux peintures et la cloison sèche — n'en portent aucune, et n'ont pas
 * de variante de pose au catalogue.
 *
 * E1-5 — `tile_format` pilote enfin quelque chose : la consommation de colle
 * (par le peigne que le format impose et par le double encollage que le NF DTU
 * 52.2 déclenche au-delà d'un seuil de surface) et celle de joint (par le
 * volume de joint sous un m²). La troisième question est la largeur de joint,
 * qui pèse plus que tout le reste sur le joint — un 20 × 20 à 5 mm en consomme
 * trois fois plus qu'un 60 × 60 à 2 mm.
 */
/**
 * E1-10 — l'exposition à l'eau du local, qui décide de la présence du SEL et
 * de sa bande de jonction (`estimations/wet-room.ts`).
 *
 * Deuxième question du produit, après `subfloor_type`, dont la réponse fait
 * apparaître ou disparaître des lignes. La première option est aussi la valeur
 * que retient le moteur sans réponse — et ici ce n'est **pas** le sens sûr,
 * contrairement à E1-8 : « sûr = exposé » achèterait un système d'étanchéité
 * complet sur tous les carrelages non répondus du chemin public, chaque
 * séjour, chaque cuisine. Le défaut est donc `dry`, l'inversion est assumée,
 * arbitrée et consignée au registre ; le garde-fou est l'exclusion motivée
 * visible à l'écran dans les deux sens.
 */
const waterExposureQuestion: ContextualQuestion = {
  key: 'water_exposure',
  type: 'select',
  label_fr: "Exposition à l'eau du local",
  options: [
    { value: 'dry', label_fr: 'Pièce sèche (séjour, chambre, cuisine…)' },
    { value: 'wet_room', label_fr: "Salle d'eau — douche ou baignoire" },
  ],
  required: true,
};

/**
 * E1-10 — la planéité du support, qui décide de la présence du ragréage et de
 * son primaire (`estimations/floor-prep.ts`). Le seuil est celui des NF DTU
 * 52.2 et 51.11 : 5 mm sous la règle de 2 m — un diagnostic que l'artisan fait
 * réellement, à la règle, sur le chantier. Même défaut « premier choix », même
 * arbitrage et même garde-fou d'exclusion motivée que `water_exposure`.
 */
const floorFlatnessQuestion: ContextualQuestion = {
  key: 'floor_flatness',
  type: 'select',
  label_fr: 'Planéité du support',
  options: [
    { value: 'flat', label_fr: 'Plan — au plus 5 mm sous la règle de 2 m' },
    {
      value: 'uneven',
      label_fr: 'Défauts de plus de 5 mm — ragréage nécessaire',
    },
  ],
  required: true,
};

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
  waterExposureQuestion,
  floorFlatnessQuestion,
];

/**
 * E1-7 — le calepinage, là où il change la coupe.
 *
 * Le carrelage mural et le parquet **seedaient** des poses distinctes sur leurs
 * matériaux et ne demandaient rien : la pose transmise au moteur valait
 * `standard`, qu'aucun de ces matériaux ne déclare. Le carrelage mural tombait
 * donc sur les 10 % génériques quel que soit le niveau — le curseur de
 * compétence n'y faisait rien — et la pose diagonale du parquet n'était
 * atteignable par aucun chemin utilisateur.
 *
 * Ces deux questions ferment les deux trous d'un coup : elles rendent la pose
 * **déclarable**, et elles rendent vrai l'invariant qui interdit désormais
 * qu'un ouvrage transmette une pose que ses matériaux ne connaissent pas
 * (`estimations/__tests__/waste-factor-coverage.spec.ts`, propriété W2).
 *
 * Requises, comme celle du carrelage sol : entre une pose droite et une pose
 * diagonale, l'écart de perte va de 5 à 10 points — c'est un carton de carreaux
 * ou un paquet de lames, pas un détail qu'on devine à la place de l'artisan.
 */
const wallTilingQuestions: ContextualQuestion[] = [
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
  // E1-10 : le SEL mural suit la même exposition que le SEL au sol — une
  // douche carrelée l'est sur ses deux surfaces.
  waterExposureQuestion,
];

/**
 * Le parquet porte une **troisième** pose que le carrelage n'a pas : les
 * chevrons (bâtons rompus, point de Hongrie). Elle est ajoutée par E1-7 parce
 * que sans elle un chantier en chevrons était chiffré comme une diagonale, à
 * 15 % là où la profession compte 15 à 20 % — un sous-achat sur la pose qui
 * pardonne le moins, puisqu'une lame manquante ne se remplace pas par une lame
 * d'un autre bain.
 *
 * Elle n'a **pas** d'équivalent au carrelage : aucune des sources consultées ne
 * chiffre la chute d'un carrelage en chevrons, et inventer la valeur pour
 * offrir l'option recréerait la donnée inatteignable que ce lot supprime.
 */
const parquetFlooringQuestions: ContextualQuestion[] = [
  {
    key: 'laying_pattern',
    type: 'select',
    label_fr: 'Type de pose',
    options: [
      { value: 'straight', label_fr: 'Pose droite' },
      { value: 'diagonal', label_fr: 'Pose diagonale' },
      { value: 'herringbone', label_fr: 'Chevrons ou point de Hongrie' },
    ],
    required: true,
  },
  {
    /**
     * E1-8 — la nature du support, qui décide de la présence du pare-vapeur.
     *
     * C'est la première question du produit dont la réponse fait **apparaître ou
     * disparaître une ligne** au lieu d'en changer la quantité. Le NF DTU 51.11
     * ne réserve le film qu'aux supports minéraux ; sur plancher bois, il était
     * acheté pour rien — un rouleau de 20 m² sur chaque chantier.
     *
     * Requise, comme le calepinage et pour la même raison : la réponse vaut un
     * rouleau entier, et personne ne peut la deviner à la place de l'artisan.
     * L'ordre des options est celui de `SUBFLOOR_TYPES`
     * (`estimations/vapour-barrier.ts`), dont la première est aussi la valeur
     * que retient le moteur sans réponse — et c'est ici le sens sûr : sans
     * réponse, on suppose le support qui exige le film.
     */
    key: 'subfloor_type',
    type: 'select',
    label_fr: 'Nature du support',
    options: [
      { value: 'concrete_screed', label_fr: 'Béton ou chape' },
      { value: 'wood_floor', label_fr: 'Plancher bois' },
      { value: 'existing_covering', label_fr: 'Ancien revêtement' },
    ],
    required: true,
  },
  // E1-10 : le parquet flottant tolère les mêmes 5 mm/2 m que le carrelage
  // (NF DTU 51.11) ; au-delà, ragréage fibré + primaire.
  floorFlatnessQuestion,
];

/**
 * E1-6 — ce qu'il faut savoir d'un revêtement mural pour le débiter en lés.
 *
 * Toutes deux `select`, et non `number` : `ContextualQuestions.tsx` ne rend que
 * le type `select`. Une question `number` serait affichée sans champ de saisie —
 * invisible pour l'utilisateur, requise pour le serveur. Le jour où le
 * formulaire saura rendre un nombre, `pattern_repeat_cm` pourra le devenir sans
 * que le moteur bouge : il lit un nombre de centimètres, pas une option.
 */
const wallCoveringQuestions: ContextualQuestion[] = [
  {
    /**
     * Hauteur de raccord de motif, en centimètres, telle qu'elle est imprimée
     * sur l'étiquette du rouleau. Elle s'ajoute à la longueur de chaque lé et
     * décide donc du nombre de lés qu'un rouleau donne.
     *
     * Requise : c'est le paramètre qui pèse le plus, et le seul que l'artisan
     * ne peut pas deviner — il se lit sur le produit. La première option, « Uni,
     * sans raccord », est aussi la valeur que retient le moteur en l'absence de
     * réponse : l'écran et le calcul disent la même chose.
     *
     * **Pourquoi l'échelle va jusqu'à 80 cm.** Le raccord n'agit que par la
     * partie entière `⌊10,05 / lé⌋`, qui ne bouge que par marches. À 2,50 m sous
     * plafond et 10 cm de marge, un uni comme un raccord de 64 cm donnent tous
     * deux 3 lés par rouleau : sur cette hauteur-là, la réponse ne change rien.
     * La marche suivante tombe au-delà de 75 cm de raccord — d'où le 80 cm, qui
     * est par ailleurs la valeur d'exemple du guide ManoMano. C'est ce qui rend
     * la question **démontrablement lue** sur la pièce de référence du harnais
     * (invariant I6). Retirer cette option ferait rougir I6 à juste titre : les
     * options restantes seraient sans effet à 2,50 m.
     */
    key: 'pattern_repeat_cm',
    type: 'select',
    label_fr: 'Raccord de motif',
    options: [
      { value: '0', label_fr: 'Uni, sans raccord' },
      { value: '16', label_fr: '16 cm' },
      { value: '32', label_fr: '32 cm' },
      { value: '53', label_fr: '53 cm' },
      { value: '64', label_fr: '64 cm' },
      { value: '80', label_fr: '80 cm' },
    ],
    required: true,
  },
  {
    /**
     * Marge de coupe par lé — l'arasement en haut et en bas.
     *
     * **Facultative**, contrairement au raccord : 10 cm (5 en haut, 5 en bas)
     * est une constante du métier que trois guides de pose indépendants donnent
     * à l'identique, pas une décision de chantier. Elle est posée quand même
     * parce qu'un mur d'aplomb douteux se rattrape par la marge, et que c'est le
     * seul levier qui reste à un poseur expérimenté pour tirer un lé de plus
     * d'un rouleau.
     */
    key: 'cut_margin_cm',
    type: 'select',
    label_fr: 'Marge de coupe par lé',
    options: [
      { value: '10', label_fr: '10 cm — recommandé (5 en haut, 5 en bas)' },
      { value: '5', label_fr: '5 cm' },
      { value: '15', label_fr: '15 cm' },
    ],
    required: false,
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
    contextual_questions: wallTilingQuestions,
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
    contextual_questions: parquetFlooringQuestions,
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
    contextual_questions: wallCoveringQuestions,
    display_order: 7,
    quantity_basis: 'room_surface',
    frame_spec: null,
  },
];
