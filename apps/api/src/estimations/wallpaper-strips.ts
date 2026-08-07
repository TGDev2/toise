/**
 * E1-6 — ce qu'un rouleau de revêtement mural donne réellement.
 *
 * D'où vient ce module. `wall_covering` était chiffré au mètre carré : le
 * catalogue annonçait un rouleau « 10.05m x 0.53m (~5.3 m²) » et le moteur
 * divisait la surface murale par 5,3. Or **un rouleau ne rend jamais 5,3 m²
 * utiles**. Il rend un nombre *entier* de lés, dont la longueur est la hauteur
 * sous plafond augmentée du raccord de motif et d'une marge de coupe ; ce qui
 * reste en bout de bobine est perdu. Et **un lé ne tourne pas un angle** : la
 * dernière laize de chaque pan s'arrondit au lé entier, sa chute ne recommence
 * pas sur le mur d'à côté.
 *
 * Le défaut était invisible à l'écran et visible sur le dernier mur : sur la
 * chambre de référence (4 × 3 m, une porte), le moteur annonçait 7 rouleaux à
 * 2,50 m sous plafond là où la découpe en demande 10, et 8 à 2,60 m là où elle
 * en demande 10 également.
 *
 * Ce que ce module porte, et ce qu'il ne porte pas
 * ------------------------------------------------
 * Il porte la **loi de découpe**. Il ne porte **aucune dimension de rouleau** :
 * celles-ci vivent dans `materials_catalog.roll_width_cm` / `roll_length_cm`,
 * parce que le catalogue contient déjà des conditionnements différents — papiers
 * peints en 10,05 × 0,53 m, papier d'apprêt en 10 × 0,50 m. Une constante de
 * moteur aurait chiffré le second comme le premier.
 *
 *     lé              = hauteur + raccord + marge de coupe
 *     lés par rouleau = ⌊ longueur du rouleau / lé ⌋          (entier)
 *     lés nécessaires = Σ_pans ⌈ longueur du pan / largeur ⌉  (pan par pan)
 *     rouleaux        = lés nécessaires / lés par rouleau
 *
 * Le résultat est volontairement **fractionnaire** : la mutualisation ENG-2
 * additionne les besoins de toutes les pièces avant de choisir l'achat, et un
 * compte entier par pièce ferait racheter un rouleau à chaque pièce. C'est
 * `selectBestPackaging` qui arrondit, une seule fois, sur le total.
 *
 * Limite assumée de ce choix : deux pièces de **hauteurs différentes** n'ont pas
 * des lés interchangeables, alors que leurs rouleaux fractionnaires, eux,
 * s'additionnent. L'achat mutualisé peut donc valoir un rouleau de moins que la
 * somme des besoins réels. Sans effet à hauteur égale — le cas courant, et celui
 * du harnais. Le corriger demanderait de mutualiser par hauteur, ce qui n'a de
 * sens que le jour où deux pièces d'un même projet porteront deux hauteurs.
 *
 * Ce qui n'est pas déduit, et pourquoi
 * ------------------------------------
 * Ni les ouvertures, ni les zones exclues (ENG-3) ne réduisent le nombre de lés.
 * Le lé au-dessus d'une porte se coupe dans un lé entier et sa chute ne fait pas
 * un second lé ; c'est la règle de tous les guides de pose, et elle penche du
 * côté sûr — un fond de rouleau se garde, un second aller-retour au magasin ne
 * se rattrape pas. Conséquence à connaître : le nombre de lés d'un mur ne dépend
 * que de sa longueur, jamais de ce qui le perce.
 *
 * Sources
 * -------
 * Toutes consultées le 2026-08-07, URL au registre `docs/SOURCES_CATALOGUE.md`.
 *
 * **Rouleau standard.** Bricoflor : « Un rouleau de papier peint de taille
 * standard en Europe présente une longueur de 10,05 mètres. La largeur de lés
 * est de 0,53 m. »
 *
 * **Marge de coupe, 10 cm.** Bricoflor : « Vous pouvez ajouter 10 cm
 * supplémentaires à la hauteur, soit 5 cm en haut et en bas pour des finitions
 * plus propres. » ; sol-peinture.fr : « Hauteur sous plafond + 10 cm (5 cm en
 * haut et 5 cm en bas) pour les coupes d'arasement. » ; ManoMano : « pour une
 * pièce mesurant 2,5 m de haut le calcul sera donc : 10 ÷ (2,5 + 0,10) ».
 *
 * **Longueur d'un lé, raccord compris.** sol-peinture.fr publie la formule :
 * « L_lé-coupé = H_mur + M_sécurité + R_raccord ». Bricoflor : « Additionnez le
 * raccord du papier peint avec la hauteur de votre mur. »
 *
 * C'est la forme **sûre** du raccord droit, et pas la forme exacte. Le rigoureux
 * serait `⌈(hauteur + marge) / raccord⌉ × raccord`, qui vaut ici 3,20 m à 2,60 m
 * de lé utile et 64 cm de raccord, contre 3,24 m retenus. La forme retenue
 * majore d'au plus la fraction de raccord perdue avant le premier point de
 * départ utilisable du rouleau — perte réelle, dont on ne sait pas où elle tombe
 * tant que la bobine n'est pas déroulée.
 *
 * **Découpe pan par pan.** Aucun fabricant ne la publie : c'est une règle de
 * métier, au même titre que les `waste_factors`, et elle est étiquetée comme
 * telle au registre. Bricoflor traite bien chaque mur séparément dans ses
 * exemples chiffrés. La raison physique se suffit : un lé est une bande rigide
 * de largeur fixe, la chute de bout de mur n'a pas la largeur d'un lé.
 */

