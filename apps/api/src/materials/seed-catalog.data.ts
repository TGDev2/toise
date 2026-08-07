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
  VapourBarrierRole,
  WetRoomRole,
  SubstratePrep,
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
  /**
   * E1-8 — rôle vis-à-vis du pare-vapeur d'un sol posé en flottant. Absent =
   * aucun, comme le défaut `NULL` de la colonne : le matériau n'a rien à voir
   * avec la question.
   *
   * `dedicated` est le **seul** attribut du catalogue qui rende un matériau
   * conditionnel : le film n'est chiffré que si le support l'exige et qu'aucune
   * sous-couche `integrated` ne le fournit déjà
   * (`estimations/vapour-barrier.ts`).
   */
  vapour_barrier?: VapourBarrierRole;
  /**
   * E1-8 — les chutes se réutilisent-elles bout à bout ? Absent = `true`, comme
   * le défaut de la colonne : un matériau est aboutable sauf s'il déclare le
   * contraire, et tout le catalogue l'était avant ce lot.
   *
   * `false` réserve le matériau au comptage en **pièces**
   * (`estimations/piece-cutting.ts`) et lui retire son forfait de coupe, dont
   * la chute mesurée prend la place.
   */
  offcuts_reusable?: boolean;
  /**
   * E1-10 — rôle dans le système d'étanchéité d'un local exposé à l'eau.
   * Absent = aucun, comme le défaut `NULL` de la colonne. Un matériau marqué
   * n'est chiffré que si le local est déclaré salle d'eau
   * (`estimations/wet-room.ts`).
   */
  wet_room_system?: WetRoomRole;
  /**
   * E1-10 — rôle dans la préparation d'un sol non plan. Absent = aucun. Un
   * matériau marqué n'est chiffré que si la planéité déclarée l'exige
   * (`estimations/floor-prep.ts`).
   */
  substrate_prep?: SubstratePrep;
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

/**
 * E1-7 — la perte de coupe d'un carrelage : elle dépend du calepinage.
 *
 * Fourchettes métier (registre) : pose droite 5 à 10 %, pose diagonale 10 à
 * 15 %. Le niveau **expert** prend le bas de la fourchette, l'**intermédiaire**
 * le haut ; le **débutant** reçoit une marge au-delà, qu'aucune source ne
 * chiffre parce qu'aucune ne s'adresse à lui. Valeurs inchangées par E1-7 :
 * elles étaient déjà cohérentes avec la profession — ce qui était faux, c'est
 * la liste des matériaux qui les portaient.
 */
const tileCoveringWaste = (): SeedMaterial['waste_factors'] => [
  { pose_type: 'straight', skill_level: 'beginner', factor_percent: 15 },
  { pose_type: 'straight', skill_level: 'intermediate', factor_percent: 10 },
  { pose_type: 'straight', skill_level: 'expert', factor_percent: 5 },
  { pose_type: 'diagonal', skill_level: 'beginner', factor_percent: 20 },
  { pose_type: 'diagonal', skill_level: 'intermediate', factor_percent: 15 },
  { pose_type: 'diagonal', skill_level: 'expert', factor_percent: 10 },
];

/**
 * E1-7 — la perte de coupe d'un sol posé en lames.
 *
 * `straight` remplace le `standard` d'avant ce lot, à valeurs identiques : la
 * pose droite d'un parquet porte enfin le nom que le métier lui donne, et celui
 * que l'écran propose. Sans ce renommage, choisir « pose droite » ne trouvait
 * aucune ligne et retombait sur `standard` — un repli qui donnait le bon
 * chiffre pour la mauvaise raison, et masquait le trou d'à côté.
 *
 * `diagonal` était **fausse** : 15/10/7 pour une pose que la profession chiffre
 * de 10 à 20 %, avec 15 % comme règle courante. Un expert achetait 7 % de marge
 * pour une coupe qui en demande le double — un sous-achat qui ne se découvre
 * qu'à la dernière rangée, quand le bain de teinte n'est plus disponible.
 *
 * `herringbone` (chevrons, point de Hongrie) est **ajoutée** par E1-7 : sans
 * elle, un chantier en chevrons était chiffré comme une diagonale. Fourchette
 * professionnelle relevée : 12 à 20 %. Les valeurs retenues siègent au **haut**
 * de cette fourchette, délibérément : dans un calepinage à motif, une lame
 * manquante ne se rattrape pas avec une lame d'un autre lot.
 */
const floorCoveringWaste = (): SeedMaterial['waste_factors'] => [
  { pose_type: 'straight', skill_level: 'beginner', factor_percent: 10 },
  { pose_type: 'straight', skill_level: 'intermediate', factor_percent: 7 },
  { pose_type: 'straight', skill_level: 'expert', factor_percent: 5 },
  { pose_type: 'diagonal', skill_level: 'beginner', factor_percent: 20 },
  { pose_type: 'diagonal', skill_level: 'intermediate', factor_percent: 17 },
  { pose_type: 'diagonal', skill_level: 'expert', factor_percent: 15 },
  { pose_type: 'herringbone', skill_level: 'beginner', factor_percent: 25 },
  { pose_type: 'herringbone', skill_level: 'intermediate', factor_percent: 22 },
  { pose_type: 'herringbone', skill_level: 'expert', factor_percent: 20 },
];

