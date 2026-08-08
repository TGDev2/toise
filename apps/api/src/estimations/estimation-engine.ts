import { Injectable } from '@nestjs/common';
import {
  EstimationLineItem,
  AggregatedMaterialLine,
  PurchaseContribution,
} from './entities/estimation-result.entity';
import {
  RectSegment,
  unionAreaCm2,
  unionPerimeterCm,
  unionWallRunsCm,
} from './room-geometry';
import { POSE_UNIQUE, resolveLayingPose } from './pose-types';
// Types seuls : aucune dépendance d'exécution du moteur vers TypeORM. Ils sont
// importés plutôt que redéclarés parce qu'ils décident de quantités — deux
// définitions qui divergeraient produiraient un chiffrage faux sans rien casser.
import type {
  MaterialQuantityDriver,
  TileConsumptionModel,
  VapourBarrierRole,
  WetRoomRole,
  SubstratePrep,
} from '../materials/entities/material-catalog.entity';
import type { FrameSpec } from '../projects/entities/work-type.entity';
import { tileConsumptionFactor } from './tile-consumption';
import { computeStripCut, RollSpec, StripCut } from './wallpaper-strips';
import { resolveVapourBarrier } from './vapour-barrier';
import { buildMaterialJustification } from './material-justification';
import { resolveWetRoom } from './wet-room';
import { resolveFloorPrep } from './floor-prep';
import { computePieceCut, PieceCut, PieceDemand } from './piece-cutting';
import type { MaterialExclusion } from './entities/estimation-result.entity';

export type {
  MaterialQuantityDriver,
  TileConsumptionModel,
  VapourBarrierRole,
  WetRoomRole,
  SubstratePrep,
  FrameSpec,
};
export type { RollSpec, StripCut };

export interface SurfaceExclusionInput {
  surface_target: string;
  area_m2: number;
}

export interface RoomData {
  length_cm: number;
  width_cm: number;
  height_cm: number;
  /**
   * E1-10 — `type` distingue les portes des fenêtres, parce que deux assiettes
   * en dépendent : le périmètre au sol déduit les passages de porte (une
   * plinthe ne traverse pas une porte) et `door_count` les compte (une barre
   * de seuil par passage). Absent = `'door'` : seul le chemin public sans
   * authentification peut omettre le type, l'ouverture unique typique d'une
   * pièce est sa porte, et le sens de l'erreur résiduelle — une fenêtre
   * comptée porte — coûte une barre de seuil en trop et quelques décimètres de
   * plinthe en moins, jamais l'inverse silencieux.
   */
  openings: {
    width_cm: number;
    height_cm: number;
    count: number;
    type?: 'door' | 'window';
  }[];
  /**
   * Décomposition en rectangles d'une pièce non rectangulaire (L, T, U…).
   * Absent ou vide → la pièce est un simple rectangle `length_cm × width_cm`.
   */
  segments?: RectSegment[];
  /**
   * Zones non traitées à déduire d'une surface (ENG-3 : crédence, demi-mur,
   * plinthes…). Déduction manuelle d'une aire, filtrée par `surface_target`.
   */
  exclusions?: SurfaceExclusionInput[];
  /**
   * Incertitude de mesure (cm) par dimension (CV-5), absente/0 pour une
   * pièce sans incertitude connue (saisie manuelle, ou legacy). Pilote la
   * fourchette basse/haute des surfaces et quantités — cf. `computeSurfaceBounds`.
   */
  length_cm_uncertainty?: number;
  width_cm_uncertainty?: number;
  height_cm_uncertainty?: number;
}

export interface SurfaceBounds {
  low: number;
  high: number;
}

export interface PackagingInput {
  label: string;
  quantity_per_unit: number;
  unit: string;
  /**
   * E1-9 — prix d'**un contenant** de ce format, en euros. Absent = inconnu.
   *
   * Sa présence sur **tous** les formats d'un matériau — et sur tous, pas sur
   * quelques-uns — bascule le choix d'achat du nombre de contenants vers le
   * coût total (`selectBestPackaging`). Un prix partiel ne bascule rien : il
   * ferait comparer un coût connu à un coût supposé, ce qui est pire que de ne
   * pas comparer.
   *
   * Aucune table ne le porte aujourd'hui : ni `materials_catalog` ni
   * `material_packaging` n'ont de colonne de prix, et les prix marchands vivent
   * dans le cache fournisseur, **en aval** de l'estimation
   * (`price-comparison/`). Ce champ est donc le point d'entrée à brancher le
   * jour où un prix remonte jusqu'au moteur, et le mode coût est éprouvé par
   * `packaging-objective.spec.ts` sans être alimenté en production.
   */
  unit_price?: number;
}

export interface WasteFactorInput {
  pose_type: string;
  skill_level: string;
  factor_percent: number;
  /**
   * Origine de la valeur. Absente = catalogue. `learned` marque une valeur
   * recalculée sur les achats réels (DATA-3), superposée au catalogue par
   * `overlayLearnedWasteFactors` avant l'appel au moteur.
   */
  source?: 'catalog' | 'learned';
}

export interface MaterialInput {
  id: string;
  name: string;
  unit: string;
  yield_per_unit: number;
  /**
   * E1-11 — d'où vient `yield_per_unit` (`materials_catalog.source_*`).
   * Miroir en lecture seule : le moteur ne les inspecte pas pour calculer une
   * quantité, il les recopie sur la ligne pour que la justification affichée
   * puisse être composée une fois, côté réponse API
   * (`estimations/material-justification.ts`). `source_manufacturer` absent
   * = rendement définitionnel, comme le défaut de la colonne.
   */
  source_manufacturer?: string | null;
  source_product?: string | null;
  source_url?: string | null;
  source_consulted_on?: string | null;
  source_basis_fr?: string | null;
  /**
   * E1-4 — la quantité de ce matériau est proportionnelle au nombre de couches
   * (`custom_params.number_of_coats`). Porté par le catalogue
   * (`materials_catalog.applies_coats`), jamais déduit de la catégorie de
   * l'ouvrage : une peinture et le pinceau qui l'applique sont tous deux des
   * matériaux `painting`, seule la première se multiplie par les couches.
   *
   * Absent = `false`, comme le défaut de la colonne : un appel qui ne renseigne
   * pas l'attribut ne fait pas de couches.
   */
  applies_coats?: boolean;
  /**
   * Rôle porté par la liaison ouvrage → matériau (E1-3). Absent pour les
   * appels qui ne passent pas par `work_type_materials` (tests legacy). Le
   * moteur ne s'en sert pas encore pour les quantités (E1-4) ; il permet déjà
   * d'exclure les accessoires de la fourchette de référence d'un devis.
   */
  role?: 'principal' | 'sous_couche' | 'consommable' | 'accessoire';
  /**
   * E1-3 — sur quoi ce matériau se métré, donc dans quelle unité
   * `yield_per_unit` est exprimé. Absent = `work_surface`, comme le défaut de
   * la colonne : un appel qui ne renseigne pas l'attribut se métre sur la
   * surface d'ouvrage, exactement comme avant E1-3.
   *
   * C'est ce champ qui distingue le parement de l'ossature. Le moteur ne
   * regarde jamais `work_type_code` pour en décider.
   */
  quantity_driver?: MaterialQuantityDriver;
  /**
   * E1-5 — loi qui fait varier la consommation de ce matériau avec la géométrie
   * du carreau posé (`materials_catalog.consumption_model`). Absent = aucune :
   * `yield_per_unit` vaut tel quel, exactement comme avant E1-5. Quand elle est
   * présente, `yield_per_unit` est le rendement à la **géométrie de référence**
   * du modèle et le moteur en dérive le rendement effectif — cf.
   * `resolveEffectiveYield`.
   */
  consumption_model?: TileConsumptionModel | null;
  /**
   * E1-6 — dimensions du rouleau dans lequel ce matériau se débite
   * (`materials_catalog.roll_width_cm` / `roll_length_cm`). Absent = aucun :
   * la quantité se calcule sur `yield_per_unit`, exactement comme avant E1-6.
   *
   * Présent, il **remplace** `yield_per_unit` : la quantité vient alors de la
   * découpe en lés (`wallpaper-strips.ts`), qui dépend de la hauteur sous
   * plafond, du raccord de motif et de la longueur des pans de mur — trois
   * grandeurs qu'aucun rendement au mètre carré ne peut porter.
   */
  roll_spec?: RollSpec | null;
  /**
   * E1-8 — rôle vis-à-vis du pare-vapeur (`materials_catalog.vapour_barrier`).
   * Absent = aucun, comme le défaut de la colonne.
   *
   * C'est le seul attribut de matériau qui décide de la **présence** d'une
   * ligne et non de sa quantité : un matériau `dedicated` n'est chiffré que si
   * l'ouvrage a besoin d'un pare-vapeur et qu'aucun matériau `integrated` ne
   * l'apporte déjà — cf. `vapour-barrier.ts`.
   */
  vapour_barrier?: VapourBarrierRole | null;
  /**
   * E1-8 — les chutes de ce matériau se réutilisent-elles bout à bout
   * (`materials_catalog.offcuts_reusable`) ? Absent = `true`, comme le défaut
   * de la colonne : un appel qui ne renseigne pas l'attribut se compte au
   * linéaire, exactement comme avant E1-8.
   *
   * `false` **remplace** la division par la longueur de barre par un comptage
   * de pièces (`piece-cutting.ts`), au même titre que `roll_spec` remplace
   * `yield_per_unit`. Le matériau doit alors se métrer sur une assiette qui se
   * décompose en pièces — sinon le moteur lève.
   */
  offcuts_reusable?: boolean;
  /**
   * E1-10 — rôle vis-à-vis du système d'étanchéité d'un local exposé à l'eau
   * (`materials_catalog.wet_room_system`). Absent = aucun, comme le défaut de
   * la colonne. Un matériau marqué n'est chiffré que si le local est déclaré
   * salle d'eau — cf. `wet-room.ts`.
   */
  wet_room_system?: WetRoomRole | null;
  /**
   * E1-10 — rôle vis-à-vis de la préparation d'un sol non plan
   * (`materials_catalog.substrate_prep`). Absent = aucun, comme le défaut de
   * la colonne. Un matériau marqué n'est chiffré que si la planéité déclarée
   * l'exige — cf. `floor-prep.ts`.
   */
  substrate_prep?: SubstratePrep | null;
  waste_factors: WasteFactorInput[];
  packagings: PackagingInput[];
}

