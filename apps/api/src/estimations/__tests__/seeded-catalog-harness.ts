import {
  AggregatedMaterialLine,
  EstimationLineItem,
  MaterialExclusion,
  PackagingUnitsLine,
} from '../entities/estimation-result.entity';
import {
  DeclaredWorkBasis,
  DEFAULT_COATS,
  EstimationEngine,
  MaterialInput,
  MaterialQuantityDriver,
  PackagingInput,
  RoomData,
  WorkBasis,
  WorkItemInput,
} from '../estimation-engine';
import { POSE_UNIQUE, POSES_BY_WORK_TYPE } from '../pose-types';
import { seedMaterials, SeedMaterial } from '../../materials/seed-catalog.data';
import {
  ConsumptionBound,
  consumptionBoundByMaterialKey,
} from '../../materials/consumption-bounds.data';
import { workTypeMaterialLinks } from '../../materials/work-type-materials.data';
import { WorkTypeMaterialRole } from '../../materials/entities/work-type-material.entity';
import { SkillLevel } from '../../projects/entities/project-work-item.entity';
import { seedWorkTypes, SeedWorkType } from '../../projects/work-types.data';

/**
 * Harnais de non-régression du moteur d'estimation (E1-9).
 *
 * Il existe à cause d'un défaut précis, documenté dans `docs/REPRISE_PROJET.md`
 * (§1) : pour repeindre les murs d'une pièce de 4 × 3 m — le cas le plus banal du
 * produit — le moteur produisait **54 lignes et 1 486 unités à acheter**, dont
 * 70 pinceaux et 3 pots de peinture plafond sur un ouvrage « peinture murale ».
 * Les 1 619 tests du dépôt étaient verts. Ils l'étaient parce qu'aucun
 * n'exécutait le moteur sur le catalogue réel : `estimations.service.spec.ts`
 * mocke *un* matériau, `estimation-engine.spec.ts` n'en passe jamais plus de
 * deux. Une suite structurellement incapable d'observer 54 lignes n'atteste rien
 * de ce qui compte.
 *
 * Ce module fournit donc l'inverse : les cas sont **dérivés des données
 * réellement seedées**, jamais écrits à la main.
 *
 *  - ouvrages : `projects/work-types.data.ts` (migration `…003`) ;
 *  - matériaux et liaisons : `materials/seed-catalog.data.ts` (`…006`) et
 *    `materials/work-type-materials.data.ts` (`…066`/`…067`/`…071`) ;
 *  - sélection : la reproduction exacte de `EstimationsService.loadMaterialInputs`.
 *
 * Conséquence voulue : un matériau lié, délié ou requalifié change les
 * instantanés sans qu'on ait à penser à mettre le harnais à jour.
 *
 * ---------------------------------------------------------------------------
 * LES SEPT INVARIANTS MÉTIER (`invariantViolations`)
 * ---------------------------------------------------------------------------
 *
 * Les instantanés ne suffisent pas, et il faut le dire précisément : un
 * instantané fige ce que le moteur produit, **juste ou faux**. Rejoué sur le
 * moteur d'avant E1-1, celui de ce fichier aurait figé les 54 lignes sans
 * broncher, et un `jest -u` distrait aurait béni chaque régression suivante.
 * Les invariants ci-dessous ne dépendent d'aucune valeur enregistrée : `-u` ne
 * peut pas les emporter. Chacun vient d'un défaut réellement constaté dans ce
 * dépôt, pas d'une inquiétude théorique.
 *
 * **I1 — on n'achète jamais moins que le besoin ajusté.**
 * D'où il vient : `STEP_EPSILON` (`estimation-engine.ts`), la tolérance de
 * 1e-6 pas introduite pour que 7,5 L — dont la représentation flottante vaut
 * 7500,000000000001 millièmes — ne demande pas 16 demi-pots au lieu de 15.
 * Une tolérance qui grandit sous-achète en silence. Ce qu'il protège :
 * sur-acheter se voit dans l'instantané et se garde en fond de pot ;
 * sous-acheter renvoie au magasin, et c'est le seul défaut qu'un chantier ne
 * pardonne pas.
 *
 * **I2 — un matériau à `applies_coats` faux ne bouge pas avec les couches.**
 * D'où il vient : E1-4. `computeTheoreticalQty` multipliait par le nombre de
 * couches dès que la *catégorie* de l'ouvrage valait `painting` — d'où les
 * 70 pinceaux et les 3 pots de peinture plafond du défaut d'origine. La règle
 * est passée sur le matériau (`materials_catalog.applies_coats`) ; cet
 * invariant interdit qu'elle redevienne une déduction de catégorie.
 *
 * **I3 — la consommation par m² reste dans un encadrement déclaré en données.**
 * D'où il vient : E1-7. Confrontés aux fiches fabricant, **douze des vingt et
 * un rendements servis étaient faux**, jusqu'à un facteur 4. Aucun test ne
 * pouvait le voir : un rendement faux produit une table plausible, seulement
 * fausse. L'encadrement vit dans `materials/consumption-bounds.data.ts`, dérivé
 * des fiches et **jamais de la valeur seedée** — une borne calée sur le seed
 * serait une tautologie. C'est ce mécanisme qui a attrapé le joint de carrelage
 * à 0,25 kg/m², identique quels que soient le format du carreau et la largeur
 * de joint, quand sa propre fiche Cermix donnait 0,1 à 0,2 kg/m² — corrigé par
 * E1-5. Depuis, les encadrements des matériaux à `consumption_model` valent à
 * la **géométrie par défaut** de l'ouvrage : le reste de la courbe est éprouvé
 * cellule par cellule dans `estimations/tile-consumption.spec.ts`, une exigence
 * plus forte qu'un intervalle.
 *
 * **I4 — le nombre de contenants est minimal à surplus égal.**
 * D'où il vient : E1-5. Le critère d'avant minimisait le surplus absolu et
 * achetait 14 pots de 0,5 L pour 6,66 L de peinture, trois à cinq fois le prix
 * de 5 L + 2,5 L. E1-9 a fait du nombre de contenants le critère **principal** ;
 * cet invariant en éprouve la conséquence observable, par une programmation
 * dynamique **indépendante** de celle du moteur : aucun panachage ne doit
 * donner strictement moins de contenants sans acheter plus de volume.
 *
 * Il reste plus faible que le critère, et c'est voulu : il ne regarde que les
 * achats de volume **inférieur ou égal** à celui retenu, donc il ne dit rien du
 * plafond de surplus ni de la pénalité sur les panachages marginaux. Les
 * décisions d'achat elles-mêmes vivent dans
 * `estimations/packaging-objective.spec.ts`, où elles se défendent une par une.
 * Un invariant qui recopierait le critère complet ne prouverait que la cohérence
 * du moteur avec lui-même.
 *
 * **I5 — monter en compétence n'augmente jamais une quantité.**
 * D'où il vient : DATA-3. Les facteurs de perte **appris** sur les achats réels
 * se superposent au catalogue (`overlayLearnedWasteFactors`) en étant bornés à
 * ±10 points et à l'intervalle 0-30 % — de quoi représenter un débutant à 5 %
 * et un expert à 15 %, c'est-à-dire l'ordre des niveaux inversé, sans qu'aucune
 * borne ne s'en émeuve. Ce que « niveau de compétence » veut dire n'est écrit
 * nulle part ailleurs que dans cet invariant.
 *
 * **I6 — une question requise change au moins une quantité.**
 * D'où il vient : `tile_format`. La question était seedée `required: true` sur
 * `floor_tiling` (`work-types.data.ts`), affichée à l'écran, transportée par
 * les DTO, stockée dans `custom_params` — et lue par **aucun calcul**. On
 * demandait à l'artisan un renseignement obligatoire dont sa liste d'achat ne
 * tenait aucun compte. E1-5 l'a câblé, et cet invariant est passé au vert sans
 * qu'on ait eu à le retoucher : c'est exactement ce qu'on attend d'un
 * garde-fou. Il garde désormais les trois questions du carrelage sol — dont
 * `joint_width_mm`, ajoutée par le même lot.
 *
 * **I7 — un matériau découpé à longueur achète une pièce entière par
 * emplacement.**
 * D'où il vient : E1-8. L'ossature était métrée en mètres puis divisée par la
 * longueur de barre, comme si les chutes se raboutaient — vrai d'un rail, faux
 * d'un montant. Ce qui rend cet invariant indispensable plutôt qu'agréable :
 * l'écart **change de signe** avec la géométrie. Sous 2,50 m de plafond au
 * niveau intermédiaire, `2,50 × 1,08 = 2,70` tombe exactement sur la barre et
 * le compte était juste par coïncidence — or c'est la configuration de
 * référence du harnais, donc aucun instantané ne pouvait rien montrer. Le
 * compte attendu est recalculé depuis l'assiette de l'ouvrage, jamais depuis
 * les champs de la ligne.
 *
 * Chaque violation nomme l'ouvrage, le matériau et les deux valeurs comparées,
 * et porte son numéro d'invariant en préfixe — `[I0]` étant réservé aux gardes
 * structurels antérieurs (un ouvrage chiffre ses matériaux liés, ni plus ni
 * moins — E1-8 y ajoute « à ses exclusions motivées près » — et en garde un
 * principal). Elles sont **renvoyées en clair** plutôt
 * qu'asserties une par une : la suite dit alors *tout* ce qui a cassé, pas le
 * premier cas venu.
 *
 * Ce que ces invariants attrapent réellement n'est pas affirmé, c'est démontré :
 * `invariant-detection.spec.ts` remet chacun des défauts ci-dessus dans le
 * moteur et exige que l'invariant correspondant le nomme.
 */

/** Les 3 niveaux de compétence, dans l'ordre de l'énumération. */
export const SKILL_LEVELS: SkillLevel[] = Object.values(SkillLevel);