/**
 * E1-7 — ce qui se **découpe** sans dépendre du calepinage.
 *
 * Sous-couches, films, nattes de découplage, bandes d'étanchéité, plinthes et
 * profilés : ils se coupent, donc ils ont une chute, mais elle suit la forme de
 * la pièce et non le motif du revêtement. Leur donner les poses du revêtement
 * ferait varier une chute qui ne varie pas — c'est ce que faisait le catalogue
 * avant ce lot, où une natte de découplage coûtait 5 points de plus parce que
 * les carreaux au-dessus étaient posés en diagonale.
 *
 * Valeurs reprises de l'ancien `floorStandardWaste()`, où elles étaient déjà
 * celles de cette famille.
 */
const cutAncillaryWaste = (): SeedMaterial['waste_factors'] => [
  { pose_type: 'standard', skill_level: 'beginner', factor_percent: 10 },
  { pose_type: 'standard', skill_level: 'intermediate', factor_percent: 7 },
  { pose_type: 'standard', skill_level: 'expert', factor_percent: 5 },
];

/**
 * E1-7 — ce qui se **dose** : mortiers-colles, colles, joints, primaires,
 * ragréages, SEL.
 *
 * Le point de métier qui commande ce jeu de valeurs : **une chute de carreau
 * est reposée ailleurs**. Le morceau coupé pour border un mur est collé sur sa
 * propre surface, et cette surface est déjà comptée. La colle suit donc la
 * surface **nette** à couvrir, jamais la surface **achetée**. Lui appliquer la
 * perte de coupe du carreau était un double comptage : en pose diagonale
 * débutante, 20 % sur 7,14 kg/m² faisaient acheter un sac de 25 kg pour rien.
 *
 * Ce qui reste, et que ces valeurs représentent, est la **gâchée perdue** —
 * fond de seau, mortier tiré trop tôt, peigne trop chargé. Aucune fiche
 * fabricant ni aucun guide consulté ne la chiffre : les fiches donnent une
 * consommation « à titre indicatif » et renvoient la variation au peigne et au
 * double encollage, que le moteur modélise déjà depuis E1-5
 * (`estimations/tile-consumption.ts`). Ces trois valeurs sont donc une marge de
 * prudence assumée, volontairement placée **sous** toutes les échelles de chute
 * du catalogue, et non une donnée sourcée. C'est écrit tel quel au registre.
 */
const dosedWaste = (): SeedMaterial['waste_factors'] => [
  { pose_type: 'standard', skill_level: 'beginner', factor_percent: 5 },
  { pose_type: 'standard', skill_level: 'intermediate', factor_percent: 3 },
  { pose_type: 'standard', skill_level: 'expert', factor_percent: 2 },
];

/**
 * Plâtrerie. Une cloison n'a pas de calepinage à déclarer : pose unique.
 *
 * **Réserve connue, non traitée par E1-7** : les rendements de parement seedés
 * viennent du quantitatif Placo® « pour réaliser 1 m² de cloison » (2,1 m²/m²
 * à deux faces), dans lequel la profession loge déjà environ 5 % de chute — le
 * SNIP l'écrit noir sur blanc pour le même quantitatif (« coefficient de perte
 * pris à 5 % »). Ces 12/8/4 s'ajoutent donc à une marge déjà présente. Corriger
 * demande de réexprimer les rendements en géométrie pure, ce qui touche le
 * registre des rendements et les encadrements de consommation : c'est le
 * périmètre d'E1-8, pas celui-ci. Le sens de l'écart est le sens sûr (on achète
 * un peu trop), et il est écrit ici pour ne pas être redécouvert.
 */
const partitionWaste = (): SeedMaterial['waste_factors'] => [
  { pose_type: 'standard', skill_level: 'beginner', factor_percent: 12 },
  { pose_type: 'standard', skill_level: 'intermediate', factor_percent: 8 },
  { pose_type: 'standard', skill_level: 'expert', factor_percent: 4 },
];

/**
 * E1-8 — ce qui se **découpe à longueur** : la chute est mesurée, pas estimée.
 *
 * Montants et fourrures se coupent à la hauteur de l'ouvrage, et ce qui reste
 * de la barre ne se raboute pas. Le moteur compte donc des pièces
 * (`materials_catalog.offcuts_reusable = false`,
 * `estimations/piece-cutting.ts`) et **connaît** la chute exactement : sous
 * 2,50 m de plafond, 0,20 m par barre de 2,70 m, soit 7,4 %.
 *
 * Leur ajouter les 12/8/4 % de `partitionWaste()` compterait donc deux fois la
 * même chute. C'est la décision d'E1-7 sur les mortiers-colle, appliquée à
 * l'autre bout du catalogue : *une chute déjà calculée ne se réestime pas.*
 *
 * **Ce que ce 0 % ne couvre pas, écrit noir sur blanc** : la casse — la barre
 * pliée au transport, le montant recoupé trop court. Aucune fiche ni aucun
 * guide consulté ne la chiffre, et le sens de l'écart n'est pas le sens sûr.
 * C'est pour cela que la valeur est ici, visible et discutable, plutôt qu'une
 * condition dans le moteur qui sauterait la résolution : le jour où une source
 * chiffrera la casse d'ossature, il n'y aura qu'à remplacer ces trois zéros.
 *
 * Les trois niveaux sont écrits malgré l'égalité, parce que le registre exige
 * une ligne par (pose, niveau) : un trou lèverait `MissingWasteFactorError`.
 */