/**
 * E1-3 — assiette **saisie** d'un ouvrage qu'on crée plutôt qu'on ne recouvre
 * (`project_work_items.declared_*`). Sa présence sur un `WorkItemInput` est ce
 * qui fait basculer le moteur : plus rien n'est dérivé de la géométrie de la
 * pièce, ni la surface, ni les ouvertures, ni les zones exclues — elles
 * décrivent les murs existants, pas la cloison qu'on dresse.
 */
export interface DeclaredWorkBasis {
  /** Linéaire d'ouvrage à créer, en mètres. */
  length_m: number;
  /** Hauteur de l'ouvrage, en mètres. Jamais celle de la pièce par défaut. */
  height_m: number;
  /** Faces à parementer : 2 pour une cloison, 1 pour un doublage. */
  clad_faces: number;
}

/** Ce que la trame d'un ouvrage demande réellement (E1-3). */
export interface FrameQuantities {
  /** `ceil(longueur / entraxe) + 1 + montants déclarés`. */
  stud_count: number;
  /**
   * E1-8 — longueur d'**un** montant, en mètres : la hauteur de l'ouvrage.
   *
   * Portée explicitement plutôt que redivisée depuis `stud_length_m`, parce
   * qu'elle décide d'un achat : c'est elle qui dit combien de montants tiennent
   * dans une barre. Une grandeur qui décide d'un achat se lit, elle ne se
   * reconstitue pas.
   */
  stud_piece_length_m: number;
  /** `stud_count × stud_piece_length_m`, en mètres. */
  stud_length_m: number;
  /** `runner_courses × longueur`, en mètres. */
  runner_length_m: number;
}

/**
 * Les assiettes d'un ouvrage sur une pièce, calculées une fois pour tous ses
 * matériaux. C'est ici, et nulle part ailleurs, que se joue le piège du métré
 * plâtrerie : `clad_surface_m2` porte le nombre de faces, `frame` ne le porte
 * pas. Une cloison de 4 ml parementée deux faces a deux peaux de plaques et une
 * seule trame de rails et de montants.
 */
export interface WorkBasis {
  /** Surface d'ouvrage nette, m². Dérivée de la pièce ou déclarée. */
  work_surface_m2: number;
  /** Avant déduction des ouvertures et des zones exclues, m². */
  gross_surface_m2: number;
  /** Aire retirée par les zones exclues (ENG-3), m². */
  excluded_surface_m2: number;
  /** `work_surface_m2 × clad_faces`, m². */
  clad_surface_m2: number;
  /** Faces à parementer. 1 pour un ouvrage de recouvrement. */
  clad_faces: number;
  /** `null` quand l'ouvrage ne déclare pas de trame. */
  frame: FrameQuantities | null;
  /**
   * E1-6 — les pans de mur à couvrir, un par mur et en cm, ou `null` quand
   * l'ouvrage ne se pose pas sur des murs (sol, plafond).
   *
   * Le **détail** et non la somme : un revêtement posé en lés arrondit sa
   * dernière laize au lé entier sur chaque pan, et compter sur le périmètre
   * total sous-compte systématiquement les pièces à plusieurs pans. Les
   * ouvertures ne sont pas déduites — cf. `wallpaper-strips.ts`.
   */
  wall_runs_cm: number[] | null;
  /**
   * Hauteur des pans ci-dessus, en cm : celle de la pièce, ou celle que
   * l'ouvrage déclare. Portée par l'assiette pour que les bornes d'incertitude
   * (CV-5) rejouent le même calcul sur la hauteur haute et la hauteur basse
   * sans que le moteur ait à retrouver la pièce.
   */
  wall_height_cm: number;
  /**
   * E1-10 — linéaire du contour au sol de la pièce, **portes déduites**, en
   * mètres, clampé à ≥ 0. Plinthes, joints périphériques, bandes de jonction
   * sol/mur. Le périmètre vient de `unionPerimeterCm` (exact pour toute forme
   * rectilinéaire), la déduction des seules ouvertures `type = 'door'`.
   *
   * `null` quand l'ouvrage déclare son assiette : une cloison créée n'a pas de
   * contour au sol, et un matériau qui s'y métré doit échouer bruyamment
   * plutôt que recevoir un zéro silencieux — cf. `meteringBase`.
   */
  floor_perimeter_m: number | null;
  /**
   * E1-10 — nombre de passages de porte de la pièce (somme des `count` des
   * ouvertures `type = 'door'`). Barres de seuil. `null` en assiette déclarée,
   * pour la même raison que `floor_perimeter_m`.
   */
  door_count: number | null;
}

/**
 * L'assiette d'un matériau donné, dans l'unité de son `yield_per_unit`, et —
 * quand l'ouvrage la connaît — sa **décomposition en pièces identiques**
 * (E1-8). C'est cette décomposition, et elle seule, qui permet à un matériau
 * non aboutable de se compter au lieu de se diviser.
 */
interface MeteringBase {
  quantity: number;
  pieces?: PieceDemand;
}

export interface WorkItemInput {
  id: string;
  work_type_code: string;
  work_type_label: string;
  /**
   * Famille de l'ouvrage, conservée pour la traçabilité de l'entrée et les
   * appelants qui la portent déjà. Le moteur ne l'utilise plus pour aucun
   * calcul depuis E1-4 : les règles de quantité sont portées par le matériau
   * (`MaterialInput.applies_coats`), jamais déduites de cette valeur.
   */
  category: string;
  /**
   * Surface de la pièce sur laquelle l'ouvrage se chiffre. Lue **uniquement**
   * quand l'assiette est dérivée de la pièce : un ouvrage à assiette déclarée
   * n'en fait plus rien.
   */
  surface_target: string;
  skill_level: string;
  /**
   * E1-3 — assiette saisie. Sa **présence** dit `quantity_basis = 'declared'` ;
   * son absence, `room_surface`. Un seul champ, donc pas d'état où l'ouvrage se
   * dit déclaré sans porter sa déclaration : c'est ce qui rend impossible le
   * repli silencieux sur le périmètre de la pièce, le défaut que ce lot corrige.
   */
  declared_basis?: DeclaredWorkBasis;
  /**
   * Trame déclarée par l'ouvrage (`work_types.frame_spec`). Requise dès qu'un
   * de ses matériaux se métre sur `frame_runner` ou `frame_stud`.
   */
  frame_spec?: FrameSpec | null;
  custom_params: Record<string, unknown>;
  materials: MaterialInput[];
}

/**
 * E1-8 — ce qu'un chiffrage produit vraiment : des lignes, **et** la liste
 * motivée des matériaux liés qu'il n'a pas demandés.
 */
export interface EstimationOutcome {
  items: EstimationLineItem[];
  exclusions: MaterialExclusion[];
}

export interface ResolvedWasteFactor {
  percent: number;
  /**
   * `'default'` n'est **plus produit** depuis E1-7 : la résolution lève au lieu
   * de retomber sur une valeur générique. La valeur reste dans l'union parce que
   * `estimation_results` en contient des lignes historiques, que l'écran doit
   * continuer à savoir afficher (`EstimationResults.tsx` en fait un badge). La
   * retirer ferait mentir la relecture d'un chiffrage d'avant ce lot.
   */
  source: 'catalog' | 'default' | 'learned';
}

/** Un format et son nombre de contenants dans un achat (E1-5). */
export interface PackagingUnits {
  label: string;
  units: number;
}

export interface SelectedPackaging {
  label: string;
  qty_per_unit: number;
  units_needed: number;
  /**
   * Détail de l'achat, du plus grand format au plus petit. Un seul élément
   * quand un format suffit, vide quand il n'y a rien à acheter.
   */
  breakdown: PackagingUnits[];
}

const CM2_TO_M2 = 10_000;
/**
 * Couches appliquées quand `custom_params.number_of_coats` est absent. Exporté
 * parce que le harnais de non-régression doit diviser une quantité par le
 * nombre de couches réellement appliqué : recopier `2` de son côté ferait
 * diverger les deux valeurs le jour où celle-ci change.
 */
export const DEFAULT_COATS = 2;

/** Format de conditionnement normalisé pour le choix d'achat (E1-5). */
interface PackagingFormat {
  label: string;
  /** `quantity_per_unit` en millièmes d'unité — entier, base de tous les coûts. */
  steps: number;
  /**
   * E1-9 — prix d'un contenant, en **centimes** entiers, ou `null` si inconnu.
   * En centimes pour la même raison que les millièmes d'unité : tous les coûts
   * comparés doivent être entiers, sinon deux achats de même prix se départagent
   * sur une dérive flottante.
   */
  priceCents: number | null;
}