/**
 * Pose des ouvrages **sans variante de calepinage** — peintures, cloison sèche,
 * revêtement mural.
 *
 * Avant E1-7 cette constante s'appelait `IMPLICIT_POSE` et désignait tout autre
 * chose : le mot que le moteur substituait quand l'utilisateur ne choisissait
 * pas sa pose, y compris sur un carrelage, où il ne correspondait à aucune ligne
 * du catalogue et faisait tomber le chiffrage sur 10 % génériques. Ce chemin
 * n'existe plus : un ouvrage qui ne déclare pas sa pose reçoit celle que
 * `pose-types.ts` retient pour lui, et c'est toujours une pose que ses matériaux
 * connaissent. `standard` est redevenu un nom de pose, et rien d'autre.
 */
export const POSE_UNIQUE_CASE = POSE_UNIQUE;

const seedMaterialByKey = new Map<string, SeedMaterial>(
  seedMaterials.map((mat) => [`${mat.category}:${mat.name}`, mat]),
);

/**
 * Identité d'un matériau dans le harnais. En production c'est l'uuid de
 * `materials_catalog` ; ici le couple (catégorie, nom), qui porte la même
 * propriété — un matériau partagé par deux ouvrages (`Joint fin 1-6mm`,
 * `Sous-couche universelle`) garde **une seule** identité, donc s'agrège comme
 * en production.
 */
const materialId = (category: string, name: string): string =>
  `${category}:${name}`;

/**
 * Matériaux d'un ouvrage, prêts pour le moteur. Reproduit
 * `EstimationsService.loadMaterialInputs` : liaisons **non optionnelles**
 * seulement, triées par `display_order`.
 *
 * Les deux autres filtres de production (`is_active`, `is_eco`) n'ont pas
 * d'équivalent ici parce qu'ils n'ont pas de valeur à filtrer : le catalogue
 * seedé ne porte ni matériau désactivé ni matériau éco — les alternatives éco
 * arrivent par `material_eco_equivalences` (PLAT-3) et ne sont jamais liées à un
 * ouvrage. Si cela changeait, la liaison échouerait à se résoudre ci-dessous
 * plutôt que de fausser silencieusement un instantané.
 */
export function materialsForWorkType(workTypeCode: string): MaterialInput[] {
  return workTypeMaterialLinks
    .filter((link) => link.work_type_code === workTypeCode && !link.is_optional)
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((link) => {
      const seedMaterial = seedMaterialByKey.get(
        `${link.material_category}:${link.material_name}`,
      );
      if (!seedMaterial) {
        throw new Error(
          'Matériau introuvable dans le catalogue seedé : ' +
            `${link.material_category}/${link.material_name}`,
        );
      }
      return {
        id: materialId(link.material_category, link.material_name),
        name: seedMaterial.name,
        unit: seedMaterial.unit,
        yield_per_unit: seedMaterial.yield_per_unit,
        applies_coats: seedMaterial.applies_coats ?? false,
        quantity_driver: seedMaterial.quantity_driver ?? 'work_surface',
        consumption_model: seedMaterial.consumption_model ?? null,
        // E1-6 : les deux dimensions ne valent qu'ensemble, exactement comme
        // dans `EstimationsService.loadMaterialInputs`.
        roll_spec:
          seedMaterial.roll_width_cm && seedMaterial.roll_length_cm
            ? {
                width_cm: seedMaterial.roll_width_cm,
                length_cm: seedMaterial.roll_length_cm,
              }
            : null,
        // E1-8 : et celui-ci ne décide pas d'une quantité mais de la présence
        // même de la ligne, exactement comme dans `loadMaterialInputs`.
        vapour_barrier: seedMaterial.vapour_barrier ?? null,
        // E1-8 : absent = aboutable, comme le défaut de la colonne.
        offcuts_reusable: seedMaterial.offcuts_reusable ?? true,
        role: link.role,
        waste_factors: seedMaterial.waste_factors.map((wf) => ({
          pose_type: wf.pose_type,
          skill_level: wf.skill_level,
          factor_percent: wf.factor_percent,
        })),
        packagings: seedMaterial.packagings.map((pkg) => ({
          label: pkg.label,
          quantity_per_unit: pkg.quantity_per_unit,
          unit: pkg.unit,
        })),
      };
    });
}

/**
 * Rôles portés par les liaisons, par identité de matériau. Le moteur ne recopie
 * pas le rôle dans ses lignes ; l'instantané l'affiche parce que c'est lui qui
 * distingue « la peinture » de « la sous-couche » à la relecture.
 */
export const roleByMaterialId = new Map<string, WorkTypeMaterialRole>(
  workTypeMaterialLinks.map((link) => [
    materialId(link.material_category, link.material_name),
    link.role,
  ]),
);

/**
 * Poses **que l'ouvrage peut transmettre au moteur**, la première étant celle
 * qu'il retient quand la question n'est pas répondue.
 *
 * E1-7 a changé la source de cette liste, et c'est le cœur du lot. Elle se
 * lisait sur les facteurs de perte des matériaux, plus un `standard` ajouté
 * d'office « parce que c'est le chemin de production majoritaire » — ce qui
 * fabriquait des cas que le produit ne pouvait pas produire (une pose `plain`
 * de revêtement mural, qu'aucun écran n'offrait) et en manquait un autre (le
 * carrelage mural, dont la pose n'était pas demandée du tout).
 *
 * Elle se lit désormais sur l'**ouvrage** (`pose-types.ts`), c'est-à-dire sur ce
 * que l'utilisateur peut réellement répondre. Le harnais chiffre donc exactement
 * les chantiers que le produit sait décrire, ni plus ni moins — et
 * `waste-factor-coverage.spec.ts` (W2) garantit en retour que cette liste est
 * bien celle des options de la question.
 */
export function poseTypesForWorkType(workTypeCode: string): string[] {
  return [...(POSES_BY_WORK_TYPE[workTypeCode] ?? [POSE_UNIQUE])];
}

export interface HarnessCase {
  workType: SeedWorkType;
  skillLevel: SkillLevel;
  poseType: string;
}

/**
 * Le produit cartésien complet : ouvrage × niveau × pose disponible. Dérivé,
 * jamais énuméré — ajouter un ouvrage au seed ajoute ses cas d'office.
 */
export const harnessCases: HarnessCase[] = seedWorkTypes.flatMap((workType) =>
  poseTypesForWorkType(workType.code).flatMap((poseType) =>
    SKILL_LEVELS.map((skillLevel) => ({ workType, skillLevel, poseType })),
  ),
);

/**
 * Un cas nommé, pour les scénarios qui composent plusieurs ouvrages. Sans pose
 * précisée, celle que l'ouvrage retient quand la question n'est pas répondue.
 */
export function caseFor(
  workTypeCode: string,
  skillLevel: SkillLevel,
  poseType?: string,
): HarnessCase {
  const workType = seedWorkTypes.find((wt) => wt.code === workTypeCode);
  if (!workType) {
    throw new Error(`Ouvrage absent du seed : ${workTypeCode}`);
  }
  return {
    workType,
    skillLevel,
    poseType: poseType ?? defaultPoseFor(workTypeCode),
  };
}

/** Pose retenue par l'ouvrage quand la question n'est pas répondue. */
export const defaultPoseFor = (workTypeCode: string): string =>
  poseTypesForWorkType(workTypeCode)[0];

/**
 * Paramètres supplémentaires poussés dans `custom_params`, par code d'ouvrage.
 *
 * C'est le point d'entrée des configurations à venir — assiette de cloison,
 * hauteur sous plafond, raccord de papier peint — et la raison pour laquelle
 * elles n'exigeront pas de réécrire ce fichier : une entrée dans ce dictionnaire
 * traverse `workItemFor`, donc les instantanés **et** les sept invariants.
 */
export type ParamsByWorkType = Record<string, Record<string, unknown>>;

const paramsFor = (
  paramsByWorkType: ParamsByWorkType,
  workTypeCode: string,
): Record<string, unknown> => paramsByWorkType[workTypeCode] ?? {};

/** Assiette d'épreuve d'un ouvrage à quantité déclarée, par code (E1-3). */
export type DeclaredBasisByWorkType = Record<string, DeclaredWorkBasis>;

/**
 * L'assiette de cloison annoncée comme configuration à venir par E1-1, arrivée.
 * Elle entre par la **donnée** : une entrée dans ce dictionnaire traverse
 * `workItemFor`, donc les instantanés des trois géométries **et** les six
 * invariants, sans qu'aucun d'eux ne soit réécrit.
 *
 * La cloison de référence est celle du cas métier : 4,00 m de long, 2,50 m de
 * haut — la hauteur de la chambre de référence, donc une cloison qui y tient —
 * parementée sur ses deux faces. C'est la cloison qu'un artisan commande, et
 * celle dont `drywall-created-partition.spec.ts` énonce le métré attendu.
 */
export const DEFAULT_DECLARED_BASIS: DeclaredBasisByWorkType = {
  drywall: { length_m: 4, height_m: 2.5, clad_faces: 2 },
};

/**
 * Work item du moteur pour un cas. La pose **par défaut** de l'ouvrage se dit en
 * n'envoyant rien — `custom_params` vide — plutôt qu'en l'envoyant nommément :
 * c'est ce que fait un appelant qui ne répond pas à la question, et le seul
 * moyen d'éprouver `resolveLayingPose`. Toute autre pose est envoyée telle
 * quelle. `number_of_coats` reste absent, donc au défaut de 2 couches, comme
 * pour un utilisateur qui ne le renseigne pas.
 *
 * `extraParams` s'ajoute **après** la pose, donc peut la surcharger : c'est
 * voulu, l'invariant I6 s'en sert pour éprouver `laying_pattern` valeur par
 * valeur sans construire un second chemin de code.
 */