/**
 * Conditionnement d'un matériau vendu au rouleau, en centimètres — les deux
 * colonnes `materials_catalog.roll_width_cm` / `roll_length_cm`.
 *
 * En centimètres, et non en mètres, pour une raison de calcul et pas de goût :
 * toutes les grandeurs de la découpe viennent de saisies en centimètres entiers
 * (hauteur de pièce, raccord, marge), si bien que `⌊1005 / 250⌋` et
 * `⌈400 / 53⌉` se calculent sur des entiers exactement représentables. En
 * mètres, `10.05 / 2.5` traînerait une dérive flottante à l'endroit précis où
 * une partie entière décide d'un rouleau.
 */
export interface RollSpec {
  width_cm: number;
  length_cm: number;
}

/** Le détail d'une découpe, tel que le moteur et les tests le lisent. */
export interface StripCut {
  /** Hauteur + raccord + marge, en cm. */
  strip_length_cm: number;
  /** Lés entiers tirés d'un rouleau. Toujours ≥ 1. */
  strips_per_roll: number;
  /** `Σ_pans ⌈longueur du pan / largeur du rouleau⌉`. */
  strips_needed: number;
  /** Lés nécessaires par lés par rouleau — **fractionnaire**, cf. en-tête. */
  rolls: number;
  /** `largeur × longueur`, en m². La surface d'un rouleau, chute comprise. */
  roll_area_m2: number;
  /** `rolls × roll_area_m2` : le papier à acheter, en m². */
  paper_m2: number;
}

const CM2_TO_M2 = 10_000;

/**
 * Raccord retenu quand l'ouvrage ne répond pas : un uni, donc aucun. C'est la
 * valeur qui reconduit le comportement d'un papier sans motif, et la première
 * option de la question.
 */
export const DEFAULT_PATTERN_REPEAT_CM = 0;

/**
 * Marge de coupe retenue quand l'ouvrage ne répond pas : 5 cm en haut, 5 cm en
 * bas. Trois guides de pose indépendants donnent la même valeur (cf. sources en
 * tête de module). La question est facultative précisément parce que ce défaut
 * est une constante du métier et non une décision de chantier.
 */
export const DEFAULT_CUT_MARGIN_CM = 10;

/**
 * Tolérance sur le nombre de laizes d'un pan. Même rôle et même valeur que
 * `SPAN_EPSILON` dans le moteur : sans elle, un pan dont la longueur est un
 * multiple exact de la largeur du lé pourrait, sur une dimension non entière,
 * réclamer un lé de trop. 1e-9 lé vaut moins d'un micron de mur.
 */