const PACKAGING_SCALE = 1000;
const PRICE_SCALE = 100;

/**
 * E1-9 — surplus relatif au-delà duquel un achat cesse d'être admissible :
 * **on n'achète jamais plus du double du besoin** tant qu'un autre achat tient
 * dans la borne.
 *
 * Pourquoi une borne est nécessaire. Le critère principal est le nombre de
 * contenants (cf. `selectBestPackaging`), et ce critère seul sature sur le plus
 * grand format : pour 12,6 m² de natte de découplage, offerte en rouleaux de
 * 5 et 30 m², il achèterait **un** rouleau de 30 m² — environ 450 € et 17 m² à
 * la benne, là où trois rouleaux de 5 m² coûtent environ 270 €. C'est le défaut
 * symétrique de celui qu'E1-9 corrige, et il faut le borner explicitement.
 *
 * Pourquoi **relative** et non absolue, et c'est le point qui commande tout le
 * reste : `V_pièce ≤ 2 q_pièce` pour chaque pièce entraîne `Σ V ≤ 2 Σ q`. La
 * réunion des achats pièce par pièce reste donc admissible pour le problème
 * mutualisé, ce qui préserve `contenants(mutualisé) ≤ Σ contenants(pièce)`
 * (cf. `aggregatePurchases`). Une borne absolue — « pas plus de 5 L de trop » —
 * n'a pas cette propriété : cinq pièces la franchiraient ensemble en la tenant
 * chacune.
 */
const MAX_RELATIVE_SURPLUS = 1;

/**
 * E1-9 — gain minimal, en fraction du besoin, qui justifie d'ajouter un second
 * format à l'achat.
 *
 * À nombre de contenants égal, un panachage n'est retenu que s'il fait gagner au
 * moins ce volume sur l'achat à format unique. Sous ce seuil, le volume gagné
 * est plus petit que l'écart entre deux niveaux de compétence sur le même
 * ouvrage — les facteurs de perte du catalogue sautent de 2 à 5 points d'un
 * niveau à l'autre : c'est du bruit d'estimation, pas une économie, et cela ne
 * paie pas une seconde référence sur la liste d'achat.
 *
 * Exemple du catalogue : 13,8 m² de carrelage offert en cartons de 1,08 et
 * 1,44 m². `9 × 1,44 + 1 × 1,08 = 14,04 m²` et `10 × 1,44 = 14,40 m²` coûtent
 * dix cartons tous les deux ; le panachage gagne 0,36 m², soit 2,6 % du besoin.
 * On prend les dix cartons du même format.
 */
const MARGINAL_MIX_RATIO = 0.05;

/**
 * Plafond de la table de programmation dynamique. Au-delà, le gros de l'achat
 * part sur le plus grand format — le seul choix raisonnable à cette échelle —
 * et seul le reliquat est optimisé. Hors d'atteinte sur le catalogue réel
 * (formats à deux décimales → pas ≥ 0,01 → 100 000 pas = 1 000 unités de
 * besoin) : garde-fou contre une donnée aberrante, pas un compromis de calcul.
 */
const MAX_PACKAGING_STEPS = 100_000;

/**
 * Tolérance sur le besoin, en pas de la grille. Sans elle, 7,5 L — dont la
 * représentation flottante vaut 7500,000000000001 millièmes — demanderait
 * 16 demi-pots au lieu de 15.
 */
const STEP_EPSILON = 1e-6;

/**
 * Tolérance sur le nombre de travées d'une trame (E1-3). Sans elle,
 * `5,40 / 0,60 = 9.000000000000002` ferait compter dix travées et acheter un
 * montant de trop. Même rôle que `STEP_EPSILON` un cran plus haut.
 */
const SPAN_EPSILON = 1e-9;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * Formats exploitables, dédoublonnés par taille et triés du plus grand au plus
 * petit. Les quantités nulles ou non numériques sont écartées ici, une fois,
 * plutôt que testées à chaque comparaison.
 */
const normalizePackagings = (
  packagings: PackagingInput[],
): PackagingFormat[] => {
  const bySteps = new Map<number, PackagingFormat>();
  for (const pkg of packagings) {
    const steps = Math.round(Number(pkg.quantity_per_unit) * PACKAGING_SCALE);
    if (!Number.isFinite(steps) || steps <= 0 || bySteps.has(steps)) {
      continue;
    }
    const priceCents = Math.round(Number(pkg.unit_price) * PRICE_SCALE);
    bySteps.set(steps, {
      label: pkg.label,
      steps,
      priceCents:
        Number.isFinite(priceCents) && priceCents > 0 ? priceCents : null,
    });
  }
  return [...bySteps.values()].sort((a, b) => b.steps - a.steps);
};

/**
 * Nombre de contenants de chaque format, indexé comme `formats` (E1-9).
 *
 * L'achat retenu minimise, dans cet ordre :
 *
 *  1. le **coût total** si tous les formats portent un prix, sinon le **nombre
 *     de contenants** ;
 *  2. le nombre de contenants ;
 *  3. le volume acheté, donc le surplus.
 *
 * sous deux contraintes : couvrir le besoin, et ne pas dépasser
 * `MAX_RELATIVE_SURPLUS` — sauf si aucun achat ne tient dans cette borne, auquel
 * cas le volume minimal l'emporte. La pénalité sur les panachages marginaux
 * (`MARGINAL_MIX_RATIO`) s'applique en dernier, **à clé principale et nombre de
 * contenants inchangés** : elle ne peut donc jamais faire acheter un contenant
 * de plus, ce dont dépend la propriété de mutualisation.
 *
 * Programmation dynamique sur le pgcd des formats : tout format est un multiple
 * entier du pas, donc « couvrir le besoin » se dit exactement « couvrir
 * `ceil(besoin / pas)` pas », et toutes les grandeurs comparées sont des entiers
 * — aucune dérive flottante ne peut départager deux achats.
 *
 * La table s'arrête à `besoin + plus grand format` : au-delà, aucun achat ne
 * peut avoir moins de contenants, puisque `ceil(besoin / plus grand format)` en
 * est le plancher et qu'il est atteint dans cet intervalle. Explorer plus loin
 * coûterait du temps pour ne trouver que des achats plus volumineux.
 */
const solvePackagingMix = (
  adjustedQty: number,
  formats: PackagingFormat[],
): number[] => {
  const counts = new Array<number>(formats.length).fill(0);
  const step = formats.reduce((acc, f) => gcd(acc, f.steps), 0);
  const sizes = formats.map((f) => f.steps / step);
  const largest = sizes[0];
  // Le coût ne guide le choix que s'il est connu de **tous** les formats. Un
  // prix partiel comparerait un coût su à un coût supposé.
  const priced = formats.every((f) => f.priceCents !== null);
  const weights = formats.map((f) => (priced ? f.priceCents! : 1));

  const need = Math.max(
    0,
    Math.ceil((adjustedQty * PACKAGING_SCALE) / step - STEP_EPSILON),
  );
  if (need === 0) {
    return counts;
  }

  // Volume total admissible, calculé sur la quantité **réelle** et non sur le
  // besoin arrondi à la grille : sur des formats grossiers (rouleaux de 5 et
  // 30 m²), l'arrondi vaudrait plusieurs fois la borne elle-même.
  const maxSteps = Math.floor(
    (adjustedQty * PACKAGING_SCALE * (1 + MAX_RELATIVE_SURPLUS)) / step +
      STEP_EPSILON,
  );
  const marginalSteps = Math.floor(
    (adjustedQty * PACKAGING_SCALE * MARGINAL_MIX_RATIO) / step,
  );

  let remaining = need;
  let bulkSteps = 0;
  if (remaining > MAX_PACKAGING_STEPS) {
    const bulk = Math.ceil((remaining - MAX_PACKAGING_STEPS) / largest);
    counts[0] += bulk;
    bulkSteps = bulk * largest;
    remaining -= bulkSteps;
  }

  const bound = remaining + largest;
  // key[n]  : clé principale minimale pour acheter **exactement** n pas ;
  // units[n]: contenants du meilleur achat de n pas, départage à clé égale ;
  // from[n] : dernier format posé, pour la reconstruction. `Infinity` marque un
  //           volume qu'aucune combinaison de formats n'atteint.
  const key = new Float64Array(bound + 1).fill(Infinity);
  const units = new Int32Array(bound + 1);
  const from = new Int32Array(bound + 1).fill(-1);
  key[0] = 0;

  for (let n = 1; n <= bound; n++) {
    // Du plus grand format au plus petit : à clé et contenants égaux, le grand
    // format l'emporte — le choix reste déterministe et le détail trié.
    for (let i = 0; i < formats.length; i++) {
      const prev = n - sizes[i];
      if (prev < 0 || key[prev] === Infinity) {
        continue;
      }
      const candidateKey = key[prev] + weights[i];
      const candidateUnits = units[prev] + 1;
      if (
        candidateKey < key[n] ||
        (candidateKey === key[n] && candidateUnits < units[n])
      ) {
        key[n] = candidateKey;
        units[n] = candidateUnits;
        from[n] = i;
      }
    }
  }

  // Les achats admissibles : ceux qui couvrent le besoin sans franchir la borne
  // de surplus. Si la borne n'en laisse aucun — un besoin très petit devant le
  // plus petit format — elle s'efface au profit du volume minimal : on ne peut
  // pas ne rien acheter.
  const affordable = maxSteps - bulkSteps;
  let chosen = -1;
  for (let n = remaining; n <= bound; n++) {
    if (key[n] === Infinity || n > affordable) {
      continue;
    }
    if (
      chosen === -1 ||
      key[n] < key[chosen] ||
      (key[n] === key[chosen] && units[n] < units[chosen])
    ) {
      chosen = n;
    }
  }
  if (chosen === -1) {
    for (let n = remaining; n <= bound; n++) {
      if (key[n] !== Infinity) {
        chosen = n;
        break;
      }
    }
  }
  if (chosen === -1) {
    return counts;
  }

  // Pénalité sur les conditionnements marginaux : à clé principale et nombre de
  // contenants inchangés, un format unique l'emporte sur un panachage dès que
  // celui-ci ne gagne pas `MARGINAL_MIX_RATIO` du besoin.
  // Du plus petit format au plus grand : le premier qui couvre le besoin à lui
  // seul est aussi celui qui achète le moins de volume.
  for (let i = formats.length - 1; i >= 0; i--) {
    const volume = units[chosen] * sizes[i];
    if (volume < remaining) {
      continue;
    }
    if (volume <= chosen + marginalSteps && volume <= affordable) {
      counts[i] += units[chosen];
      return counts;
    }
    break;
  }

  for (let n = chosen; n > 0; ) {
    const i = from[n];
    counts[i] += 1;
    n -= sizes[i];
  }

  return counts;
};