export function workItemFor(
  testCase: HarnessCase,
  workItemId: string,
  extraParams: Record<string, unknown> = {},
  declaredBasisByWorkType: DeclaredBasisByWorkType = DEFAULT_DECLARED_BASIS,
): WorkItemInput {
  const workType = testCase.workType;
  const base: WorkItemInput = {
    id: workItemId,
    work_type_code: workType.code,
    work_type_label: workType.label_fr,
    category: workType.category,
    surface_target: workType.surface_target,
    skill_level: testCase.skillLevel,
    custom_params: {
      ...(testCase.poseType === defaultPoseFor(workType.code)
        ? {}
        : { laying_pattern: testCase.poseType }),
      ...extraParams,
    },
    materials: materialsForWorkType(workType.code),
  };

  if (workType.quantity_basis !== 'declared') {
    return base;
  }

  const declaredBasis = declaredBasisByWorkType[workType.code];
  // Signalé plutôt que sauté, comme une question requise sans valeur d'épreuve
  // (I6) : un ouvrage à assiette déclarée qu'on ajouterait au seed sans lui
  // donner d'assiette sortirait ici, et non en chiffrant on ne sait quoi.
  if (!declaredBasis) {
    throw new Error(
      `Ouvrage à assiette déclarée sans assiette d'épreuve : ${workType.code} ` +
        `(HarnessConfig.declaredBasisByWorkType)`,
    );
  }

  return {
    ...base,
    declared_basis: declaredBasis,
    frame_spec: workType.frame_spec,
  };
}

/** Conditionnements par matériau, tels que `EstimationsService` les mémorise. */
export function packagingByMaterialId(
  materials: MaterialInput[],
): Map<string, PackagingInput[]> {
  return new Map(materials.map((mat) => [mat.id, mat.packagings]));
}

// ---------------------------------------------------------------------------
// Rendu — un instantané qu'on ne peut pas relire ne protège rien
// ---------------------------------------------------------------------------

/**
 * Sans sérialiseur, `pretty-format` entoure une chaîne de guillemets : chaque
 * bloc gagnerait un `"` parasite sur sa première et sa dernière ligne, et
 * l'échappement rendrait la table illisible.
 *
 * Restreint aux chaînes **multi-lignes**, c'est-à-dire aux blocs de ce harnais.
 * Une chaîne d'une seule ligne garde ses guillemets : sur celle-là, ils portent
 * une information — un espace de bord se verrait, sans eux non. À appeler une
 * fois par fichier de suite.
 */
export function installReadableSnapshots(): void {
  expect.addSnapshotSerializer({
    test: (value: unknown) => typeof value === 'string' && value.includes('\n'),
    print: (value: unknown) => value as string,
  });
}

interface Column {
  header: string;
  /** Largeur fixe. `0` = dernière colonne, non complétée. */
  width: number;
  align?: 'right';
}

/**
 * Largeurs **fixes**, et la seule colonne de largeur variable placée en
 * dernier : un libellé plus long qu'attendu décale alors sa propre fin de ligne
 * et rien d'autre. Des largeurs calculées sur le contenu produiraient, au
 * moindre matériau renommé, un diff qui touche toutes les lignes du bloc.
 */
const LINE_COLUMNS: Column[] = [
  { header: 'matériau', width: 31 },
  { header: 'rôle', width: 12 },
  { header: 'perte', width: 6, align: 'right' },
  { header: 'origine', width: 9 },
  { header: 'couches', width: 7, align: 'right' },
  { header: 'qté ajustée', width: 13, align: 'right' },
  { header: 'unités', width: 6, align: 'right' },
  { header: 'achat', width: 0 },
];

/**
 * `normalize('NFC')` avant de compléter : le remplissage compte des unités
 * UTF-16, donc un « é » décomposé occuperait deux cases pour un seul caractère
 * affiché et décalerait la colonne suivante.
 */
const pad = (raw: string, column: Column): string => {
  const value = raw.normalize('NFC');
  return column.width <= 0
    ? value
    : column.align === 'right'
      ? value.padStart(column.width)
      : value.padEnd(column.width);
};

const row = (columns: Column[], cells: string[]): string =>
  columns
    .map((column, i) => pad(cells[i] ?? '', column))
    .join(' ')
    .trimEnd();

/**
 * Trois décimales partout : c'est déjà l'arrondi du moteur
 * (`Math.round(x * 1000) / 1000`), donc aucun chiffre n'est perdu et aucune
 * représentation flottante ne peut faire diverger un instantané d'une plateforme
 * à l'autre.
 */
const qty = (value: number, unit: string): string =>
  `${value.toFixed(3)} ${unit}`;

const surface = (value: number): string => `${value.toFixed(3)} m²`;

/**
 * D'où sort le pourcentage de perte. Le moteur ne le dit pas complètement :
 * `waste_factor_source` vaut `catalog` aussi bien pour une correspondance exacte
 * `(pose, niveau)` que pour le repli sur la pose `standard` du même niveau
 * (`resolveWasteFactor`). Les deux se lisent pourtant très différemment — en
 * pose diagonale, `Stratifié 8mm AC4` a bien son facteur diagonal quand ses deux
 * sous-couches, qui n'en déclarent pas, retombent sur leur valeur droite. Sans
 * cette colonne, ce repli légitime est indiscernable d'une régression où le
 * principal aussi aurait perdu son facteur.
 */
const wasteOrigin = (
  line: EstimationLineItem,
  material: MaterialInput,
  // `string` et non `SkillLevel` : `WasteFactorInput.skill_level` est une chaîne
  // libre côté moteur, et comparer une énumération à une chaîne est justement ce
  // que `no-unsafe-enum-comparison` interdit.
  skillLevel: string,
): string => {
  // `défaut` n'est plus produit depuis E1-7 : la résolution lève au lieu de
  // retomber sur une valeur générique. La branche reste écrite — si elle
  // réapparaissait dans un instantané, ce serait la signature exacte du défaut
  // que ce lot a supprimé, et il faut qu'elle se lise plutôt qu'elle se devine.
  if (line.waste_factor_source === 'default') {
    return 'défaut';
  }
  const exact = material.waste_factors.some(
    (wf) => wf.pose_type === line.pose_type && wf.skill_level === skillLevel,
  );
  return exact ? 'exact' : 'pose unique';
};

/**
 * Volume réellement acheté, reconstitué **format par format** contre le
 * catalogue. `units_needed × packaging_qty_per_unit` donnerait la même valeur,
 * mais sur un achat panaché `packaging_qty_per_unit` est un contenu *moyen*
 * (`totalSteps / totalUnits / 1000`, cf. `selectBestPackaging`) : un produit de
 * deux flottants, là où la somme des formats est exacte.
 */
export function purchasedVolume(
  purchase: {
    packaging_breakdown?: PackagingUnitsLine[];
    packaging_label: string;
    units_needed: number;
  },
  material: MaterialInput,
): number {
  const sizeByLabel = new Map(
    material.packagings.map((pkg) => [pkg.label, pkg.quantity_per_unit]),
  );
  const parts = purchase.packaging_breakdown ?? [
    { label: purchase.packaging_label, units: purchase.units_needed },
  ];
  return parts.reduce(
    (sum, part) => sum + part.units * (sizeByLabel.get(part.label) ?? 0),
    0,
  );
}

/**
 * `purchaseCost` a été **retiré** par E1-9, et c'est le point du lot.
 *
 * Cette fonction calculait `S = q_min × contenants + volume`, le coût approché
 * qu'E1-5 minimisait, et la suite s'en servait pour affirmer que mutualiser ne
 * coûte jamais plus cher. Le moteur ne minimise plus `S` : il minimise le
 * **nombre de contenants** (`selectBestPackaging`). Continuer à mesurer `S`
 * reviendrait à vérifier une promesse que personne ne fait plus — et cela
 * échouait effectivement de 8 unités sur la colle en pâte, pour un achat qui
 * est meilleur au regard du nouveau critère.
 *
 * Ce qui la remplace : `extraContainers`, qui éprouve la propriété *démontrée*
 * (cf. `aggregatePurchases`), et `extraVolume`, qui énumère le prix payé pour
 * elle.
 */

/**
 * Format d'un achat, contenant par contenant : « 1 × Pot 5 L + 1 × Pot 2.5 L ».
 * Le libellé composé par le moteur (`packaging_label`) omet les « 1 × » ; ici on
 * les écrit, parce qu'un instantané se relit sans connaître cette convention.
 */
const purchaseCell = (purchase: {
  packaging_breakdown?: PackagingUnitsLine[];
  packaging_label: string;
  units_needed: number;
}): string =>
  (
    purchase.packaging_breakdown ?? [
      { label: purchase.packaging_label, units: purchase.units_needed },
    ]
  )
    .map((part) => `${part.units} × ${part.label}`)
    .join(' + ');

const caseHeading = (testCase: HarnessCase): string =>
  `ouvrage : ${testCase.workType.label_fr} (${testCase.workType.code}) · ` +
  (testCase.workType.quantity_basis === 'declared'
    ? 'assiette déclarée'
    : `surface ${testCase.workType.surface_target}`) +
  `\nniveau  : ${testCase.skillLevel} · pose : ${testCase.poseType}` +
  (testCase.poseType === defaultPoseFor(testCase.workType.code)
    ? ' (non déclarée)'
    : '');

const metres = (value: number): string => `${value.toFixed(3)} m`;

/**
 * L'assiette du cas, en tête de table.
 *
 * Pour un ouvrage dérivé de la pièce, c'est la ligne « surface » d'avant E1-3,
 * au caractère près et calculée depuis les **mêmes** valeurs (celles de la
 * première ligne, déjà arrondies par le moteur) : les instantanés des six
 * ouvrages de recouvrement ne bougent pas d'un octet.
 *
 * Pour un ouvrage à assiette déclarée, c'est là que se relit tout l'enjeu du
 * lot : le parement porte le nombre de faces, la trame ne le porte pas.
 */