const STRIP_EPSILON = 1e-9;

/** Lecture tolérante d'un paramètre d'ouvrage exprimé en centimètres. */
const readCm = (answered: unknown, fallback: number): number => {
  if (answered === undefined || answered === null || answered === '') {
    return fallback;
  }
  const value = Number(answered);
  // `>= 0` et non `> 0` : zéro est une réponse licite pour les deux paramètres
  // — un uni n'a pas de raccord, et une marge nulle est ce que suppose
  // l'arithmétique d'un calepinage théorique.
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

/** Hauteur de raccord de motif saisie, en cm. Absente ou illisible → uni. */
export function resolvePatternRepeatCm(
  customParams: Record<string, unknown>,
): number {
  return readCm(customParams.pattern_repeat_cm, DEFAULT_PATTERN_REPEAT_CM);
}

/** Marge de coupe saisie, en cm. Absente ou illisible → 10 cm. */
export function resolveCutMarginCm(
  customParams: Record<string, unknown>,
): number {
  return readCm(customParams.cut_margin_cm, DEFAULT_CUT_MARGIN_CM);
}

/**
 * Lés entiers tirés d'un rouleau. C'est **la** partie entière qui fait tout le
 * lot : à 2,50 m sous plafond sans marge, 10,05 / 2,50 donne exactement 4 lés et
 * le calcul surfacique tombait juste par coïncidence ; 10 cm de marge plus loin
 * il n'en donne plus que 3, et le calcul surfacique se met à sous-compter de
 * 30 %.
 *
 * Zéro lé — un lé plus long que le rouleau — lève plutôt que de diviser par
 * zéro : il n'existe aucune quantité juste à renvoyer, et un `Infinity` qui
 * traverserait le moteur ressortirait en nombre de rouleaux illisible.
 */
export function stripsPerRoll(roll: RollSpec, stripLengthCm: number): number {
  const count = Math.floor(roll.length_cm / stripLengthCm);
  if (!Number.isFinite(count) || count < 1) {
    throw new Error(
      `Un rouleau de ${roll.length_cm / 100} m ne donne aucun lé de ` +
        `${stripLengthCm / 100} m (hauteur + raccord + marge de coupe).`,
    );
  }
  return count;
}

/**
 * Lés nécessaires pour couvrir ces pans — **pan par pan**, et non sur leur
 * somme. Sur le séjour en L de référence, 18,00 m de périmètre donneraient 34
 * lés de 0,53 m ; les six pans réels en demandent 36.
 */
export function stripsNeeded(wallRunsCm: number[], roll: RollSpec): number {
  return wallRunsCm.reduce(
    (total, runCm) =>
      total + Math.max(0, Math.ceil(runCm / roll.width_cm - STRIP_EPSILON)),
    0,
  );
}

/**
 * La découpe complète d'un ouvrage : ce qu'il faut de lés, ce qu'un rouleau en
 * donne, et le papier à acheter.
 *
 * `wallRunsCm` vient de `unionWallRunsCm` (assiette dérivée de la pièce) ou du
 * linéaire déclaré de l'ouvrage — le moteur décide, ce module ne connaît que des
 * longueurs de mur.
 */
export function computeStripCut(
  wallRunsCm: number[],
  wallHeightCm: number,
  roll: RollSpec,
  customParams: Record<string, unknown>,
): StripCut {
  const stripLengthCm =
    wallHeightCm +
    resolvePatternRepeatCm(customParams) +
    resolveCutMarginCm(customParams);

  const perRoll = stripsPerRoll(roll, stripLengthCm);
  const needed = stripsNeeded(wallRunsCm, roll);
  const rollAreaM2 = (roll.width_cm * roll.length_cm) / CM2_TO_M2;
  const rolls = needed / perRoll;

  return {
    strip_length_cm: stripLengthCm,
    strips_per_roll: perRoll,
    strips_needed: needed,
    rolls,
    roll_area_m2: rollAreaM2,
    paper_m2: rolls * rollAreaM2,
  };
}