/**
 * Libellé d'un achat panaché : « 2 × Pot 10 L + Pot 5 L + Pot 2.5 L ». Un achat
 * à format unique garde son libellé nu — le nombre de contenants est déjà porté
 * par `units_needed`, et l'affichage historique « N × libellé » reste juste.
 */
const composePackagingLabel = (breakdown: PackagingUnits[]): string =>
  breakdown.length === 1
    ? breakdown[0].label
    : breakdown
        .map((b) => (b.units > 1 ? `${b.units} × ${b.label}` : b.label))
        .join(' + ');

/**
 * Aucune ligne de perte ne couvre ce couple (pose, niveau).
 *
 * E1-7 — c'est une **panne de données**, et elle se dit. Le repli générique
 * qu'elle remplace rendait la même situation indiscernable d'un chiffrage
 * normal : le carrelage mural et le revêtement mural étaient chiffrés à 10 %
 * quel que soit le niveau de compétence, sans qu'aucun écran, aucun journal ni
 * aucun test ne puisse le voir. Un catalogue incomplet doit coûter une erreur
 * bruyante, pas un chiffre plausible.
 */
export class MissingWasteFactorError extends Error {
  constructor(
    readonly materialName: string,
    readonly poseType: string,
    readonly skillLevel: string,
  ) {
    super(
      `Aucun facteur de perte au catalogue pour « ${materialName} » ` +
        `en pose ${poseType}, niveau ${skillLevel}`,
    );
    this.name = 'MissingWasteFactorError';
  }
}

/**
 * Résolution du facteur de perte : pose exacte, ou pose unique du même niveau.
 * **Aucun troisième temps** — ce qui n'est pas au catalogue lève (E1-7).
 *
 * Pourquoi deux temps et non un seul. La pose est une propriété de l'**ouvrage**
 * (« ce carrelage est posé en diagonale ») tandis que le vocabulaire des poses
 * est une propriété du **matériau** : un carreau distingue la pose droite de la
 * diagonale, le mortier-colle sous ce carreau n'en sait rien et n'a pas à le
 * savoir — sa consommation suit la surface nette. Le second temps sert donc les
 * matériaux **sans variante de pose**, et eux seuls : le catalogue interdit
 * qu'un matériau déclare `standard` **et** une pose variante, et
 * `waste-factor-coverage.spec.ts` (propriété W1) le vérifie sur les 208 entrées
 * seedées. Ce n'est plus un repli, c'est une règle de vocabulaire.
 *
 * Exportée comme fonction pure car DATA-3 doit résoudre la **même** valeur de
 * référence hors du moteur (calcul des facteurs appris) : la dupliquer
 * laisserait les deux logiques diverger en silence.
 */
export function resolveWasteFactor(
  wasteFactors: WasteFactorInput[],
  poseType: string,
  skillLevel: string,
  materialName = 'matériau sans nom',
): ResolvedWasteFactor {
  const exact = wasteFactors.find(
    (wf) => wf.pose_type === poseType && wf.skill_level === skillLevel,
  );
  if (exact) {
    return {
      percent: Number(exact.factor_percent),
      source: exact.source ?? 'catalog',
    };
  }

  const unique = wasteFactors.find(
    (wf) => wf.pose_type === POSE_UNIQUE && wf.skill_level === skillLevel,
  );
  if (unique) {
    return {
      percent: Number(unique.factor_percent),
      source: unique.source ?? 'catalog',
    };
  }

  throw new MissingWasteFactorError(materialName, poseType, skillLevel);
}

@Injectable()
export class EstimationEngine {
  /**
   * Rectangles composant la pièce. Une pièce sans `segments` est traitée comme
   * un unique rectangle `length_cm × width_cm` : l'aire vaut alors L×l et le
   * périmètre 2(L+l), strictement identique à l'ancien calcul rectangulaire.
   */
  private resolveSegments(room: RoomData): RectSegment[] {
    if (room.segments && room.segments.length > 0) {
      return room.segments;
    }
    return [
      {
        x_cm: 0,
        y_cm: 0,
        length_cm: room.length_cm,
        width_cm: room.width_cm,
      },
    ];
  }

  private openingsAreaCm2(room: RoomData): number {
    return room.openings.reduce(
      (sum, o) => sum + o.width_cm * o.height_cm * o.count,
      0,
    );
  }

  /** Ouvertures de type porte — le défaut d'un `type` absent (E1-10). */
  private doorOpenings(room: RoomData) {
    return room.openings.filter((o) => (o.type ?? 'door') === 'door');
  }

  /**
   * E1-10 — le linéaire de contour au sol, portes déduites, en mètres.
   *
   * Monotone croissant en chaque dimension de la pièce (le périmètre l'est,
   * la déduction des portes est constante, `max(0, …)` préserve le sens) :
   * les bornes CV-5 restent exactes en rejouant ce calcul sur les pièces
   * basse et haute.
   */
  private floorPerimeterM(room: RoomData): number {
    const doorWidthCm = this.doorOpenings(room).reduce(
      (sum, o) => sum + o.width_cm * o.count,
      0,
    );
    const perimeterCm = unionPerimeterCm(this.resolveSegments(room));
    return Math.max(0, perimeterCm - doorWidthCm) / 100;
  }

  /** E1-10 — le nombre de passages de porte de la pièce. */
  private doorCount(room: RoomData): number {
    return this.doorOpenings(room).reduce((sum, o) => sum + o.count, 0);
  }

  private excludedAreaCm2(room: RoomData, surfaceTarget: string): number {
    return (room.exclusions ?? [])
      .filter((e) => e.surface_target === surfaceTarget)
      .reduce((sum, e) => sum + e.area_m2 * CM2_TO_M2, 0);
  }

  computeSurface(room: RoomData, surfaceTarget: string): number {
    const segments = this.resolveSegments(room);
    const excludedCm2 = this.excludedAreaCm2(room, surfaceTarget);
    switch (surfaceTarget) {
      case 'wall': {
        const grossWall = unionPerimeterCm(segments) * room.height_cm;
        const netWall = grossWall - this.openingsAreaCm2(room);
        return Math.max(0, netWall - excludedCm2) / CM2_TO_M2;
      }
      case 'floor':
      case 'ceiling':
      default:
        return Math.max(0, unionAreaCm2(segments) - excludedCm2) / CM2_TO_M2;
    }
  }

  /**
   * Fourchette basse/haute de `computeSurface` (CV-5) : bornes pire-cas
   * obtenues en évaluant `computeSurface` sur la pièce dont les dimensions
   * sont respectivement `-Δ` et `+Δ` (Δ = incertitude par champ, clampée à
   * ≥ 0). Exact et pas seulement approché, car toutes les formules de
   * surface (aire/périmètre union, mur = périmètre × hauteur) sont monotones
   * croissantes en chaque dimension. Ouvertures/exclusions restent fixes
   * (aucune donnée d'incertitude sur ces champs). `null` si la pièce n'a
   * aucune incertitude connue — pas de fourchette à afficher.
   *
   * Limite assumée : pour une pièce composite (`segments` ENG-1),
   * `length_cm`/`width_cm` ne pilotent plus `computeSurface` (les segments
   * priment) → fourchette nulle en sol/plafond ; seule la hauteur continue
   * de produire une fourchette murale.
   */
  /**
   * Les deux pièces pire-cas d'une incertitude de mesure, ou `null` si la pièce
   * n'en porte aucune. Extraite de `computeSurfaceBounds` pour que les assiettes
   * basses et hautes se calculent en rejouant **le même** code sur ces pièces,
   * plutôt qu'en dérivant une seconde fois les mêmes formules.
   */
  private boundedRooms(
    room: RoomData,
  ): { low: RoomData; high: RoomData } | null {
    const dl = room.length_cm_uncertainty ?? 0;
    const dw = room.width_cm_uncertainty ?? 0;
    const dh = room.height_cm_uncertainty ?? 0;
    if (dl <= 0 && dw <= 0 && dh <= 0) {
      return null;
    }

    return {
      low: {
        ...room,
        length_cm: Math.max(0, room.length_cm - dl),
        width_cm: Math.max(0, room.width_cm - dw),
        height_cm: Math.max(0, room.height_cm - dh),
      },
      high: {
        ...room,
        length_cm: room.length_cm + dl,
        width_cm: room.width_cm + dw,
        height_cm: room.height_cm + dh,
      },
    };
  }