const basisBlock = (
  testCase: HarnessCase,
  workItem: WorkItemInput,
  basis: WorkBasis,
  first: EstimationLineItem,
): string[] => {
  const declared = workItem.declared_basis;
  if (!declared) {
    const deducted = first.gross_surface_m2 - first.surface_m2;
    return [
      `surface : brute ${surface(first.gross_surface_m2)} · nette ${surface(first.surface_m2)} · déduction ${surface(deducted)}`,
    ];
  }

  const block = [
    `assiette: ${metres(declared.length_m)} × ${metres(declared.height_m)} ` +
      `× ${declared.clad_faces} face(s) → ouvrage ${surface(basis.work_surface_m2)} · ` +
      `parement ${surface(basis.clad_surface_m2)}`,
  ];

  const spec = workItem.frame_spec;
  if (basis.frame && spec) {
    block.push(
      `trame   : entraxe ${spec.stud_spacing_m.toFixed(2)} m · ` +
        `${basis.frame.stud_count} montants (dont ${spec.extra_studs} déclarés) ` +
        `× ${metres(declared.height_m)} = ${metres(basis.frame.stud_length_m)} · ` +
        `${spec.runner_courses} lisses × ${metres(declared.length_m)} = ` +
        `${metres(basis.frame.runner_length_m)}`,
    );
  }

  return block;
};

/**
 * Matériaux d'un cas, indexés comme le moteur les identifie. Résoudre par
 * `material_id` et non par position : l'alignement par index ne tient que pour
 * un unique work item, et tomberait dès le projet à deux pièces.
 */
const materialsById = (testCase: HarnessCase): Map<string, MaterialInput> =>
  new Map(
    materialsForWorkType(testCase.workType.code).map((mat) => [mat.id, mat]),
  );

const lineCells = (
  line: EstimationLineItem,
  material: MaterialInput,
  skillLevel: SkillLevel,
): string[] => [
  line.material_name,
  material.role ?? '-',
  `${line.waste_factor_percent} %`,
  wasteOrigin(line, material, skillLevel),
  line.number_of_coats === undefined ? '' : String(line.number_of_coats),
  qty(line.adjusted_qty, line.material_unit),
  String(line.units_needed),
  // E1-8 : sur un matériau découpé à longueur, le nombre de barres ne se déduit
  // pas de la quantité affichée — 20,000 m en barres de 2,70 m « devrait »
  // faire 8 barres par hasard ici, et 28 au lieu de 30 ailleurs. La
  // décomposition est donc écrite, faute de quoi l'instantané se relit comme
  // une division et masque exactement ce que ce lot corrige.
  line.pieces_needed === undefined
    ? purchaseCell(line)
    : `${purchaseCell(line)} · ${line.pieces_needed} pièces de ${metres(
        line.piece_length_m!,
      )}, ${line.pieces_per_bar} par barre`,
];