const measuredOffcutWaste = (): SeedMaterial['waste_factors'] => [
  { pose_type: 'standard', skill_level: 'beginner', factor_percent: 0 },
  { pose_type: 'standard', skill_level: 'intermediate', factor_percent: 0 },
  { pose_type: 'standard', skill_level: 'expert', factor_percent: 0 },
];

/**
 * E1-10 — ce qui se **compte à l'unité** : barres de seuil.
 *
 * Une barre par passage de porte, ni coupe ni gâchée : un pourcentage de perte
 * n'a pas de sens sur une unité comptée — 10 % sur une barre en achèteraient
 * deux par arrondi au contenant. Mêmes trois zéros que `measuredOffcutWaste`,
 * sous un nom distinct parce que la raison est distincte : là-bas la chute est
 * mesurée, ici il n'y a pas de chute du tout. I5 (le niveau ne fait jamais
 * acheter plus) tient par égalité, comme pour les montants.
 */
const countedUnitWaste = (): SeedMaterial['waste_factors'] => [
  { pose_type: 'standard', skill_level: 'beginner', factor_percent: 0 },
  { pose_type: 'standard', skill_level: 'intermediate', factor_percent: 0 },
  { pose_type: 'standard', skill_level: 'expert', factor_percent: 0 },
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

/**
 * E1-7 — ce qui reste à perdre sur un papier peint **une fois les lés comptés**.
 *
 * Avant ce lot, ce catalogue distinguait deux poses, `plain` et `patterned`, à
 * 10/7/3 et 18/12/7. Deux raisons de les supprimer, et pas seulement de les
 * compléter :
 *
 * 1. **Elles produisaient l'incohérence exacte que le lot corrige.** Aucun
 *    ouvrage ne demandait la pose : le moteur transmettait `standard`, que ni
 *    l'une ni l'autre ne déclarait, et les trois niveaux tombaient sur les 10 %
 *    génériques. Répondre « uni » *baissait* la perte de 10 à 3 % — préciser
 *    améliorait le résultat, ce qui ne décrit aucun chantier.
 * 2. **La chute de raccord est désormais comptée géométriquement.** Depuis E1-6,
 *    `estimations/wallpaper-strips.ts` allonge chaque lé de la hauteur du
 *    raccord et arrondit au lé entier, pan par pan — c'est la méthode que le
 *    NF DTU 59.4 §6.6.5 prescrit, et c'est la chute que `patterned` représentait
 *    forfaitairement. Garder les deux, c'était compter le motif deux fois.
 *
 * Ce qui subsiste ne dépend donc plus du papier mais du **poseur** : le lé
 * gâché, le faux départ, la coupe ratée. C'est exactement ce que Bricomarché
 * chiffre pour un débutant — « un poseur novice doit effectivement prévoir 15 à
 * 20 % de papier supplémentaire afin de compenser les erreurs de découpe ou les
 * faux départs », au-dessus d'un calcul qui tient déjà compte du raccord. Les
 * 3 % de l'expert sont la valeur `plain` d'avant ce lot, conservée : un lé gâché
 * sur une trentaine.
 *
 * Pose unique, donc, et l'ouvrage ne pose aucune question de calepinage : le
 * seul paramètre qui comptait, le raccord, est déjà demandé et déjà lu.
 */
const wallpaperStripWaste = (): SeedMaterial['waste_factors'] => [
  { pose_type: 'standard', skill_level: 'beginner', factor_percent: 15 },
  { pose_type: 'standard', skill_level: 'intermediate', factor_percent: 8 },
  { pose_type: 'standard', skill_level: 'expert', factor_percent: 3 },
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
    waste_factors: tileCoveringWaste(),
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
    waste_factors: tileCoveringWaste(),
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
    waste_factors: tileCoveringWaste(),
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
    waste_factors: tileCoveringWaste(),
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
    waste_factors: tileCoveringWaste(),
  },
  // Wall tiles
  {
    name: 'Carrelage mural 10x10 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 1 m²', quantity_per_unit: 1, unit: 'm2' }],
    waste_factors: tileCoveringWaste(),
  },
  {
    name: 'Carrelage mural 15x15 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 1 m²', quantity_per_unit: 1, unit: 'm2' }],
    waste_factors: tileCoveringWaste(),
  },
  {
    name: 'Carrelage mural 20x20 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 1 m²', quantity_per_unit: 1, unit: 'm2' }],
    waste_factors: tileCoveringWaste(),
  },
  {
    name: 'Carrelage mural 20x40 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 1 m²', quantity_per_unit: 1, unit: 'm2' }],
    waste_factors: tileCoveringWaste(),
  },
  {
    name: 'Carrelage mural 30x60 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Boîte 1.08 m²', quantity_per_unit: 1.08, unit: 'm2' },
    ],
    waste_factors: tileCoveringWaste(),
  },
  {
    name: 'Mosaïque 30x30 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Plaque 0.09 m²', quantity_per_unit: 0.09, unit: 'm2' },
    ],
    waste_factors: tileCoveringWaste(),
  },
  {
    name: 'Faïence murale 25x40 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 1 m²', quantity_per_unit: 1, unit: 'm2' }],
    waste_factors: tileCoveringWaste(),
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
    waste_factors: dosedWaste(),
  },
  {
    name: 'Mortier-colle flexible (C2)',
    category: 'tiling',
    unit: 'kg',
    yield_per_unit: 0.14,
    consumption_model: 'tile_adhesive',
    packagings: [{ label: 'Sac 25 kg', quantity_per_unit: 25, unit: 'kg' }],
    waste_factors: dosedWaste(),
  },
  {
    name: 'Mortier-colle rapide (C2F)',
    category: 'tiling',
    unit: 'kg',
    yield_per_unit: 0.14,
    consumption_model: 'tile_adhesive',
    packagings: [{ label: 'Sac 25 kg', quantity_per_unit: 25, unit: 'kg' }],
    waste_factors: dosedWaste(),
  },
  {
    name: 'Mortier-colle grand format (C2S1)',
    category: 'tiling',
    unit: 'kg',
    yield_per_unit: 0.14,
    consumption_model: 'tile_adhesive',
    packagings: [{ label: 'Sac 25 kg', quantity_per_unit: 25, unit: 'kg' }],
    waste_factors: dosedWaste(),
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
    waste_factors: dosedWaste(),
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
    waste_factors: dosedWaste(),
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
    waste_factors: dosedWaste(),
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
    waste_factors: dosedWaste(),
  },
  {
    name: 'Joint souple silicone',
    category: 'tiling',
    unit: 'unit',
    // E1-10 — réintégré : la fiche Sika Sanisil publie un métrage de cordon
    // par cartouche de 300 ml, jamais un rendement au m². C'est le cas d'école
    // de l'assiette linéaire : 3,0 m de joint 10 × 10 mm par cartouche (la
    // section la plus défavorable publiée), sur le périmètre au sol portes
    // déduites — le joint périphérique du NF DTU 52.2.
    yield_per_unit: 3,
    quantity_driver: 'floor_perimeter',
    packagings: [
      { label: 'Cartouche 300 ml', quantity_per_unit: 1, unit: 'unit' },
    ],
    waste_factors: dosedWaste(),
  },
  // Accessories
  //
  // E1-10 — croisillons : un croisillon par intersection de joints, soit
  // autant que de carreaux sous un m² (`estimations/tile-consumption.ts`,
  // `spacersPerM2`). Le rendement est exprimé à la géométrie de référence du
  // modèle (45 × 45 : 4,94 croisillons/m²) : un sachet de 200 couvre
  // 200 × 2 025 / 10 000 = 40,5 m². Dérivation géométrique définitionnelle —
  // aucun fabricant (Rubi, Raimondi, Taliaplast vérifiés en E1-7) ne publie de
  // table de consommation, et c'est écrit tel quel au registre.
  {
    name: 'Croisillons 2mm (x200)',
    category: 'tiling',
    unit: 'unit',
    yield_per_unit: 40.5,
    consumption_model: 'tile_spacers',
    packagings: [
      { label: 'Sachet 200 pcs', quantity_per_unit: 1, unit: 'unit' },
    ],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Croisillons 3mm (x200)',
    category: 'tiling',
    unit: 'unit',
    yield_per_unit: 40.5,
    consumption_model: 'tile_spacers',
    packagings: [
      { label: 'Sachet 200 pcs', quantity_per_unit: 1, unit: 'unit' },
    ],
    waste_factors: accessoryWaste(),
  },
  {
    name: 'Croisillons 5mm (x100)',
    category: 'tiling',
    unit: 'unit',
    yield_per_unit: 20.25,
    consumption_model: 'tile_spacers',
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
    // E1-10 — ré-exprimé en kg de mélange : les fiches SEL sous carrelage
    // (PRB CEL CÉRAMIC, Cermix CERMIPROOF ST) publient leur consommation en
    // kg/m² de mélange pour les 2 couches, et se vendent en kit poudre +
    // résine pesé en kg — le litre d'avant ce lot ne correspondait à aucun
    // conditionnement réel. PRB : « 2,5 à 3,5 kg/m² » ; milieu retenu
    // 3 kg/m², soit 0,3333 m²/kg. Kit de 32 kg (PRB CEL CÉRAMIC).
    unit: 'kg',
    yield_per_unit: 0.3333,
    wet_room_system: 'sel',
    packagings: [{ label: 'Kit 32 kg', quantity_per_unit: 32, unit: 'kg' }],
    waste_factors: dosedWaste(),
  },
  {
    name: "Bande d'étanchéité 120mm",
    category: 'tiling',
    unit: 'm',
    // E1-10 — un mètre de bande couvre un mètre de jonction sol/mur : le
    // périmètre au sol, portes déduites. Rouleau de 10 m (Cermix AR12, la
    // bande d'armature des systèmes SEL Cermix) ; le rouleau de 50 m d'avant
    // ce lot ne correspondait à aucune fiche et sort du conditionnement.
    yield_per_unit: 1,
    quantity_driver: 'floor_perimeter',
    wet_room_system: 'sealing_band',
    packagings: [{ label: 'Rouleau 10 m', quantity_per_unit: 10, unit: 'm' }],
    waste_factors: cutAncillaryWaste(),
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
    waste_factors: cutAncillaryWaste(),
  },
  // More tiling
  {
    name: 'Carrelage imitation bois 20x120 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 1.2 m²', quantity_per_unit: 1.2, unit: 'm2' }],
    waste_factors: tileCoveringWaste(),
  },
  {
    name: 'Carrelage imitation pierre 60x60 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Boîte 1.08 m²', quantity_per_unit: 1.08, unit: 'm2' },
    ],
    waste_factors: tileCoveringWaste(),
  },
  {
    name: 'Carrelage extérieur antidérapant 30x30 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 1 m²', quantity_per_unit: 1, unit: 'm2' }],
    waste_factors: tileCoveringWaste(),
  },
  {
    name: 'Plinthe carrelage 8x30 cm',
    category: 'tiling',
    unit: 'm',
    // E1-10 — vendue et posée au mètre le long des murs : périmètre au sol,
    // portes déduites. Les chutes de coupe restent portées par le forfait
    // (`cutAncillaryWaste`) : les morceaux se réutilisent d'un mur à l'autre.
    yield_per_unit: 1,
    quantity_driver: 'floor_perimeter',
    packagings: [{ label: 'Lot de 10 (3 m)', quantity_per_unit: 3, unit: 'm' }],
    waste_factors: cutAncillaryWaste(),
  },
  {
    name: 'Carrelage hexagonal 20cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Boîte 0.98 m²', quantity_per_unit: 0.98, unit: 'm2' },
    ],
    waste_factors: tileCoveringWaste(),
  },
  // Extra tiling
  {
    name: "Primaire d'accrochage carrelage",
    category: 'tiling',
    // E1-10 — ré-exprimé en kg : les fiches primaire (PRB ACCROSOL PLUS,
    // weberprim RP) publient 150 à 300 g/m² et se vendent en jerricans pesés.
    // 0,2 kg/m² retenu, milieu de la plage PRB → 5 m²/kg, la valeur d'avant
    // ce lot à l'unité près (densité PRB 1,05 : le litre et le kilo se
    // confondaient).
    unit: 'kg',
    yield_per_unit: 5,
    substrate_prep: 'leveling_primer',
    packagings: [
      { label: 'Jerrican 1 kg', quantity_per_unit: 1, unit: 'kg' },
      { label: 'Jerrican 5 kg', quantity_per_unit: 5, unit: 'kg' },
    ],
    waste_factors: dosedWaste(),
  },
  {
    name: 'Ragréage autolissant',
    category: 'tiling',
    unit: 'kg',
    // E1-10 — 1,5 kg/m²/mm (PRB PLANIDUR PRO), à l'épaisseur de 3 mm retenue
    // au registre (plancher de la plage « locaux P3, rénovation : 3 à 10 mm »)
    // : 4,5 kg/m², soit 0,2222 m²/kg. Le 0,2 d'avant ce lot supposait une
    // épaisseur de 3,33 mm qu'aucune fiche ne nomme.
    yield_per_unit: 0.2222,
    substrate_prep: 'leveling_compound',
    packagings: [{ label: 'Sac 25 kg', quantity_per_unit: 25, unit: 'kg' }],
    waste_factors: dosedWaste(),
  },
  {
    name: 'Carrelage sol 80x80 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Boîte 1.28 m²', quantity_per_unit: 1.28, unit: 'm2' },
    ],
    waste_factors: tileCoveringWaste(),
  },
  {
    name: 'Carrelage métro 7.5x15 cm',
    category: 'tiling',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 1 m²', quantity_per_unit: 1, unit: 'm2' }],
    waste_factors: tileCoveringWaste(),
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
    waste_factors: tileCoveringWaste(),
  },
  {
    name: 'Mortier de ragréage extérieur',
    category: 'tiling',
    unit: 'kg',
    yield_per_unit: 0.2,
    packagings: [{ label: 'Sac 25 kg', quantity_per_unit: 25, unit: 'kg' }],
    waste_factors: dosedWaste(),
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
    waste_factors: floorCoveringWaste(),
  },
  {
    name: 'Stratifié 8mm AC4',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 2.49 m²', quantity_per_unit: 2.49, unit: 'm2' },
    ],
    waste_factors: floorCoveringWaste(),
  },
  {
    name: 'Stratifié 10mm AC4',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 2.22 m²', quantity_per_unit: 2.22, unit: 'm2' },
    ],
    waste_factors: floorCoveringWaste(),
  },
  {
    name: 'Stratifié 12mm AC5',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 1.48 m²', quantity_per_unit: 1.48, unit: 'm2' },
    ],
    waste_factors: floorCoveringWaste(),
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
    waste_factors: floorCoveringWaste(),
  },
  {
    name: 'Parquet contrecollé chêne 10mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 2.03 m²', quantity_per_unit: 2.03, unit: 'm2' },
    ],
    waste_factors: floorCoveringWaste(),
  },
  {
    name: 'Parquet massif chêne 22mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 1.17 m²', quantity_per_unit: 1.17, unit: 'm2' },
    ],
    waste_factors: floorCoveringWaste(),
  },
  {
    name: 'Parquet bambou 15mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 1.83 m²', quantity_per_unit: 1.83, unit: 'm2' },
    ],
    waste_factors: floorCoveringWaste(),
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
    waste_factors: floorCoveringWaste(),
  },
  {
    name: 'Lame vinyle clipsable 5mm SPC',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 2.22 m²', quantity_per_unit: 2.22, unit: 'm2' },
    ],
    waste_factors: floorCoveringWaste(),
  },
  {
    name: 'Lame vinyle à coller 2.5mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 3.34 m²', quantity_per_unit: 3.34, unit: 'm2' },
    ],
    waste_factors: floorCoveringWaste(),
  },
  {
    name: 'Dalle vinyle 60x60 cm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Boîte 2.16 m²', quantity_per_unit: 2.16, unit: 'm2' },
    ],
    waste_factors: floorCoveringWaste(),
  },
  {
    name: 'Sol PVC en rouleau',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Rouleau (au m²)', quantity_per_unit: 1, unit: 'm2' },
    ],
    waste_factors: floorCoveringWaste(),
  },
  // Underlay
  {
    name: 'Sous-couche mousse 2mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Rouleau 15 m²', quantity_per_unit: 15, unit: 'm2' }],
    waste_factors: cutAncillaryWaste(),
  },
  {
    name: 'Sous-couche mousse 3mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Rouleau 15 m²', quantity_per_unit: 15, unit: 'm2' }],
    waste_factors: cutAncillaryWaste(),
  },
  {
    name: 'Sous-couche liège 2mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Rouleau 10 m²', quantity_per_unit: 10, unit: 'm2' }],
    waste_factors: cutAncillaryWaste(),
  },
  {
    name: 'Sous-couche acoustique 5mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Rouleau 10 m²', quantity_per_unit: 10, unit: 'm2' }],
    waste_factors: cutAncillaryWaste(),
  },
  {
    name: 'Film pare-vapeur PE',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 0.8,
    // E1-8 — le film nu : sa seule fonction est le pare-vapeur, donc sa
    // présence dans un chiffrage est conditionnelle. Le rendement de 0,8 (soit
    // 1,25 m² de film par m² de sol) reste juste : il porte le recouvrement de
    // 20 cm entre lés, qui existe dès lors que le film est posé.
    vapour_barrier: 'dedicated',
    packagings: [{ label: 'Rouleau 20 m²', quantity_per_unit: 20, unit: 'm2' }],
    waste_factors: cutAncillaryWaste(),
  },
  {
    /**
     * E1-8 — la sous-couche qui dispense du film.
     *
     * Elle entre au catalogue pour que `vapour_barrier: 'integrated'` ait un
     * référent réel, et non une colonne que rien ne déclare : E1-7 a retiré la
     * pose en chevrons du carrelage précisément parce qu'une donnée que
     * personne ne peut atteindre ne vaut pas mieux qu'une donnée absente.
     *
     * Référence sourcée : Quick-Step Basic Plus (QSUDLBP15), mousse
     * polyéthylène 2 mm, rouleau de 1,00 × 15 m, « combinée à un pare-vapeur
     * (avec rabat et bande adhésive pour une pose facile) » — même fabricant
     * que la sous-couche mousse déjà sourcée au registre. Pose bord à bord,
     * comme elle : rendement de 1.
     */
    name: 'Sous-couche 2mm avec pare-vapeur intégré',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    vapour_barrier: 'integrated',
    packagings: [{ label: 'Rouleau 15 m²', quantity_per_unit: 15, unit: 'm2' }],
    waste_factors: cutAncillaryWaste(),
  },
  // Skirting & transitions
  {
    // E1-10 — plinthes : vendues et posées au mètre le long des murs, donc au
    // périmètre au sol portes déduites. Barre de 2,40 m — la longueur du
    // commerce, confirmée par la TDS Quick-Step Plinthes (toutes les barres à
    // 240 cm). Chutes réutilisables d'un mur à l'autre : forfait de coupe.
    name: 'Plinthe MDF 60mm 2.4m',
    category: 'flooring',
    unit: 'm',
    yield_per_unit: 1,
    quantity_driver: 'floor_perimeter',
    packagings: [{ label: 'Barre 2.4 m', quantity_per_unit: 2.4, unit: 'm' }],
    waste_factors: cutAncillaryWaste(),
  },
  {
    name: 'Plinthe MDF 80mm 2.4m',
    category: 'flooring',
    unit: 'm',
    yield_per_unit: 1,
    quantity_driver: 'floor_perimeter',
    packagings: [{ label: 'Barre 2.4 m', quantity_per_unit: 2.4, unit: 'm' }],
    waste_factors: cutAncillaryWaste(),
  },
  {
    name: 'Plinthe chêne 70mm 2.4m',
    category: 'flooring',
    unit: 'm',
    yield_per_unit: 1,
    quantity_driver: 'floor_perimeter',
    packagings: [{ label: 'Barre 2.4 m', quantity_per_unit: 2.4, unit: 'm' }],
    waste_factors: cutAncillaryWaste(),
  },
  {
    // E1-10 — une barre par passage de porte (largeur standard 83 cm ≤ 93 cm).
    // La perte est à 0/0/0 : une barre se compte, elle ne se gâche pas au
    // pourcentage — 10 % sur une barre en achèteraient deux par arrondi.
    name: 'Barre de seuil alu 93cm',
    category: 'flooring',
    unit: 'unit',
    yield_per_unit: 1,
    quantity_driver: 'door_count',
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: countedUnitWaste(),
  },
  {
    name: 'Barre de seuil alu 180cm',
    category: 'flooring',
    unit: 'unit',
    yield_per_unit: 1,
    quantity_driver: 'door_count',
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    waste_factors: countedUnitWaste(),
  },
  {
    name: 'Profilé de jonction 2.7m',
    category: 'flooring',
    unit: 'm',
    yield_per_unit: 1,
    packagings: [{ label: 'Barre 2.7 m', quantity_per_unit: 2.7, unit: 'm' }],
    waste_factors: cutAncillaryWaste(),
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
    waste_factors: dosedWaste(),
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
    waste_factors: floorCoveringWaste(),
  },
  {
    name: 'Sous-couche fibre de bois 5mm',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Paquet 7 m²', quantity_per_unit: 7, unit: 'm2' }],
    waste_factors: cutAncillaryWaste(),
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
    waste_factors: dosedWaste(),
  },
  {
    name: 'Moquette aiguilletée',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Rouleau (au m²)', quantity_per_unit: 1, unit: 'm2' },
    ],
    waste_factors: floorCoveringWaste(),
  },
  {
    name: 'Jonc de mer',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Rouleau (au m²)', quantity_per_unit: 1, unit: 'm2' },
    ],
    waste_factors: floorCoveringWaste(),
  },
  {
    name: 'Sisal naturel',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Rouleau (au m²)', quantity_per_unit: 1, unit: 'm2' },
    ],
    waste_factors: floorCoveringWaste(),
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
    // E1-10 — 1,5 kg/m²/mm (PRB PLANIFIBRE, planchers bois DTU 51.3), à
    // l'épaisseur de 3 mm retenue au registre : 4,5 kg/m², soit 0,2222 m²/kg.
    yield_per_unit: 0.2222,
    substrate_prep: 'leveling_compound',
    packagings: [{ label: 'Sac 25 kg', quantity_per_unit: 25, unit: 'kg' }],
    waste_factors: dosedWaste(),
  },
  {
    name: "Primaire d'accrochage sol",
    category: 'flooring',
    // E1-10 — même ré-expression en kg que le primaire carrelage : fiches en
    // g/m², jerricans pesés (PRB ACCROSOL PLUS).
    unit: 'kg',
    yield_per_unit: 5,
    substrate_prep: 'leveling_primer',
    packagings: [
      { label: 'Jerrican 1 kg', quantity_per_unit: 1, unit: 'kg' },
      { label: 'Jerrican 5 kg', quantity_per_unit: 5, unit: 'kg' },
    ],
    waste_factors: dosedWaste(),
  },
  {
    name: 'Lame PVC adhésive',
    category: 'flooring',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 2.08 m²', quantity_per_unit: 2.08, unit: 'm2' },
    ],
    waste_factors: floorCoveringWaste(),
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
    // E1-8 : un montant est coupé à la hauteur de la cloison, et la chute ne se
    // raboute pas. Une barre = un montant tant que la hauteur dépasse la moitié
    // de la barre, ce qui est le cas de tout plafond habitable.
    offcuts_reusable: false,
    packagings: [{ label: 'Barre 2.7 m', quantity_per_unit: 2.7, unit: 'm' }],
    waste_factors: measuredOffcutWaste(),
  },
  {
    name: 'Montant M70 2.7m',
    category: 'partition',
    unit: 'm',
    yield_per_unit: 1,
    quantity_driver: 'frame_stud',
    offcuts_reusable: false,
    packagings: [{ label: 'Barre 2.7 m', quantity_per_unit: 2.7, unit: 'm' }],
    waste_factors: measuredOffcutWaste(),
  },
  {
    name: 'Montant M90 2.7m',
    category: 'partition',
    unit: 'm',
    yield_per_unit: 1,
    quantity_driver: 'frame_stud',
    offcuts_reusable: false,
    packagings: [{ label: 'Barre 2.7 m', quantity_per_unit: 2.7, unit: 'm' }],
    waste_factors: measuredOffcutWaste(),
  },
  // Insulation
  {
    name: 'Laine de verre 45mm',
    category: 'partition',
    unit: 'm2',
    // E1-10 — la fiche solution Placostil 72/48 compte 1,05 m² d'isolant par
    // m² de cloison (ligne « M2 — 1,05 » du quantitatif, isolant « Laine de
    // verre, 45 mm ») : 1/1,05 = 0,9524. Une seule trame quel que soit le
    // nombre de faces : la laine se pose entre les montants, pas sur chaque
    // parement — d'où `work_surface` et non `clad_faces`.
    yield_per_unit: 0.9524,
    packagings: [
      { label: 'Rouleau 9.6 m²', quantity_per_unit: 9.6, unit: 'm2' },
    ],
    waste_factors: partitionWaste(),
  },
  {
    // E1-10 — bande résiliente : collée sous les rails (« La bande résiliente
    // (grise) se colle sous les rails », Knauf, Accessoires pour cloisons),
    // en course continue et aboutable — exactement l'assiette du rail. Un
    // mètre de bande couvre un mètre de lisse : identité, comme le rail.
    // Largeur 50 mm pour le rail de 48, rouleau de 30 ml (Knauf).
    name: 'Bande résiliente 50mm',
    category: 'partition',
    unit: 'm',
    yield_per_unit: 1,
    quantity_driver: 'frame_runner',
    packagings: [{ label: 'Rouleau 30 m', quantity_per_unit: 30, unit: 'm' }],
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
    // hauteur. Même assiette que les montants — et même découpe à longueur.
    quantity_driver: 'frame_stud',
    offcuts_reusable: false,
    packagings: [{ label: 'Barre 3 m', quantity_per_unit: 3, unit: 'm' }],
    waste_factors: measuredOffcutWaste(),
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
    waste_factors: wallpaperStripWaste(),
  },
  {
    name: 'Papier peint intissé à motif',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    ...standardWallpaperRoll(),
    waste_factors: wallpaperStripWaste(),
  },
  {
    name: 'Papier peint vinyle expansé',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    ...standardWallpaperRoll(),
    waste_factors: wallpaperStripWaste(),
  },
  {
    name: 'Papier peint vinyle sur intissé',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    ...standardWallpaperRoll(),
    waste_factors: wallpaperStripWaste(),
  },
  {
    name: 'Papier peint traditionnel',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    ...standardWallpaperRoll(),
    waste_factors: wallpaperStripWaste(),
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
    waste_factors: cutAncillaryWaste(),
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
    waste_factors: dosedWaste(),
  },
  {
    name: 'Colle papier peint vinyle',
    category: 'wall_covering',
    unit: 'kg',
    yield_per_unit: 30,
    packagings: [{ label: 'Seau 5 kg', quantity_per_unit: 5, unit: 'kg' }],
    waste_factors: dosedWaste(),
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
    waste_factors: dosedWaste(),
  },
  {
    name: 'Colle papier peint renforcée (heavy)',
    category: 'wall_covering',
    unit: 'kg',
    yield_per_unit: 30,
    packagings: [{ label: 'Seau 5 kg', quantity_per_unit: 5, unit: 'kg' }],
    waste_factors: dosedWaste(),
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
    waste_factors: wallpaperStripWaste(),
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
    waste_factors: cutAncillaryWaste(),
  },
  {
    name: 'Toile de verre chevron',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Rouleau 25 m²', quantity_per_unit: 25, unit: 'm2' }],
    waste_factors: cutAncillaryWaste(),
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
    waste_factors: cutAncillaryWaste(),
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
    waste_factors: cutAncillaryWaste(),
  },
  {
    name: 'Lambris PVC couleur 2.6m',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 3.9 m²', quantity_per_unit: 3.9, unit: 'm2' },
    ],
    waste_factors: cutAncillaryWaste(),
  },
  {
    name: 'Lambris bois brut 2m',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 2.5 m²', quantity_per_unit: 2.5, unit: 'm2' },
    ],
    waste_factors: cutAncillaryWaste(),
  },
  {
    name: 'Lambris MDF 2.6m',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Paquet 3.9 m²', quantity_per_unit: 3.9, unit: 'm2' },
    ],
    waste_factors: cutAncillaryWaste(),
  },
  {
    name: 'Parement pierre naturelle',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 0.5 m²', quantity_per_unit: 0.5, unit: 'm2' }],
    waste_factors: cutAncillaryWaste(),
  },
  {
    name: 'Parement brique',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [{ label: 'Boîte 0.5 m²', quantity_per_unit: 0.5, unit: 'm2' }],
    waste_factors: cutAncillaryWaste(),
  },
  {
    name: 'Panneau mural 3D',
    category: 'wall_covering',
    unit: 'm2',
    yield_per_unit: 1,
    packagings: [
      { label: 'Panneau 0.25 m²', quantity_per_unit: 0.25, unit: 'm2' },
    ],
    waste_factors: cutAncillaryWaste(),
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
    waste_factors: cutAncillaryWaste(),
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
    waste_factors: dosedWaste(),
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
    waste_factors: wallpaperStripWaste(),
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