  computeSurfaceBounds(
    room: RoomData,
    surfaceTarget: string,
  ): SurfaceBounds | null {
    const bounded = this.boundedRooms(room);
    if (!bounded) {
      return null;
    }

    return {
      low: this.computeSurface(bounded.low, surfaceTarget),
      high: this.computeSurface(bounded.high, surfaceTarget),
    };
  }

  /**
   * La trame d'un ouvrage, d'après son linéaire et sa hauteur **réels** — jamais
   * d'après une surface.
   *
   * Règle du métier : un montant tous les `stud_spacing_m`, plus un pour fermer
   * la dernière travée, plus les montants de rive et d'huisserie que l'ouvrage
   * déclare. Pour 4,00 m à l'entraxe 0,60 : `ceil(6,67) + 1 = 8` montants.
   * Les lisses courent `runner_courses` fois la longueur — deux fois, haut et
   * bas, pour une cloison.
   *
   * Aucun de ces nombres n'est écrit ici : ils viennent tous de
   * `work_types.frame_spec`.
   */
  computeFrameQuantities(
    basis: DeclaredWorkBasis,
    frameSpec: FrameSpec,
  ): FrameQuantities {
    const spacing = Number(frameSpec.stud_spacing_m);
    if (!Number.isFinite(spacing) || spacing <= 0) {
      throw new Error(
        `frame_spec.stud_spacing_m doit être un entraxe strictement positif (reçu : ${frameSpec.stud_spacing_m})`,
      );
    }

    // `5,40 / 0,60` vaut 9.000000000000002 en flottant : sans cette tolérance,
    // une cloison de 5,40 m à l'entraxe 0,60 achèterait un montant de trop —
    // un défaut invisible en relecture et faux d'une barre sur le chantier.
    // Même parade que `STEP_EPSILON` pour les conditionnements, et sans effet
    // réel : 1e-9 travée vaut moins d'un micron de cloison.
    const spans = Math.ceil(basis.length_m / spacing - SPAN_EPSILON);
    const studCount = spans + 1 + Number(frameSpec.extra_studs);

    return {
      stud_count: studCount,
      stud_piece_length_m: basis.height_m,
      stud_length_m: studCount * basis.height_m,
      runner_length_m: Number(frameSpec.runner_courses) * basis.length_m,
    };
  }

  /**
   * Les assiettes d'un ouvrage sur une pièce.
   *
   * Deux chemins, et un seul point de bascule — la présence de `declared_basis` :
   *
   *  - **assiette dérivée** : `computeSurface(room, surface_target)`, à
   *    l'identique d'avant E1-3, une seule face, pas de trame ;
   *  - **assiette déclarée** : `longueur × hauteur`, sans déduire les ouvertures
   *    ni les zones exclues de la pièce (elles décrivent les murs existants, pas
   *    la cloison neuve), et avec la trame que l'ouvrage déclare.
   */
  computeWorkBasis(room: RoomData, workItem: WorkItemInput): WorkBasis {
    const declared = workItem.declared_basis;

    if (!declared) {
      const workSurfaceM2 = this.computeSurface(room, workItem.surface_target);
      return {
        work_surface_m2: workSurfaceM2,
        gross_surface_m2: this.computeGrossSurface(
          room,
          workItem.surface_target,
        ),
        excluded_surface_m2:
          this.excludedAreaCm2(room, workItem.surface_target) / CM2_TO_M2,
        clad_surface_m2: workSurfaceM2,
        clad_faces: 1,
        frame: null,
        // E1-6 : les pans réels de la pièce, exacts pour toute forme
        // rectilinéaire — jamais une majoration du périmètre.
        wall_runs_cm:
          workItem.surface_target === 'wall'
            ? unionWallRunsCm(this.resolveSegments(room))
            : null,
        wall_height_cm: room.height_cm,
        // E1-10 : calculées quel que soit `surface_target` — le joint
        // périphérique d'un carrelage mural suit le même contour au sol.
        floor_perimeter_m: this.floorPerimeterM(room),
        door_count: this.doorCount(room),
      };
    }

    const workSurfaceM2 = declared.length_m * declared.height_m;
    return {
      work_surface_m2: workSurfaceM2,
      gross_surface_m2: workSurfaceM2,
      excluded_surface_m2: 0,
      clad_surface_m2: workSurfaceM2 * declared.clad_faces,
      clad_faces: declared.clad_faces,
      frame: workItem.frame_spec
        ? this.computeFrameQuantities(declared, workItem.frame_spec)
        : null,
      // Un ouvrage à assiette déclarée est un pan unique par face parementée :
      // une cloison de 4 ml recouverte sur ses deux faces, c'est deux murs de
      // 4 ml, chacun arrondissant sa dernière laize.
      wall_runs_cm: Array.from(
        { length: declared.clad_faces },
        () => declared.length_m * 100,
      ),
      wall_height_cm: declared.height_m * 100,
      // E1-10 : une cloison créée n'a ni contour au sol ni passages de porte.
      // `null` et non 0 : un matériau qui s'y métré doit échouer bruyamment.
      floor_perimeter_m: null,
      door_count: null,
    };
  }

  /**
   * L'assiette d'un matériau donné, dans l'unité de son `yield_per_unit`.
   *
   * Le seul endroit du moteur où le nombre de faces entre en jeu — et il n'y
   * entre que pour `clad_faces`. Un rail et un montant n'en savent rien : leur
   * assiette est une longueur de trame, identique qu'on parémente une face ou
   * deux.
   */
  private meteringBase(
    basis: WorkBasis,
    material: MaterialInput,
    workItem: WorkItemInput,
  ): MeteringBase {
    const driver = material.quantity_driver ?? 'work_surface';

    switch (driver) {
      case 'clad_faces':
        return { quantity: basis.clad_surface_m2 };
      case 'frame_runner':
      case 'frame_stud': {
        if (!basis.frame) {
          throw new Error(
            `Le matériau « ${material.name} » se métre sur la trame ` +
              `(quantity_driver = ${driver}), mais l'ouvrage ` +
              `« ${workItem.work_type_code} » ne déclare pas de frame_spec.`,
          );
        }
        if (driver === 'frame_runner') {
          return { quantity: basis.frame.runner_length_m };
        }
        // E1-8 : la seule assiette du catalogue qui se décompose en pièces
        // identiques. Un montant par emplacement, tous de la hauteur de
        // l'ouvrage — c'est ce qui permet de compter au lieu de diviser.
        return {
          quantity: basis.frame.stud_length_m,
          pieces: {
            count: basis.frame.stud_count,
            length_m: basis.frame.stud_piece_length_m,
          },
        };
      }
      case 'floor_perimeter': {
        if (basis.floor_perimeter_m === null) {
          throw new Error(
            `Le matériau « ${material.name} » se métre sur le périmètre au ` +
              `sol (quantity_driver = floor_perimeter), mais l'ouvrage ` +
              `« ${workItem.work_type_code} » déclare son assiette : une ` +
              `cloison créée n'a pas de contour au sol.`,
          );
        }
        return { quantity: basis.floor_perimeter_m };
      }
      case 'door_count': {
        if (basis.door_count === null) {
          throw new Error(
            `Le matériau « ${material.name} » se compte aux passages de ` +
              `porte (quantity_driver = door_count), mais l'ouvrage ` +
              `« ${workItem.work_type_code} » déclare son assiette : une ` +
              `cloison créée n'a pas de passages de porte.`,
          );
        }
        return { quantity: basis.door_count };
      }
      case 'work_surface':
      default:
        return { quantity: basis.work_surface_m2 };
    }
  }

  /**
   * E1-10 — l'assiette d'un matériau, dans l'unité de son `yield_per_unit`,
   * exposée pour l'encadrement de consommation (I3). Une borne `driver_base`
   * se vérifie en divisant la quantité par **cette** grandeur — la même que
   * celle du chiffrage, recalculée par le même code : une borne « mètres de
   * plinthe par m² de sol » varierait du simple au triple avec la géométrie
   * de la pièce, celle-ci ne varie pas.
   */
  resolveMeteringQuantity(
    basis: WorkBasis,
    material: MaterialInput,
    workItem: WorkItemInput,
  ): number {
    return this.meteringBase(basis, material, workItem).quantity;
  }

  resolveWasteFactor(
    wasteFactors: WasteFactorInput[],
    poseType: string,
    skillLevel: string,
    materialName?: string,
  ): ResolvedWasteFactor {
    return resolveWasteFactor(wasteFactors, poseType, skillLevel, materialName);
  }