/** Chiffrage d'un cas sur une pièce, rendu en table relisible. */
export function renderRoomCase(
  engine: EstimationEngine,
  harnessRoom: HarnessRoom,
  testCase: HarnessCase,
  paramsByWorkType: ParamsByWorkType = {},
): string {
  const byId = materialsById(testCase);
  const workItem = workItemFor(
    testCase,
    'wi-1',
    paramsFor(paramsByWorkType, testCase.workType.code),
  );
  const { items: lines, exclusions } = engine.computeEstimationDetailed(
    harnessRoom.room,
    [workItem],
  );
  const basis = engine.computeWorkBasis(harnessRoom.room, workItem);
  const first = lines[0];

  return [
    `pièce   : ${harnessRoom.name}`,
    caseHeading(testCase),
    ...basisBlock(testCase, workItem, basis, first),
    '',
    row(
      LINE_COLUMNS,
      LINE_COLUMNS.map((column) => column.header),
    ),
    ...lines.map((line) =>
      row(
        LINE_COLUMNS,
        lineCells(line, byId.get(line.material_id)!, testCase.skillLevel),
      ),
    ),
    // E1-8 : une ligne qui disparaît doit se **lire** dans l'instantané. Sans
    // ce bloc, retirer un matériau par erreur produirait un instantané plus
    // court et parfaitement plausible — exactement le genre de régression qu'un
    // `jest -u` distrait bénit.
    ...(exclusions.length > 0
      ? [
          '',
          ...exclusions.map(
            (e) => `écarté  : ${e.material_name} — ${e.reason_fr}`,
          ),
        ]
      : []),
    '',
    `total : ${lines.length} lignes · ${lines.reduce((sum, l) => sum + l.units_needed, 0)} contenants`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Projet à deux pièces — ce que promet la mutualisation ENG-2
// ---------------------------------------------------------------------------

export interface HarnessRoom {
  name: string;
  room: RoomData;
}

export interface ProjectRun {
  perRoomLines: EstimationLineItem[];
  aggregated: AggregatedMaterialLine[];
  /**
   * Contenants qu'il aurait fallu acheter sans mutualiser : une décision d'achat
   * par (pièce × ouvrage). C'est la référence contre laquelle ENG-2 se mesure.
   */
  perRoomUnitsByMaterial: Map<string, number>;
}

/**
 * Un projet : chaque ouvrage de `cases` posé dans chaque pièce, chiffré pièce
 * par pièce puis mutualisé.
 *
 * Reproduit `EstimationsService.estimate` dans le détail qui compte : la pièce
 * est attachée aux lignes **après** `computeEstimation` (le moteur ne la connaît
 * pas), et toutes les lignes de toutes les pièces passent dans **un seul** appel
 * à `aggregatePurchases`. Attacher `room_id` en amont donnerait un `room_count`
 * de 1 et des contributions sans pièce : la suite passerait sans rien prouver.
 */
export function runProject(
  engine: EstimationEngine,
  rooms: HarnessRoom[],
  cases: HarnessCase[],
  paramsByWorkType: ParamsByWorkType = {},
): ProjectRun {
  const perRoomLines: EstimationLineItem[] = [];
  const perRoomUnitsByMaterial = new Map<string, number>();
  const packagings = new Map<string, PackagingInput[]>();

  rooms.forEach((harnessRoom, roomIndex) => {
    const workItems = cases.map((testCase, caseIndex) =>
      workItemFor(
        testCase,
        `wi-${roomIndex + 1}-${caseIndex + 1}`,
        paramsFor(paramsByWorkType, testCase.workType.code),
      ),
    );
    for (const workItem of workItems) {
      for (const mat of workItem.materials) {
        if (!packagings.has(mat.id)) packagings.set(mat.id, mat.packagings);
      }
    }

    for (const line of engine.computeEstimation(harnessRoom.room, workItems)) {
      perRoomLines.push({
        ...line,
        room_id: `room-${roomIndex + 1}`,
        room_name: harnessRoom.name,
      });
      perRoomUnitsByMaterial.set(
        line.material_id,
        (perRoomUnitsByMaterial.get(line.material_id) ?? 0) + line.units_needed,
      );
    }
  });

  return {
    perRoomLines,
    aggregated: engine.aggregatePurchases(perRoomLines, packagings),
    perRoomUnitsByMaterial,
  };
}

/**
 * Ce que la mutualisation a fait, dit dans le bon sens (E1-9).
 *
 * L'affichage d'avant écrivait `-1 aucun contenant évité` : le compte niait le
 * libellé, et le libellé cachait le compte. Une mutualisation qui **ajoute** un
 * contenant est un fait qui doit se lire comme tel, pas une économie négative.
 *
 * Depuis E1-9, `saved < 0` est impossible sans prix au catalogue — c'est la
 * propriété que démontre `aggregatePurchases`. La troisième branche est donc un
 * garde-fou, et son texte est celui qu'on veut lire si elle reparaît.
 */
function mutualisationVerdict(saved: number): string {
  if (saved > 0) {
    return saved > 1 ? 'contenants évités' : 'contenant évité';
  }
  if (saved === 0) {
    return 'aucun contenant évité';
  }
  return saved < -1
    ? "contenants de plus qu'en achat séparé"
    : "contenant de plus qu'en achat séparé";
}

const CONTRIBUTION_COLUMNS: Column[] = [
  { header: '', width: 2 },
  { header: 'pièce', width: 24 },
  { header: 'ouvrage', width: 17 },
  { header: 'qté ajustée', width: 13, align: 'right' },
  { header: 'unités', width: 6, align: 'right' },
  { header: 'achat', width: 0 },
];

/**
 * Rendu du projet : par matériau, ce que demande chaque (pièce × ouvrage), puis
 * l'achat mutualisé et l'écart de contenants.
 *
 * L'écart est écrit noir sur blanc parce que c'est lui, et non le tableau
 * mutualisé seul, qui rend une régression impossible à valider distraitement :
 * un moteur qui cesserait de mutualiser produirait un instantané différent mais
 * parfaitement plausible — sauf sur cette ligne, où l'économie tomberait à zéro.
 */
export function renderProject(
  engine: EstimationEngine,
  rooms: HarnessRoom[],
  cases: HarnessCase[],
  paramsByWorkType: ParamsByWorkType = {},
): string {
  const { perRoomLines, aggregated, perRoomUnitsByMaterial } = runProject(
    engine,
    rooms,
    cases,
    paramsByWorkType,
  );

  const roomSummary = rooms
    .map((harnessRoom) => {
      const line = perRoomLines.find((l) => l.room_name === harnessRoom.name)!;
      return `${harnessRoom.name} (nette ${surface(line.surface_m2)})`;
    })
    .join(' · ');

  const workSummary = cases
    .map(
      (testCase) =>
        `${testCase.workType.label_fr} (${testCase.workType.code}, pose ${testCase.poseType})`,
    )
    .join(' · ');

  const blocks = aggregated.map((agg) => {
    const contributions = perRoomLines.filter(
      (l) => l.material_id === agg.material_id,
    );
    const splitUnits = perRoomUnitsByMaterial.get(agg.material_id) ?? 0;
    const saved = splitUnits - agg.units_needed;

    return [
      // `work_type_code` de la ligne agrégée : celui du **premier** contributeur
      // seulement. Un matériau partagé par deux ouvrages n'en nomme donc qu'un —
      // fait visible à l'écran, donc figé ici plutôt que découvert en production.
      `${agg.material_name}  [${agg.work_type_code}] · ${agg.room_count} pièces · ${contributions.length} contributions`,
      ...contributions.map((line) =>
        row(CONTRIBUTION_COLUMNS, [
          '',
          line.room_name!,
          line.work_type_code,
          qty(line.adjusted_qty, line.material_unit),
          String(line.units_needed),
          purchaseCell(line),
        ]),
      ),
      row(CONTRIBUTION_COLUMNS, [
        '',
        'mutualisé',
        '',
        qty(agg.total_adjusted_qty, agg.material_unit),
        String(agg.units_needed),
        purchaseCell(agg),
      ]),
      row(CONTRIBUTION_COLUMNS, [
        '',
        'économie de mutualisation',
        '',
        '',
        `${Math.abs(saved)}`,
        mutualisationVerdict(saved),
      ]),
    ].join('\n');
  });

  const totalSplit = [...perRoomUnitsByMaterial.values()].reduce(
    (sum, units) => sum + units,
    0,
  );
  const totalMutualised = aggregated.reduce(
    (sum, agg) => sum + agg.units_needed,
    0,
  );

  return [
    `projet  : ${rooms.length} pièces · niveau ${cases[0].skillLevel}`,
    `pièces  : ${roomSummary}`,
    `ouvrages: ${workSummary}`,
    '',
    ...blocks,
    '',
    `total : ${aggregated.length} matériaux · ${totalSplit} contenants pièce par pièce → ${totalMutualised} mutualisés`,
  ].join('\n');
}

/**
 * Inventaire des cas énumérés, matériaux liés compris.
 *
 * Il est figé pour une raison précise : un instantané **obsolète** ne fait
 * jamais échouer jest, `--ci` compris. Un cas qui disparaîtrait — un ouvrage
 * délié, une pose retirée du catalogue — laisserait donc la suite verte, avec un
 * simple « 1 snapshot obsolete » en bas d'écran. Ici, sa disparition est une
 * ligne supprimée dans un diff, que quelqu'un doit justifier.
 */
/**
 * Ce sur quoi le rendement d'un matériau est exprimé (E1-3). Écrit en toutes
 * lettres dans l'inventaire parce que c'est la seule chose qui distingue une
 * plaque d'un montant sur une cloison : la première suit le nombre de faces, le
 * second la trame. Un relecteur doit pouvoir vérifier cette attribution matériau
 * par matériau sans ouvrir le catalogue.
 */
const DRIVER_LABELS: Record<MaterialQuantityDriver, string> = {
  work_surface: "surface d'ouvrage",
  clad_faces: 'parement (× faces)',
  frame_runner: 'lisses (trame)',
  frame_stud: 'montants (trame)',
};

export function renderCaseInventory(): string {
  const blocks = seedWorkTypes.map((workType) => {
    const materials = materialsForWorkType(workType.code);
    const poses = poseTypesForWorkType(workType.code);
    const spec = workType.frame_spec;
    return [
      `${workType.code} · ${workType.label_fr} · ${workType.category} · surface ${workType.surface_target}`,
      `  assiette : ${workType.quantity_basis}` +
        (spec
          ? ` · trame : entraxe ${spec.stud_spacing_m} m, ${spec.extra_studs} montants déclarés, ${spec.runner_courses} lisses`
          : ' · aucune trame'),
      `  poses : ${poses.join(', ')} · niveaux : ${SKILL_LEVELS.join(', ')} · ${poses.length * SKILL_LEVELS.length} cas`,
      ...materials.map(
        (mat) =>
          `  - ${mat.name.padEnd(31)} ${(mat.role ?? '-').padEnd(12)} ${mat.unit.padEnd(5)} rendement ${mat.yield_per_unit} · couches ${mat.applies_coats ? 'oui' : 'non'} · assiette ${DRIVER_LABELS[mat.quantity_driver ?? 'work_surface']} · loi ${mat.consumption_model ?? 'aucune'} · rouleau ${
            mat.roll_spec
              ? `${mat.roll_spec.length_cm / 100} × ${mat.roll_spec.width_cm / 100} m (rendement non lu)`
              : 'aucun'
          }${mat.vapour_barrier ? ` · pare-vapeur ${mat.vapour_barrier}` : ''}`,
      ),
    ].join('\n');
  });

  return [...blocks, '', `total : ${harnessCases.length} cas`].join('\n');
}

// ---------------------------------------------------------------------------
// Invariants — ce qu'un `--update-snapshot` distrait ne doit pas pouvoir effacer
// ---------------------------------------------------------------------------

/**
 * Ce qui fait varier une exécution du harnais, rassemblé en un seul objet.
 *
 * L'intention est précise : les configurations annoncées — assiette de cloison,
 * hauteur sous plafond, raccord de papier peint — doivent entrer par des
 * **données**, pas par une réécriture des invariants. Une nouvelle question
 * d'ouvrage se déclare dans `questionProbes`, un nouveau paramètre de calcul
 * dans `paramsByWorkType`, une nouvelle géométrie dans le `HarnessRoom` passé
 * en argument, un nouveau matériau dans `consumption-bounds.data.ts`.
 */
export interface HarnessConfig {
  /** Cas éprouvés. Un sous-ensemble reste licite : tout est dérivé de lui. */
  cases: HarnessCase[];
  /** Nombres de couches comparés par I2. Au moins deux valeurs distinctes. */
  coatCounts: number[];
  /** Paramètres poussés dans `custom_params`, par ouvrage. */
  paramsByWorkType: ParamsByWorkType;
  /**
   * Assiette d'épreuve des ouvrages à quantité déclarée (E1-3). Un ouvrage
   * `declared` absent de ce dictionnaire fait lever `workItemFor` : il ne peut
   * pas traverser les invariants sans que son assiette ait été décidée.
   */
  declaredBasisByWorkType: DeclaredBasisByWorkType;
  /**
   * Valeurs d'épreuve d'une question `number`, par clé (I6). Une question
   * `select` fournit les siennes ; une question `number` n'en a pas, et une
   * question requise sans valeur d'épreuve est signalée plutôt que sautée —
   * c'est ce qui empêchera une future « hauteur sous plafond » d'entrer dans le
   * produit sans que personne n'éprouve son effet.
   */
  questionProbes: Record<string, unknown[]>;
  /** Encadrements de consommation (I3), indexés par `catégorie:nom`. */
  bounds: Map<string, ConsumptionBound>;
  /**
   * Tolérance relative sur le taux de consommation (I3). Le moteur arrondit
   * surfaces et quantités au millième : 1e-3 absorbe cet arrondi, et rien
   * d'autre — le défaut le plus discret qu'on cherche ici (0,25 contre 0,20)
   * pèse 25 %.
   */
  rateTolerance: number;
}

export const DEFAULT_HARNESS_CONFIG: HarnessConfig = {
  cases: harnessCases,
  coatCounts: [1, 2, 3],
  paramsByWorkType: {},
  declaredBasisByWorkType: DEFAULT_DECLARED_BASIS,
  questionProbes: {},
  bounds: consumptionBoundByMaterialKey,
  rateTolerance: 1e-3,
};

const caseLabel = (testCase: HarnessCase): string =>
  `${testCase.workType.code} · ${testCase.skillLevel} · ${testCase.poseType}`;

/** Taux de consommation, tel que I3 le compare à son encadrement. */
const rate = (value: number, unit: string): string =>
  `${value.toFixed(3)} ${unit}/m²`;

/** Couches effectivement appliquées, telles que le moteur les résout. */
const coatsFor = (params: Record<string, unknown>): number =>
  Number(params.number_of_coats) || DEFAULT_COATS;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * I1 — volume acheté ≥ besoin ajusté.
 *
 * Précédé des deux gardes structurels qui existaient avant ces invariants, et
 * qui gardent leur propre marque `[I0]` : un ouvrage chiffre ses matériaux
 * liés, ni plus (la catégorie entière — le défaut des 54 lignes) ni moins, et
 * il en garde un principal, sans quoi le cas rétrécirait sans qu'aucun compte
 * de lignes ne s'en émeuve.
 */
function coverageViolations(
  lines: EstimationLineItem[],
  exclusions: MaterialExclusion[],
  materials: MaterialInput[],
  byId: Map<string, MaterialInput>,
  testCase: HarnessCase,
): string[] {
  const violations: string[] = [];
  const label = caseLabel(testCase);

  // E1-8 : l'égalité « une ligne par matériau lié » devient « lignes +
  // exclusions = matériaux liés ». Elle reste aussi serrée qu'avant — un
  // matériau ne peut pas disparaître sans qu'une exclusion motivée le remplace,
  // ce qui est précisément ce qui distingue une condition métier d'un oubli.
  if (lines.length + exclusions.length !== materials.length) {
    violations.push(
      `[I0] ${label} : ${lines.length} lignes chiffrées et ${exclusions.length} exclusions ` +
        `pour ${materials.length} matériaux liés`,
    );
  }
  // Une exclusion sans motif rédigé est une ligne qui disparaît en silence :
  // c'est le défaut d'origine, déplacé d'un cran.
  for (const exclusion of exclusions) {
    if (!exclusion.reason_fr || !exclusion.reason_code) {
      violations.push(
        `[I0] ${label} : ${exclusion.material_name} écarté sans motif ` +
          `(code « ${exclusion.reason_code} », phrase « ${exclusion.reason_fr} »)`,
      );
    }
  }
  if (!materials.some((mat) => mat.role === 'principal')) {
    violations.push(`[I0] ${label} : aucun matériau principal lié`);
  }

  for (const line of lines) {
    const bought = purchasedVolume(line, byId.get(line.material_id)!);
    if (bought < line.adjusted_qty) {
      violations.push(
        `[I1] ${label} : ${line.material_name} — ${qty(bought, line.material_unit)} achetés ` +
          `pour ${qty(line.adjusted_qty, line.material_unit)} nécessaires`,
      );
    }
  }

  return violations;
}

/**
 * I2 — la quantité d'un matériau à `applies_coats` faux ne dépend pas du nombre
 * de couches. Le même cas est rejoué à 1, 2 et 3 couches ; toute différence sur
 * un matériau qui ne déclare pas les couches est une régression vers la
 * déduction par catégorie d'avant E1-4.
 */
function coatIndependenceViolations(
  engine: EstimationEngine,
  room: RoomData,
  testCase: HarnessCase,
  byId: Map<string, MaterialInput>,
  config: HarnessConfig,
): string[] {
  const violations: string[] = [];
  const label = caseLabel(testCase);
  const base = paramsFor(config.paramsByWorkType, testCase.workType.code);

  const runs = config.coatCounts.map((coats) => ({
    coats,
    byMaterial: new Map(
      engine
        .computeEstimation(room, [
          workItemFor(
            testCase,
            'wi-1',
            { ...base, number_of_coats: coats },
            config.declaredBasisByWorkType,
          ),
        ])
        .map((line) => [line.material_id, line]),
    ),
  }));

  const [reference, ...others] = runs;
  for (const [materialId, refLine] of reference.byMaterial) {
    if (byId.get(materialId)?.applies_coats) {
      continue;
    }
    for (const run of others) {
      const line = run.byMaterial.get(materialId);
      if (line && line.adjusted_qty !== refLine.adjusted_qty) {
        violations.push(
          `[I2] ${label} : ${refLine.material_name} (applies_coats faux) — ` +
            `${qty(refLine.adjusted_qty, refLine.material_unit)} à ${reference.coats} couche(s) ` +
            `contre ${qty(line.adjusted_qty, line.material_unit)} à ${run.coats} couche(s)`,
        );
      }
    }
  }

  return violations;
}

/**
 * I3 — consommation par m² d'ouvrage et par couche, contre l'encadrement de
 * `materials/consumption-bounds.data.ts`.
 *
 * Le taux est divisé par les couches **seulement si le catalogue déclare
 * `applies_coats`**, jamais parce que le moteur annonce un `number_of_coats`.
 * La nuance décide de tout : le défaut d'E1-4, où un pinceau était multiplié
 * par les couches, sortirait ici à 2,0 pour un encadrement à [1, 1] — alors
 * qu'en divisant par les couches *annoncées par le moteur* il s'annulerait,
 * et l'invariant regarderait le défaut sans le voir.
 *
 * Le libellé ne porte ni le niveau ni la pose : le taux n'en dépend pas, et
 * 9 messages identiques par ouvrage se replient ainsi en un seul. S'il en
 * dépendait, les messages différeraient et ne se replieraient pas — ce qui est
 * exactement l'information qu'on voudrait voir.
 */
function consumptionRateViolations(
  lines: EstimationLineItem[],
  byId: Map<string, MaterialInput>,
  testCase: HarnessCase,
  config: HarnessConfig,
): string[] {
  const violations: string[] = [];
  const code = testCase.workType.code;
  const coats = coatsFor(paramsFor(config.paramsByWorkType, code));

  for (const line of lines) {
    const material = byId.get(line.material_id)!;
    const bound = config.bounds.get(material.id);

    if (!bound) {
      violations.push(
        `[I3] ${code} : ${line.material_name} — aucun encadrement de consommation déclaré ` +
          `(materials/consumption-bounds.data.ts)`,
      );
      continue;
    }
    if (bound.unit !== material.unit) {
      violations.push(
        `[I3] ${code} : ${line.material_name} — encadrement déclaré en ${bound.unit}/m² ` +
          `pour un matériau vendu en ${material.unit}`,
      );
      continue;
    }
    if (line.surface_m2 <= 0) {
      continue;
    }

    const observed =
      line.theoretical_qty /
      line.surface_m2 /
      (material.applies_coats ? coats : 1);

    if (
      observed < bound.min_per_m2 * (1 - config.rateTolerance) ||
      observed > bound.max_per_m2 * (1 + config.rateTolerance)
    ) {
      violations.push(
        `[I3] ${code} : ${line.material_name} — ${rate(observed, material.unit)} consommés, ` +
          `encadrement ${rate(bound.min_per_m2, material.unit)} à ${rate(bound.max_per_m2, material.unit)} ` +
          `(${bound.basis})`,
      );
    }
  }

  return violations;
}

/**
 * Plafond de la table d'alternatives. Même rôle que `MAX_PACKAGING_STEPS` dans
 * le moteur : hors d'atteinte sur le catalogue réel, garde-fou contre une
 * donnée aberrante qui ferait exploser le harnais au lieu de le faire échouer.
 */
const MAX_ALTERNATIVE_STEPS = 100_000;

/**
 * Le meilleur panachage qui achète **au plus** le volume retenu par le moteur,
 * en strictement moins de contenants — ou `null` s'il n'en existe pas.
 *
 * Programmation dynamique délibérément **indépendante** de celle du moteur :
 * elle énumère le nombre minimal de contenants pour chaque volume atteignable
 * entre le besoin et le volume acheté, sans rien savoir du critère `S`. Rejouer
 * l'algorithme du moteur pour vérifier le moteur ne prouverait que sa
 * cohérence avec lui-même.
 */
function fewerContainersFor(
  adjustedQty: number,
  material: MaterialInput,
  purchase: {
    packaging_breakdown?: PackagingUnitsLine[];
    packaging_label: string;
    units_needed: number;
  },
): { units: number; volume: number } | null {
  const stepsByLabel = new Map(
    material.packagings.map((pkg) => [
      pkg.label,
      Math.round(Number(pkg.quantity_per_unit) * 1000),
    ]),
  );
  const sizes = [...new Set(stepsByLabel.values())].filter(
    (steps) => Number.isFinite(steps) && steps > 0,
  );
  // Zéro ou un contenant : « strictement moins » vaudrait ne rien acheter.
  if (sizes.length === 0 || purchase.units_needed <= 1) {
    return null;
  }

  const parts = purchase.packaging_breakdown ?? [
    { label: purchase.packaging_label, units: purchase.units_needed },
  ];
  let boughtSteps = 0;
  for (const part of parts) {
    const steps = stepsByLabel.get(part.label);
    // Format inconnu du catalogue : I1 le signale déjà, ne pas en déduire un
    // second grief sur un volume qu'on ne sait pas reconstituer.
    if (steps === undefined) {
      return null;
    }
    boughtSteps += part.units * steps;
  }

  const step = sizes.reduce((acc, size) => gcd(acc, size), 0);
  const grid = sizes.map((size) => size / step);
  const need = Math.max(0, Math.ceil((adjustedQty * 1000) / step - 1e-6));
  const cap = boughtSteps / step;
  if (cap < need || cap > MAX_ALTERNATIVE_STEPS) {
    return null;
  }

  const minUnits = new Array<number>(cap + 1).fill(Number.POSITIVE_INFINITY);
  minUnits[0] = 0;
  for (let n = 1; n <= cap; n++) {
    for (const size of grid) {
      if (size <= n && minUnits[n - size] + 1 < minUnits[n]) {
        minUnits[n] = minUnits[n - size] + 1;
      }
    }
  }

  let bestUnits = purchase.units_needed;
  let bestSteps = cap;
  for (let n = need; n <= cap; n++) {
    if (minUnits[n] < bestUnits) {
      bestUnits = minUnits[n];
      bestSteps = n;
    }
  }

  return bestUnits < purchase.units_needed
    ? { units: bestUnits, volume: (bestSteps * step) / 1000 }
    : null;
}

/**
 * I7 — un matériau découpé à longueur achète assez de barres pour que **chaque
 * pièce se coupe entière**.
 *
 * D'où il vient : E1-8. Le moteur métrait l'ossature en mètres puis divisait par
 * la longueur de barre, comme si les chutes se raboutaient. Pour 30 montants de
 * 2,30 m dans des barres de 2,70 m, il achetait 28 barres au lieu de 30.
 *
 * Ce qui rend cet invariant nécessaire, et pas seulement agréable : le défaut
 * **change de signe** avec la géométrie. Sous 2,50 m au niveau intermédiaire,
 * `2,50 × 1,08 = 2,70` tombe exactement sur la barre et le compte était juste
 * par coïncidence — un instantané de cette configuration-là n'aurait rien
 * montré, et c'est justement la configuration de référence du harnais. Seule
 * une propriété peut attraper cela.
 *
 * Le compte attendu est recalculé **depuis l'assiette de l'ouvrage** et non
 * depuis les champs de la ligne : vérifier `pieces_needed` contre lui-même ne
 * prouverait que la cohérence du moteur avec lui-même. `stud_count` vient de
 * `computeWorkBasis`, `piece_length_m` de la hauteur déclarée, la longueur de
 * barre du catalogue — trois grandeurs qu'aucune des deux implémentations ne
 * partage.
 */
function fixedLengthCutViolations(
  engine: EstimationEngine,
  room: RoomData,
  lines: EstimationLineItem[],
  byId: Map<string, MaterialInput>,
  testCase: HarnessCase,
  config: HarnessConfig,
): string[] {
  const violations: string[] = [];
  const label = caseLabel(testCase);

  const nonJointable = lines.filter(
    (line) => byId.get(line.material_id)?.offcuts_reusable === false,
  );
  if (nonJointable.length === 0) {
    return violations;
  }

  const basis = engine.computeWorkBasis(
    room,
    workItemFor(
      testCase,
      'wi-1',
      paramsFor(config.paramsByWorkType, testCase.workType.code),
      config.declaredBasisByWorkType,
    ),
  );

  for (const line of nonJointable) {
    const material = byId.get(line.material_id)!;

    // Seule assiette décomposable en pièces à ce jour. Un matériau non
    // aboutable métré autrement est un trou de conception, pas un écart de
    // quantité : il se signale, il ne se contourne pas.
    if (material.quantity_driver !== 'frame_stud' || !basis.frame) {
      violations.push(
        `[I7] ${label} : ${line.material_name} — découpé à longueur mais métré ` +
          `sur « ${DRIVER_LABELS[material.quantity_driver ?? 'work_surface']} », ` +
          `qui ne se décompose pas en pièces`,
      );
      continue;
    }

    const pieces = basis.frame.stud_count;
    const pieceLength = basis.frame.stud_piece_length_m;
    const barLength = Math.max(
      ...material.packagings.map((p) => p.quantity_per_unit),
    );
    const perBar = Math.floor(barLength / pieceLength);
    const expected = perBar >= 1 ? Math.ceil(pieces / perBar) : Infinity;

    if (line.units_needed < expected) {
      violations.push(
        `[I7] ${label} : ${line.material_name} — ${line.units_needed} barres de ` +
          `${metres(barLength)} achetées pour ${pieces} pièces de ` +
          `${metres(pieceLength)} (${perBar} par barre, ${expected} barres nécessaires)`,
      );
    }
  }

  return violations;
}

/** I4 — aucun panachage ne fait mieux en contenants sans acheter plus. */
function containerMinimalityViolations(
  lines: EstimationLineItem[],
  byId: Map<string, MaterialInput>,
  testCase: HarnessCase,
): string[] {
  const violations: string[] = [];
  const label = caseLabel(testCase);

  for (const line of lines) {
    const material = byId.get(line.material_id)!;
    const better = fewerContainersFor(line.adjusted_qty, material, line);
    if (better) {
      violations.push(
        `[I4] ${label} : ${line.material_name} — ${line.units_needed} contenants pour ` +
          `${qty(purchasedVolume(line, material), line.material_unit)}, alors que ` +
          `${better.units} suffisent pour ${qty(better.volume, line.material_unit)}`,
      );
    }
  }

  return violations;
}

/**
 * I5 — monter de `beginner` à `expert`, à pose identique, n'augmente jamais une
 * quantité.
 *
 * L'assertion porte sur `adjusted_qty` et non sur `units_needed`, et c'est
 * délibéré. La raison a changé avec E1-9 : ce n'est plus que le critère
 * arbitrerait ailleurs, c'est que **le nombre de contenants n'est pas monotone
 * en quantité**, et ne peut pas l'être. Le plafond de surplus relatif s'élargit
 * avec le besoin, donc un besoin plus grand ouvre des formats qu'un besoin plus
 * petit s'interdit : 12,6 m² de natte de découplage s'achètent en trois rouleaux
 * de 5 m², 15,5 m² en un seul rouleau de 30. Exiger la monotonie sur les
 * contenants exigerait donc du moteur le contraire de ce qu'il promet.
 */
function skillMonotonyViolations(
  engine: EstimationEngine,
  room: RoomData,
  cases: HarnessCase[],
  config: HarnessConfig,
): string[] {
  const violations: string[] = [];
  const ordered = [...cases].sort(
    (a, b) =>
      SKILL_LEVELS.indexOf(a.skillLevel) - SKILL_LEVELS.indexOf(b.skillLevel),
  );

  const quantitiesFor = (testCase: HarnessCase) =>
    new Map(
      engine
        .computeEstimation(room, [
          workItemFor(
            testCase,
            'wi-1',
            paramsFor(config.paramsByWorkType, testCase.workType.code),
            config.declaredBasisByWorkType,
          ),
        ])
        .map((line) => [line.material_id, line]),
    );

  for (let i = 1; i < ordered.length; i++) {
    const lower = ordered[i - 1];
    const higher = ordered[i];
    const lowerLines = quantitiesFor(lower);

    for (const [materialId, line] of quantitiesFor(higher)) {
      const before = lowerLines.get(materialId);
      if (before && line.adjusted_qty > before.adjusted_qty) {
        violations.push(
          `[I5] ${higher.workType.code} · pose ${higher.poseType} : ${line.material_name} — ` +
            `${qty(line.adjusted_qty, line.material_unit)} en ${higher.skillLevel} ` +
            `contre ${qty(before.adjusted_qty, before.material_unit)} en ${lower.skillLevel}`,
        );
      }
    }
  }

  return violations;
}

/**
 * I6 — changer la valeur d'une question **requise** change au moins une
 * quantité.
 *
 * Une question requise est une promesse faite à l'artisan : ce que vous
 * répondez sert à quelque chose. `tile_format` ne la tenait pas — exigé,
 * affiché, stocké, et lu par aucun calcul — jusqu'à E1-5.
 *
 * La comparaison balaie toutes les valeurs déclarées **et** tous les niveaux de
 * compétence énumérés : il suffit qu'un seul couple produise une différence
 * pour que la question soit tenue pour lue. C'est la forme la plus faible de
 * l'exigence, donc celle dont un échec ne se discute pas.
 */
function requiredQuestionViolations(
  engine: EstimationEngine,
  room: RoomData,
  workType: SeedWorkType,
  cases: HarnessCase[],
  config: HarnessConfig,
): string[] {
  const violations: string[] = [];
  const base = paramsFor(config.paramsByWorkType, workType.code);

  /**
   * Le chiffrage d'un cas pour une réponse donnée. Le cas est **le même** des
   * deux côtés de la comparaison : opposer le niveau d'un cas au niveau d'un
   * autre ferait passer l'écart de facteur de perte pour un effet de la
   * question, et l'invariant serait vert sans rien prouver.
   */
  const answeredWith = (testCase: HarnessCase, key: string, value: unknown) =>
    new Map(
      engine
        .computeEstimation(room, [
          workItemFor(
            testCase,
            'wi-1',
            { ...base, [key]: value },
            config.declaredBasisByWorkType,
          ),
        ])
        .map((line) => [line.material_id, line]),
    );

  for (const question of workType.contextual_questions) {
    if (!question.required) {
      continue;
    }

    const values: unknown[] =
      question.type === 'select'
        ? (question.options ?? []).map((option) => option.value)
        : (config.questionProbes[question.key] ?? []);

    if (values.length < 2) {
      violations.push(
        `[I6] ${workType.code} : question requise « ${question.key} » (${question.type}) — ` +
          `moins de deux valeurs d'épreuve déclarées, l'invariant ne peut rien affirmer ` +
          `(HarnessConfig.questionProbes)`,
      );
      continue;
    }

    const [reference, ...alternatives] = values;
    const changesSomething = cases.some((testCase) => {
      const before = answeredWith(testCase, question.key, reference);
      return alternatives.some((value) => {
        const after = answeredWith(testCase, question.key, value);
        // E1-8 : une réponse peut faire **disparaître** une ligne — le
        // pare-vapeur sur un plancher bois. Comparer les seules lignes
        // communes laisserait alors l'invariant vert sans rien avoir vu, la
        // question passant pour inerte alors qu'elle vaut un rouleau entier.
        if (after.size !== before.size) {
          return true;
        }
        return [...after].some(
          ([materialId, line]) =>
            line.adjusted_qty !== before.get(materialId)?.adjusted_qty,
        );
      });
    });

    if (!changesSomething) {
      const unchanged = [
        ...answeredWith(cases[0], question.key, reference).values(),
      ]
        .map(
          (line) =>
            `${line.material_name} ${qty(line.adjusted_qty, line.material_unit)}`,
        )
        .join(', ');
      violations.push(
        `[I6] ${workType.code} : question requise « ${question.key} » — ` +
          `les ${values.length} valeurs (${values.join(', ')}) donnent les mêmes quantités ` +
          `à tous les niveaux : ${unchanged}`,
      );
    }
  }

  return violations;
}

const groupCases = (
  cases: HarnessCase[],
  key: (testCase: HarnessCase) => string,
): HarnessCase[][] => {
  const groups = new Map<string, HarnessCase[]>();
  for (const testCase of cases) {
    const group = groups.get(key(testCase));
    if (group) {
      group.push(testCase);
    } else {
      groups.set(key(testCase), [testCase]);
    }
  }
  return [...groups.values()];
};

/**
 * Les sept invariants, sur une pièce.
 *
 * Le résultat est dédoublonné en conservant l'ordre de première apparition :
 * le taux de consommation d'I3 ne dépend ni du niveau ni de la pose, et son
 * message est écrit pour ne pas les porter — sans quoi le même grief reviendrait
 * neuf fois par ouvrage. Deux messages identiques *sont* le même fait.
 */
export function invariantViolations(
  engine: EstimationEngine,
  harnessRoom: HarnessRoom,
  overrides: Partial<HarnessConfig> = {},
): string[] {
  const config: HarnessConfig = { ...DEFAULT_HARNESS_CONFIG, ...overrides };
  const room = harnessRoom.room;
  const violations: string[] = [];

  for (const testCase of config.cases) {
    const materials = materialsForWorkType(testCase.workType.code);
    const byId = new Map(materials.map((mat) => [mat.id, mat]));
    const { items: lines, exclusions } = engine.computeEstimationDetailed(
      room,
      [
        workItemFor(
          testCase,
          'wi-1',
          paramsFor(config.paramsByWorkType, testCase.workType.code),
          config.declaredBasisByWorkType,
        ),
      ],
    );

    violations.push(
      ...coverageViolations(lines, exclusions, materials, byId, testCase),
      ...coatIndependenceViolations(engine, room, testCase, byId, config),
      ...consumptionRateViolations(lines, byId, testCase, config),
      ...containerMinimalityViolations(lines, byId, testCase),
      ...fixedLengthCutViolations(engine, room, lines, byId, testCase, config),
    );
  }

  // I5 compare les niveaux entre eux : il se raisonne par (ouvrage, pose), pas
  // par cas — un cas isolé ne peut rien dire d'une progression.
  for (const group of groupCases(
    config.cases,
    (testCase) => `${testCase.workType.code}:${testCase.poseType}`,
  )) {
    violations.push(...skillMonotonyViolations(engine, room, group, config));
  }

  // I6 se raisonne par ouvrage : une question appartient à l'ouvrage, pas au cas.
  for (const group of groupCases(
    config.cases,
    (testCase) => testCase.workType.code,
  )) {
    violations.push(
      ...requiredQuestionViolations(
        engine,
        room,
        group[0].workType,
        group,
        config,
      ),
    );
  }

  return [...new Set(violations)];
}

/*
 * `KNOWN_VIOLATIONS` / `splitKnownViolations` ont été **supprimés** par E1-5.
 *
 * Ils portaient trois défauts ouverts, énumérés en clair plutôt que tolérés en
 * bloc : le joint de `floor_tiling` et celui de `wall_tiling` à 0,25 kg/m²
 * constants, et `tile_format` requis sans effet sur aucune quantité. Le
 * commentaire d'alors annonçait que le jour où le format du carreau pilotera le
 * chiffrage, quelqu'un devrait **supprimer** ces préfixes plutôt que les mettre
 * à jour. C'est fait, et la liste vidée ne laissait plus qu'une indirection
 * qui ne filtrait rien : les suites affirment désormais que les sept invariants
 * passent, sans exception ni note de bas de page.
 *
 * Le jour où un défaut devra de nouveau être porté sciemment, le rétablir est
 * l'affaire de six lignes — et ce sera un geste visible en revue, ce qui est
 * exactement l'intention d'origine.
 */

export interface MutualisationReport {
  /** Cas où mutualiser augmente le coût `S` du moteur. Doit rester vide. */
  /**
   * Cas où mutualiser achète **plus de volume** qu'acheter pièce par pièce.
   * C'est le prix assumé du critère en contenants, et il est énuméré cas par
   * cas plutôt que toléré en bloc.
   */
  extraVolume: string[];
  /** Cas où mutualiser évite au moins un contenant. */
  casesThatSave: number;
  /**
   * Cas où mutualiser retient **plus** de contenants. Depuis E1-9 c'est
   * impossible sans prix au catalogue — cf. la démonstration portée par
   * `aggregatePurchases` — et la suite exige que cette liste soit vide.
   */
  extraContainers: string[];
  /** Traçabilité de chaque contribution : somme des parts = total mutualisé. */
  contributionMismatches: string[];
}

/**
 * Ce que la mutualisation (ENG-2) garantit réellement — **et l'histoire de cette
 * phrase**, parce qu'elle a été fausse deux fois.
 *
 * 1. Le moteur promettait `ceil(Σ) ≤ Σ ceil`, « mutualiser ne coûte jamais plus
 *    de conditionnements ». Vrai avant E1-5, quand un achat tenait dans un
 *    format unique : `ceil` est sous-additif.
 * 2. E1-5 a panaché les formats en minimisant `S = q_min × contenants + volume`,
 *    un coût **approché**. L'admissibilité ne portait plus alors que sur `S`, et
 *    le nombre de contenants pouvait monter. Ce harnais l'a montré dès sa
 *    première exécution sur le catalogue réel : une peinture murale de débutant
 *    sur ces deux pièces demande 15,718 L, achetés mutualisés en
 *    10 + 5 + 0,5 + 0,5 L (4 contenants, 16 L) là où l'achat pièce par pièce
 *    prenait 5 + 2,5 puis 10 L (3 contenants, 17,5 L). L'écran l'affichait
 *    « -1 contenant évité ».
 * 3. E1-9 fait du **nombre de contenants** le critère principal. La réunion des
 *    achats pièce par pièce couvre la somme des besoins, et sa borne de surplus
 *    étant relative elle survit à la somme : cette réunion est donc admissible
 *    pour le problème mutualisé, avec `Σ contenants_pièce` contenants. L'optimum
 *    mutualisé minimisant ce compte, il ne peut pas en prendre davantage.
 *
 * D'où les deux listes de ce rapport. `extraContainers` éprouve la propriété
 * démontrée et doit rester **vide**. `extraVolume` énumère ce que cette
 * propriété coûte — quelques litres de plus, nommés un par un : le jour où la
 * liste s'allonge, quelqu'un doit dire lequel a changé et pourquoi.
 */
export function mutualisationReport(
  engine: EstimationEngine,
  rooms: HarnessRoom[],
): MutualisationReport {
  const extraVolume: string[] = [];
  const extraContainers: string[] = [];
  const contributionMismatches: string[] = [];
  let casesThatSave = 0;

  for (const testCase of harnessCases) {
    const label = `${testCase.workType.code} · ${testCase.skillLevel} · ${testCase.poseType}`;
    const byId = new Map(
      materialsForWorkType(testCase.workType.code).map((mat) => [mat.id, mat]),
    );
    const { aggregated, perRoomLines, perRoomUnitsByMaterial } = runProject(
      engine,
      rooms,
      [testCase],
    );
    let saved = 0;

    for (const agg of aggregated) {
      const material = byId.get(agg.material_id)!;
      const split = perRoomUnitsByMaterial.get(agg.material_id) ?? 0;
      const splitVolume = perRoomLines
        .filter((l) => l.material_id === agg.material_id)
        .reduce((sum, line) => sum + purchasedVolume(line, material), 0);
      const pooledVolume = purchasedVolume(agg, material);

      // Tolérance : `total_adjusted_qty` est la somme de quantités déjà
      // arrondies au millième, donc le besoin mutualisé peut excéder la somme
      // des besoins de quelques 1e-4 — sans rapport avec ce qu'on mesure.
      if (pooledVolume > splitVolume + 1e-3) {
        extraVolume.push(
          `${label} : ${agg.material_name} — ${qty(pooledVolume, agg.material_unit)} ` +
            `mutualisés contre ${qty(splitVolume, agg.material_unit)} pièce par pièce, ` +
            `en ${agg.units_needed} contenants au lieu de ${split}`,
        );
      }

      if (agg.units_needed > split) {
        extraContainers.push(
          `${label} : ${agg.material_name} — ${agg.units_needed} contenants mutualisés ` +
            `contre ${split} pièce par pièce, pour ` +
            `${qty(purchasedVolume(agg, material), agg.material_unit)} au lieu de ` +
            `${qty(
              perRoomLines
                .filter((l) => l.material_id === agg.material_id)
                .reduce((sum, l) => sum + purchasedVolume(l, material), 0),
              agg.material_unit,
            )}`,
        );
      }
      saved += split - agg.units_needed;

      if (agg.contributions.length !== rooms.length) {
        contributionMismatches.push(
          `${label} : ${agg.material_name} — ${agg.contributions.length} contributions pour ${rooms.length} pièces`,
        );
      }
      if (agg.room_count !== rooms.length) {
        contributionMismatches.push(
          `${label} : ${agg.material_name} — room_count ${agg.room_count} pour ${rooms.length} pièces`,
        );
      }
      const summed = agg.contributions.reduce((s, c) => s + c.adjusted_qty, 0);
      if (Math.abs(summed - agg.total_adjusted_qty) > 1e-6) {
        contributionMismatches.push(
          `${label} : ${agg.material_name} — contributions ${summed} ≠ total ${agg.total_adjusted_qty}`,
        );
      }
    }

    if (saved > 0) casesThatSave += 1;
  }

  return {
    extraVolume,
    casesThatSave,
    extraContainers,
    contributionMismatches,
  };
}

// ---------------------------------------------------------------------------
// Géométries de référence
// ---------------------------------------------------------------------------

/** Porte standard française, la seule ouverture de la chambre de référence. */
const DOOR = { width_cm: 83, height_cm: 204, count: 1 };
const WINDOW = { width_cm: 120, height_cm: 120, count: 1 };

/**
 * Chambre 400 × 300 × 250 cm, une porte.
 * Sol 12 m² · mur brut 2 × (4 + 3) × 2,5 = 35 m² · net 35 − 1,6932 = 33,3068 m².
 */
export const RECTANGULAR_ROOM: HarnessRoom = {
  name: 'Chambre rectangulaire',
  room: {
    length_cm: 400,
    width_cm: 300,
    height_cm: 250,
    openings: [DOOR],
  },
};

/**
 * Séjour en L : un 400 × 300 prolongé par un 200 × 150 sur son flanc droit.
 * Sol 12 + 3 = 15 m². Le périmètre du contour vaut 1 800 cm — celui de la boîte
 * englobante 600 × 300, propriété des formes en L que `unionPerimeterCm` doit
 * retrouver et qu'une somme de périmètres manquerait (2 400 cm).
 * Mur brut 45 m² · net 45 − 1,6932 − 1,44 = 41,8668 m².
 */
export const L_SHAPED_ROOM: HarnessRoom = {
  name: 'Séjour en L',
  room: {
    length_cm: 400,
    width_cm: 300,
    height_cm: 250,
    openings: [DOOR, WINDOW],
    segments: [
      { x_cm: 0, y_cm: 0, length_cm: 400, width_cm: 300 },
      { x_cm: 400, y_cm: 0, length_cm: 200, width_cm: 150 },
    ],
  },
};

/**
 * Le projet de référence est la **composition** des deux pièces ci-dessus : les
 * contributions par pièce de son instantané sont, au chiffre près, les quantités
 * des deux autres instantanés. Un relecteur peut donc vérifier la mutualisation
 * à la main, sans rejouer le moteur.
 */
export const TWO_ROOM_PROJECT: HarnessRoom[] = [
  RECTANGULAR_ROOM,
  L_SHAPED_ROOM,
];