  /**
   * Quantité théorique avant perte, à partir de l'**assiette du matériau** —
   * surface d'ouvrage, surface de parement ou longueur de trame selon son
   * `quantity_driver` (E1-3). Le paramètre garde sa position : la surface
   * d'ouvrage reste ce qu'on lui passe pour tout matériau `work_surface`,
   * c'est-à-dire tout le catalogue hors plâtrerie.
   *
   * Le nombre de couches ne s'applique qu'aux matériaux qui le déclarent
   * (`applies_coats`, E1-4) — un rouleau, un ruban ou une bâche ne se rachètent
   * pas à chaque couche.
   *
   * `coats` n'est renseigné dans le retour que pour ces matériaux : c'est ce
   * qui alimente le « · 2 couches » affiché sur la ligne, qui n'a de sens que
   * là où la quantité en dépend vraiment.
   */
  /**
   * E1-5 — le rendement que ce matériau tient **sur le carreau réellement
   * choisi**, en m² d'assiette par unité.
   *
   * Un matériau sans `consumption_model` rend son rendement catalogue, sans
   * détour : c'est tout le catalogue hors mortiers-colle et mortiers de
   * jointoiement, et le comportement d'avant ce lot.
   *
   * Pour les deux autres, `yield_per_unit` est le rendement à la géométrie de
   * référence du modèle, et le facteur dit de combien la géométrie posée s'en
   * écarte. Une consommation plus forte est un rendement plus faible : le
   * facteur **divise**. Un 60 × 60, qui demande 8 kg/m² de colle là où le
   * 45 × 45 de référence en demande 7, tire donc 14 % de sacs en plus, et un
   * 20 × 20 posé à joint de 5 mm trois fois plus de joint qu'un 60 × 60 à 2 mm.
   *
   * Le format n'est pas seul en cause : le NF DTU 52.2 impose le double
   * encollage au-delà d'un seuil de surface qui dépend de la destination, et
   * ce basculement est **déduit**, jamais demandé à l'utilisateur — c'est une
   * obligation de mise en œuvre, pas une préférence.
   */
  resolveEffectiveYield(
    material: MaterialInput,
    workItem: WorkItemInput,
  ): number {
    const model = material.consumption_model;
    if (!model) {
      return material.yield_per_unit;
    }
    return (
      material.yield_per_unit /
      tileConsumptionFactor(
        model,
        workItem.custom_params,
        workItem.surface_target,
      )
    );
  }

  /**
   * E1-6 — la découpe en lés de ce matériau sur cette assiette.
   *
   * Un matériau vendu au rouleau posé sur un ouvrage qui n'a pas de murs
   * échoue bruyamment, comme un rail sans trame : il n'existe aucun linéaire de
   * pan à découper, et le seul repli imaginable — le périmètre du sol — serait
   * un chiffrage faux qui ne se signale pas.
   */
  resolveStripCut(
    basis: WorkBasis,
    material: MaterialInput,
    workItem: WorkItemInput,
  ): StripCut {
    if (!material.roll_spec) {
      throw new Error(
        `Le matériau « ${material.name} » n'a pas de dimensions de rouleau.`,
      );
    }
    if (!basis.wall_runs_cm) {
      throw new Error(
        `Le matériau « ${material.name} » se pose en lés, mais l'ouvrage ` +
          `« ${workItem.work_type_code} » ne se chiffre pas sur des murs ` +
          `(surface_target = ${workItem.surface_target}).`,
      );
    }
    return computeStripCut(
      basis.wall_runs_cm,
      basis.wall_height_cm,
      material.roll_spec,
      workItem.custom_params,
    );
  }

  /**
   * La quantité théorique d'un matériau sur une assiette, quelle que soit la loi
   * qu'il suit. Point de branchement unique des deux régimes — rendement au
   * mètre carré, ou découpe en lés — appelé aux trois endroits qui chiffrent
   * (la quantité nominale et les deux bornes de CV-5), pour qu'aucun d'eux ne
   * puisse répondre autre chose que les deux autres.
   *
   * Un matériau vendu au rouleau ne lit ni `yield_per_unit`, ni son
   * `quantity_driver`, ni le nombre de couches : sa quantité est un métré de
   * papier, en m², chute de bobine comprise.
   */
  private materialQty(
    basis: WorkBasis,
    material: MaterialInput,
    workItem: WorkItemInput,
    effectiveYield: number,
    appliesCoats: boolean,
  ): { qty: number; coats?: number; cut?: PieceCut } {
    if (material.roll_spec) {
      return { qty: this.resolveStripCut(basis, material, workItem).paper_m2 };
    }

    const meteringBase = this.meteringBase(basis, material, workItem);

    // E1-8 — un matériau découpé à longueur ne se divise pas, il se compte.
    if (material.offcuts_reusable === false) {
      if (!meteringBase.pieces) {
        throw new Error(
          `Le matériau « ${material.name} » se découpe à longueur ` +
            `(offcuts_reusable = false), mais l'ouvrage ` +
            `« ${workItem.work_type_code} » ne décompose pas son assiette en ` +
            `pièces : aucune longueur de pièce n'est connue.`,
        );
      }
      const cut = computePieceCut(
        material.name,
        meteringBase.pieces,
        material.packagings,
      );
      // La quantité théorique reste le linéaire **posé** — celui que le
      // chantier consomme, et celui sur lequel l'encadrement de consommation
      // (I3) est exprimé. Ce qui change est l'achat, pas le besoin.
      return { qty: cut.pieces * cut.piece_length_m, cut };
    }

    return this.computeTheoreticalQty(
      meteringBase.quantity,
      effectiveYield,
      workItem.custom_params,
      appliesCoats,
    );
  }

  computeTheoreticalQty(
    meteringBaseQty: number,
    yieldPerUnit: number,
    customParams: Record<string, unknown>,
    appliesCoats: boolean,
  ): { qty: number; coats?: number } {
    const yield_ = Number(yieldPerUnit);
    const qty = meteringBaseQty / yield_;

    if (appliesCoats) {
      const coats = Number(customParams.number_of_coats) || DEFAULT_COATS;
      return { qty: qty * coats, coats };
    }

    return { qty };
  }

  /**
   * Que faut-il acheter pour couvrir `adjustedQty` ? E1-9 — le critère est
   * lexicographique, et il se lit dans cet ordre :
   *
   *  1. **le coût total**, si le catalogue donne un prix à *tous* les formats de
   *     ce matériau ; **le nombre de contenants** sinon ;
   *  2. à égalité, le nombre de contenants ;
   *  3. à égalité, le surplus.
   *
   * sous deux contraintes : couvrir le besoin, et ne pas dépasser
   * `MAX_RELATIVE_SURPLUS` du besoin — sauf quand aucun achat ne tient dans
   * cette borne, où le volume minimal l'emporte. Un panachage n'est retenu que
   * s'il gagne un contenant, ou `MARGINAL_MIX_RATIO` du besoin à contenants
   * égaux.
   *
   * **Pourquoi le nombre de contenants et non le coût approché.** Le critère
   * d'E1-5 minimisait `S = q_min × contenants + volume`, où `q_min` est le plus
   * petit format offert : il approchait le prix d'un conditionnement par
   * `a + b × contenu` et posait `a/b = q_min`. L'approximation est trop basse.
   * Sur la peinture `q_min = 0,5 L` : un contenant de plus ne « coûtait » qu'un
   * demi-litre, donc trois pots battaient un seul dès qu'ils économisaient
   * 1,5 L. Pour 3,497 L de sous-couche, ce critère achetait
   * « 1 × Pot 2,5 L + 2 × Pot 0,5 L » — trois contenants, un peu plus cher en
   * euros, et deux pots de 0,5 L de sous-couche universelle que le rayon
   * professionnel ne tient quasiment pas. Le pot de 5 L est la réponse du
   * métier, et c'est celle qu'un critère en contenants donne directement.
   *
   * Le nombre de contenants n'est pas qu'un proxy de prix : c'est un coût que le
   * prix ne porte pas. Aux tarifs constatés, `1 × 5 L` et
   * `2,5 L + 0,5 L + 0,5 L` se tiennent à un euro près — ce qui les sépare, ce
   * sont deux références de plus à trouver, à porter et à stocker.
   *
   * **Pourquoi une borne de surplus.** Le critère en contenants, seul, sature
   * sur le plus grand format : il achèterait un rouleau de 30 m² de natte de
   * découplage pour 12,6 m². C'est le défaut symétrique, et
   * `MAX_RELATIVE_SURPLUS` le borne.
   *
   * **Pourquoi le prix passe devant quand il existe.** Le nombre de contenants
   * est ce qu'on regarde *faute de prix*. Là où le prix est connu, il n'y a plus
   * rien à approcher — cf. `PackagingInput.unit_price`, aujourd'hui alimenté par
   * aucune table.
   */
  selectBestPackaging(
    adjustedQty: number,
    packagings: PackagingInput[],
  ): SelectedPackaging {
    const formats = normalizePackagings(packagings);

    if (formats.length === 0) {
      const units = Math.max(0, Math.ceil(adjustedQty));
      return {
        label: '-',
        qty_per_unit: 1,
        units_needed: units,
        breakdown: units > 0 ? [{ label: '-', units }] : [],
      };
    }

    const counts = solvePackagingMix(adjustedQty, formats);

    const breakdown: PackagingUnits[] = [];
    let totalUnits = 0;
    let totalSteps = 0;
    formats.forEach((format, i) => {
      if (counts[i] === 0) {
        return;
      }
      breakdown.push({ label: format.label, units: counts[i] });
      totalUnits += counts[i];
      totalSteps += counts[i] * format.steps;
    });

    // Rien à acheter (surface nulle) : on nomme quand même le format qu'on
    // aurait pris, comme avant E1-5, plutôt que de renvoyer un libellé vide.
    if (totalUnits === 0) {
      const smallest = formats[formats.length - 1];
      return {
        label: smallest.label,
        qty_per_unit: smallest.steps / PACKAGING_SCALE,
        units_needed: 0,
        breakdown: [],
      };
    }

    return {
      label: composePackagingLabel(breakdown),
      // Contenu moyen par contenant : le format exact quand il n'y en a qu'un,
      // et sinon la valeur qui préserve `units_needed × qty_per_unit = volume
      // acheté` — l'invariant dont vivent la clôture de chantier, la
      // comparaison de prix et la correction manuelle des quantités.
      qty_per_unit: totalSteps / totalUnits / PACKAGING_SCALE,
      units_needed: totalUnits,
      breakdown,
    };
  }

  /**
   * L'achat d'un matériau découpé à longueur (E1-8), dans la forme que le reste
   * du moteur attend d'un conditionnement.
   *
   * Le facteur de perte s'applique au **nombre de barres**, pas au linéaire :
   * sur un matériau non aboutable, ce qu'un poseur maladroit gâche est une
   * barre, jamais un demi-mètre. À 0 % — la valeur du catalogue, la chute étant
   * déjà mesurée — le compte est exactement celui des pièces.
   */
  /**
   * L'achat mutualisé d'un matériau découpé à longueur (E1-8) : les pièces de
   * toutes les pièces du projet se découpent dans le même stock de barres.
   *
   * C'est ici que la mutualisation gagne réellement quelque chose sur ces
   * matériaux : deux cloisons demandant chacune 5 pièces de 0,90 m prennent
   * 4 barres séparément (2 × 2) et 4 mutualisées (10 ÷ 3) — et 7 pièces plus 8
   * en prennent 5 séparément (3 + 3) contre 5 mutualisées. Jamais plus, comme
   * pour les conditionnements : `ceil(Σ) ≤ Σ ceil`.
   */
  private aggregatePieceCut(
    pieceLines: EstimationLineItem[],
    first: EstimationLineItem,
    packagings: PackagingInput[],
  ): SelectedPackaging {
    const cut = computePieceCut(
      first.material_name,
      {
        count: pieceLines.reduce((sum, l) => sum + (l.pieces_needed ?? 0), 0),
        length_m: first.piece_length_m!,
      },
      packagings,
    );
    // Le facteur de perte a déjà été appliqué ligne à ligne ; le réappliquer
    // ici le compterait deux fois. À 0 % au catalogue la question ne se pose
    // pas, mais un facteur appris la poserait.
    return this.pieceCutPackaging(cut, 0);
  }

  private pieceCutPackaging(
    cut: PieceCut,
    wastePercent: number,
  ): SelectedPackaging {
    const bars = Math.ceil(cut.bars * (1 + wastePercent / 100));
    return {
      label: cut.label,
      qty_per_unit: cut.bar_length_m,
      units_needed: bars,
      breakdown: bars > 0 ? [{ label: cut.label, units: bars }] : [],
    };
  }

  computeGrossSurface(room: RoomData, surfaceTarget: string): number {
    const segments = this.resolveSegments(room);
    switch (surfaceTarget) {
      case 'wall':
        return (unionPerimeterCm(segments) * room.height_cm) / CM2_TO_M2;
      case 'floor':
      case 'ceiling':
      default:
        return unionAreaCm2(segments) / CM2_TO_M2;
    }
  }

  /**
   * Le chiffrage d'une pièce, **et ce qui n'y figure pas**.
   *
   * E1-8 introduit la première raison pour qu'un matériau lié ne produise
   * aucune ligne : un film pare-vapeur sur un support qui n'en demande pas. Une
   * ligne absente sans explication est indiscernable d'un matériau oublié — le
   * harnais lui-même comptait « autant de lignes que de matériaux liés » (I0).
   * Les exclusions sortent donc **avec** les lignes, motivées, et voyagent
   * jusqu'à l'écran.
   *
   * `computeEstimation` reste la porte d'entrée de tous les appelants qui n'en
   * ont pas besoin, et n'a pas changé de signature : une quinzaine de sites
   * d'appel n'ont pas à être réécrits pour un champ dont trois se servent.
   */
  computeEstimationDetailed(
    room: RoomData,
    workItems: WorkItemInput[],
  ): EstimationOutcome {
    const items: EstimationLineItem[] = [];
    const exclusions: MaterialExclusion[] = [];

    for (const wi of workItems) {
      const basis = this.computeWorkBasis(room, wi);
      const surfaceM2 = basis.work_surface_m2;
      const grossSurfaceM2 = basis.gross_surface_m2;
      const excludedSurfaceM2 = basis.excluded_surface_m2;

      // CV-5 : une assiette déclarée n'a pas d'incertitude de mesure — la
      // longueur a été saisie, pas relevée. `boundedRooms` ne s'applique donc
      // qu'aux assiettes dérivées de la pièce.
      const bounded = wi.declared_basis ? null : this.boundedRooms(room);
      const basisBounds = bounded
        ? {
            low: this.computeWorkBasis(bounded.low, wi),
            high: this.computeWorkBasis(bounded.high, wi),
          }
        : null;

      // E1-7 : la pose est résolue **par ouvrage**, jamais devinée matériau par
      // matériau. Un ouvrage qui ne déclare pas son calepinage reçoit celui que
      // `pose-types.ts` retient pour lui — une pose que ses matériaux
      // connaissent — et non le mot `standard`, qui ne voulait rien dire pour un
      // carreau et faisait tomber la résolution sur un défaut générique.
      const poseType = resolveLayingPose(wi.work_type_code, wi.custom_params);

      // E1-8 : quels matériaux cet ouvrage demande **réellement**, compte tenu
      // de ses conditions de mise en œuvre. Résolu par ouvrage et avant la
      // boucle, comme la pose : un film pare-vapeur n'est pas « une quantité
      // nulle », c'est une ligne qui n'a pas lieu d'être.
      const vapourBarrier = resolveVapourBarrier(
        wi.materials,
        wi.custom_params,
      );
      // E1-10 : mêmes règles de présence pour l'étanchéité du local et la
      // préparation du support, chaînées sur ce que la précédente a retenu.
      // L'ordre est indifférent (aucun matériau ne porte deux marquages) ;
      // il suit la chronologie des lots pour rester lisible.
      const wetRoom = resolveWetRoom(vapourBarrier.kept, wi.custom_params);
      const floorPrep = resolveFloorPrep(wetRoom.kept, wi.custom_params);

      for (const excluded of [
        ...vapourBarrier.excluded,
        ...wetRoom.excluded,
        ...floorPrep.excluded,
      ]) {
        exclusions.push({
          work_item_id: wi.id,
          work_type_code: wi.work_type_code,
          work_type_label: wi.work_type_label,
          material_id: excluded.material.id,
          material_name: excluded.material.name,
          reason_code: excluded.reason,
          reason_fr: excluded.reason_fr,
        });
      }

      const inclusionReasons = new Map([
        ...vapourBarrier.inclusionReasonByMaterialId,
        ...wetRoom.inclusionReasonByMaterialId,
        ...floorPrep.inclusionReasonByMaterialId,
      ]);

      for (const mat of floorPrep.kept) {
        const wasteFactor = this.resolveWasteFactor(
          mat.waste_factors,
          poseType,
          wi.skill_level,
          mat.name,
        );

        const appliesCoats = mat.applies_coats ?? false;
        // E1-5 : résolu une fois par matériau, puis servi aux trois calculs —
        // la quantité nominale et les deux bornes de CV-5. Le recalculer à
        // chaque borne laisserait la porte ouverte à trois réponses.
        const effectiveYield = this.resolveEffectiveYield(mat, wi);

        const {
          qty: theoreticalQty,
          coats,
          cut,
        } = this.materialQty(basis, mat, wi, effectiveYield, appliesCoats);

        const adjustedQty = theoreticalQty * (1 + wasteFactor.percent / 100);

        // E1-8 : sur un matériau découpé à longueur, l'achat vient du compte de
        // pièces et non du solveur de conditionnements — diviser une quantité
        // continue par la longueur de barre est précisément le défaut corrigé.
        // Le facteur de perte, lui, s'applique encore : à 0 % au catalogue il
        // ne change rien, mais un facteur **appris** (DATA-3) sur les achats
        // réels resterait lu, et achèterait des barres entières.
        const packaging = cut
          ? this.pieceCutPackaging(cut, wasteFactor.percent)
          : this.selectBestPackaging(adjustedQty, mat.packagings);

        // CV-5 : mêmes calculs aux bornes basse/haute de la surface, quand
        // la pièce porte une incertitude de mesure connue.
        let rangeFields: Partial<EstimationLineItem> = {};
        if (basisBounds) {
          const adjustedQtyLow =
            this.materialQty(
              basisBounds.low,
              mat,
              wi,
              effectiveYield,
              appliesCoats,
            ).qty *
            (1 + wasteFactor.percent / 100);
          const adjustedQtyHigh =
            this.materialQty(
              basisBounds.high,
              mat,
              wi,
              effectiveYield,
              appliesCoats,
            ).qty *
            (1 + wasteFactor.percent / 100);

          const packagingLow = this.selectBestPackaging(
            adjustedQtyLow,
            mat.packagings,
          );
          const packagingHigh = this.selectBestPackaging(
            adjustedQtyHigh,
            mat.packagings,
          );

          rangeFields = {
            surface_m2_low:
              Math.round(basisBounds.low.work_surface_m2 * 1000) / 1000,
            surface_m2_high:
              Math.round(basisBounds.high.work_surface_m2 * 1000) / 1000,
            adjusted_qty_low: Math.round(adjustedQtyLow * 1000) / 1000,
            adjusted_qty_high: Math.round(adjustedQtyHigh * 1000) / 1000,
            units_needed_low: packagingLow.units_needed,
            units_needed_high: packagingHigh.units_needed,
          };
        }

        // E1-11 : composée une fois ici, jamais retraduite côté web — cf.
        // material-justification.ts. `tile_context` n'est fourni que pour le
        // matériau dont la fiche est sourcée à une géométrie de référence :
        // les autres lisent leur source telle quelle.
        const justification = buildMaterialJustification({
          material_unit: mat.unit,
          source_manufacturer: mat.source_manufacturer,
          source_product: mat.source_product,
          source_url: mat.source_url,
          source_consulted_on: mat.source_consulted_on,
          source_basis_fr: mat.source_basis_fr,
          consumption_model: mat.consumption_model,
          ...(mat.consumption_model === 'tile_adhesive'
            ? {
                tile_context: {
                  custom_params: wi.custom_params,
                  surface_target: wi.surface_target,
                },
              }
            : {}),
          inclusion_reason_fr: inclusionReasons.get(mat.id),
        });

        items.push({
          work_item_id: wi.id,
          work_type_code: wi.work_type_code,
          work_type_label: wi.work_type_label,
          material_id: mat.id,
          material_name: mat.name,
          material_unit: mat.unit,
          gross_surface_m2: Math.round(grossSurfaceM2 * 1000) / 1000,
          surface_m2: Math.round(surfaceM2 * 1000) / 1000,
          theoretical_qty: Math.round(theoreticalQty * 1000) / 1000,
          waste_factor_percent: wasteFactor.percent,
          waste_factor_source: wasteFactor.source,
          adjusted_qty: Math.round(adjustedQty * 1000) / 1000,
          packaging_label: packaging.label,
          packaging_qty_per_unit: packaging.qty_per_unit,
          units_needed: packaging.units_needed,
          ...(packaging.breakdown.length > 1
            ? { packaging_breakdown: packaging.breakdown }
            : {}),
          pose_type: poseType,
          ...(cut
            ? {
                pieces_needed: cut.pieces,
                piece_length_m: cut.piece_length_m,
                pieces_per_bar: cut.pieces_per_bar,
              }
            : {}),
          ...(inclusionReasons.has(mat.id)
            ? { inclusion_reason_fr: inclusionReasons.get(mat.id)! }
            : {}),
          ...(justification ? { justification } : {}),
          ...(coats !== undefined ? { number_of_coats: coats } : {}),
          ...(excludedSurfaceM2 > 0
            ? {
                excluded_surface_m2:
                  Math.round(excludedSurfaceM2 * 1000) / 1000,
              }
            : {}),
          ...rangeFields,
        });
      }
    }

    return { items, exclusions };
  }

  computeEstimation(
    room: RoomData,
    workItems: WorkItemInput[],
  ): EstimationLineItem[] {
    return this.computeEstimationDetailed(room, workItems).items;
  }

  /**
   * Mutualise les lignes granulaires par `material_id` : somme les quantités
   * continues (`adjusted_qty`) à travers toutes les pièces et tous les work
   * items, puis sélectionne le conditionnement **une seule fois** sur le total.
   * Fonction pure.
   *
   * Ce que cela garantit, exactement, et **pourquoi c'est un théorème depuis
   * E1-9** : la réunion des achats pièce par pièce couvre la somme des besoins,
   * et son volume vaut `Σ V_pièce ≤ (1 + MAX_RELATIVE_SURPLUS) × Σ q_pièce`
   * puisque chaque pièce tient la borne — la borne est **relative**, donc elle
   * survit à la somme. Cette réunion est donc une solution *admissible* du
   * problème mutualisé, avec `Σ contenants_pièce` contenants. Comme l'optimum
   * mutualisé minimise le nombre de contenants (`selectBestPackaging`), il ne
   * peut pas en compter davantage :
   *
   *     contenants(mutualisé) ≤ Σ contenants(pièce)
   *
   * C'est la forme forte de `ceil(Σ) ≤ Σ ceil`, et elle vaut désormais sur des
   * formats panachés, pas seulement sur un format unique.
   *
   * Ce qu'E1-9 a corrigé pour l'obtenir. Le critère d'E1-5 arbitrait en **coût
   * approché** : l'admissibilité ne portait alors que sur ce coût, et le nombre
   * de contenants pouvait monter. Ce n'était pas une inquiétude théorique — le
   * harnais en affichait deux occurrences sur le catalogue réel, sous la forme
   * d'une « économie » de `-1` contenant. Le critère en contenants les fait
   * disparaître par construction, et `__tests__/two-room-project.spec.ts` exige
   * désormais qu'il n'en reste aucune.
   *
   * La seule réserve, écrite ici parce qu'elle survivra à ce lot : le **mode
   * coût** (`PackagingInput.unit_price`) minimise le prix, pas le compte. Le
   * coût étant additif, `coût(mutualisé) ≤ Σ coûts` tient de la même façon ;
   * le nombre de contenants, lui, n'est plus garanti. `budget-summary.ts` garde
   * son `max(0, …)` pour cette raison, et pour elle seule.
   */
  aggregatePurchases(
    lines: EstimationLineItem[],
    packagingByMaterialId: Map<string, PackagingInput[]>,
  ): AggregatedMaterialLine[] {
    const groups = new Map<string, EstimationLineItem[]>();
    for (const line of lines) {
      const group = groups.get(line.material_id);
      if (group) {
        group.push(line);
      } else {
        groups.set(line.material_id, [line]);
      }
    }

    const result: AggregatedMaterialLine[] = [];
    for (const [materialId, group] of groups) {
      const first = group[0];

      const totalAdjustedQty =
        Math.round(group.reduce((sum, l) => sum + l.adjusted_qty, 0) * 1000) /
        1000;

      const contributions: PurchaseContribution[] = group.map((l) => ({
        room_id: l.room_id,
        room_name: l.room_name,
        work_item_id: l.work_item_id,
        work_type_code: l.work_type_code,
        surface_m2: l.surface_m2,
        adjusted_qty: l.adjusted_qty,
      }));

      // Conditionnements du catalogue ; repli sur celui déjà sélectionné par la
      // ligne si le catalogue n'est pas fourni (estimation legacy).
      const packagings = packagingByMaterialId.get(materialId) ?? [
        {
          label: first.packaging_label,
          quantity_per_unit: first.packaging_qty_per_unit,
          unit: first.material_unit,
        },
      ];

      // E1-8 — un matériau découpé à longueur mutualise ses **pièces**, pas ses
      // mètres. Sommer les linéaires puis diviser par la barre réintroduirait
      // le défaut exactement là où il est le plus difficile à voir : deux
      // cloisons de 8 emplacements demandent 16 barres, et la somme des
      // linéaires (2 × 20 m ÷ 2,70) en donnerait 15.
      //
      // Les pièces ne se somment que si elles ont **la même longueur** : deux
      // cloisons de hauteurs différentes ne se découpent pas dans les mêmes
      // barres, et leurs achats restent alors séparés — c'est le sens sûr.
      const pieceLines = group.filter((l) => l.pieces_needed !== undefined);
      const uniformPieces =
        pieceLines.length === group.length &&
        pieceLines.length > 0 &&
        new Set(pieceLines.map((l) => l.piece_length_m)).size === 1;

      const packaging = uniformPieces
        ? this.aggregatePieceCut(pieceLines, first, packagings)
        : this.selectBestPackaging(totalAdjustedQty, packagings);

      const distinctRooms = new Set(
        contributions
          .map((c) => c.room_id)
          .filter((id): id is string => id !== undefined),
      );

      // CV-5 : fourchette basse/haute, seulement si au moins une ligne du
      // groupe en porte une (sinon low/high seraient égaux à adjusted_qty
      // sur toute la ligne, une fourchette de largeur nulle sans intérêt).
      let rangeFields: Partial<AggregatedMaterialLine> = {};
      const hasRange = group.some((l) => l.adjusted_qty_low !== undefined);
      if (hasRange) {
        const totalLow = group.reduce(
          (sum, l) => sum + (l.adjusted_qty_low ?? l.adjusted_qty),
          0,
        );
        const totalHigh = group.reduce(
          (sum, l) => sum + (l.adjusted_qty_high ?? l.adjusted_qty),
          0,
        );
        rangeFields = {
          units_needed_low: this.selectBestPackaging(totalLow, packagings)
            .units_needed,
          units_needed_high: this.selectBestPackaging(totalHigh, packagings)
            .units_needed,
        };
      }

      // E1-11 — la source est invariante par matériau (même `material_id`,
      // même ligne de catalogue), mais la clause de règle (double encollage)
      // dépend de la géométrie posée et peut donc diverger entre pièces. Une
      // ligne mutualisée ne peut porter qu'une seule justification : on ne la
      // garde que si toutes les contributions du groupe portent exactement le
      // même `text_fr`, jamais une phrase composite inventée. Le détail par
      // pièce reste lisible sur l'écran d'estimation granulaire.
      const firstJustification = first.justification?.text_fr;
      const uniformJustification =
        firstJustification !== undefined &&
        group.every((l) => l.justification?.text_fr === firstJustification);

      result.push({
        material_id: materialId,
        material_name: first.material_name,
        material_unit: first.material_unit,
        work_type_code: first.work_type_code,
        work_type_label: first.work_type_label,
        total_adjusted_qty: totalAdjustedQty,
        packaging_label: packaging.label,
        packaging_qty_per_unit: packaging.qty_per_unit,
        units_needed: packaging.units_needed,
        ...(packaging.breakdown.length > 1
          ? { packaging_breakdown: packaging.breakdown }
          : {}),
        room_count: distinctRooms.size || 1,
        contributions,
        ...(uniformJustification ? { justification: first.justification } : {}),
        ...rangeFields,
      });
    }

    return result;
  }
}
