import {
  AggregatedMaterialLine,
  EstimationLineItem,
  PackagingUnitsLine,
} from '../entities/estimation-result.entity';
import {
  EstimationEngine,
  MaterialInput,
  PackagingInput,
  RoomData,
  WorkItemInput,
} from '../estimation-engine';
import { seedMaterials, SeedMaterial } from '../../materials/seed-catalog.data';
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
 */

/** Les 3 niveaux de compétence, dans l'ordre de l'énumération. */
export const SKILL_LEVELS: SkillLevel[] = Object.values(SkillLevel);

/**
 * Pose retenue par le moteur quand `custom_params.laying_pattern` est absent
 * (`estimation-engine.ts`, `computeEstimation`). Ce n'est pas une pose du
 * catalogue : c'est le chemin qu'emprunte tout ouvrage dont l'utilisateur ne
 * choisit pas le calepinage — la majorité d'entre eux, six des sept ouvrages ne
 * posant même pas la question.
 */
export const IMPLICIT_POSE = 'standard';

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
 * Poses **disponibles** pour un ouvrage : celles que déclarent les facteurs de
 * perte de ses matériaux liés, plus la pose implicite `standard`.
 *
 * Inclure `standard` partout n'est pas une commodité de test, c'est le chemin de
 * production majoritaire — et il réserve des surprises qu'un harnais doit
 * exposer plutôt que taire : `wall_covering` ne déclare que `plain`, donc en
 * pose implicite il tombe sur `DEFAULT_WASTE_PERCENT` (10 %) au lieu des 7 %
 * du catalogue. Le figer rend l'écart visible ; l'ignorer le laisserait dériver.
 */
export function poseTypesForWorkType(workTypeCode: string): string[] {
  const declared = new Set<string>();
  for (const mat of materialsForWorkType(workTypeCode)) {
    for (const wf of mat.waste_factors) {
      declared.add(wf.pose_type);
    }
  }
  declared.delete(IMPLICIT_POSE);
  return [IMPLICIT_POSE, ...[...declared].sort()];
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

/** Un cas nommé, pour les scénarios qui composent plusieurs ouvrages. */
export function caseFor(
  workTypeCode: string,
  skillLevel: SkillLevel,
  poseType = IMPLICIT_POSE,
): HarnessCase {
  const workType = seedWorkTypes.find((wt) => wt.code === workTypeCode);
  if (!workType) {
    throw new Error(`Ouvrage absent du seed : ${workTypeCode}`);
  }
  return { workType, skillLevel, poseType };
}

/**
 * Work item du moteur pour un cas. La pose implicite se dit en **n'envoyant
 * rien** — `custom_params` vide — plutôt qu'en envoyant `standard` : c'est ce que
 * fait un appelant qui ne pose pas la question, et le seul moyen d'éprouver le
 * repli de `resolveWasteFactor`. `number_of_coats` reste absent, donc au défaut
 * de 2 couches, comme pour un utilisateur qui ne le renseigne pas.
 */
export function workItemFor(
  testCase: HarnessCase,
  workItemId: string,
): WorkItemInput {
  return {
    id: workItemId,
    work_type_code: testCase.workType.code,
    work_type_label: testCase.workType.label_fr,
    category: testCase.workType.category,
    surface_target: testCase.workType.surface_target,
    skill_level: testCase.skillLevel,
    custom_params:
      testCase.poseType === IMPLICIT_POSE
        ? {}
        : { laying_pattern: testCase.poseType },
    materials: materialsForWorkType(testCase.workType.code),
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
  if (line.waste_factor_source === 'default') {
    return 'défaut';
  }
  const exact = material.waste_factors.some(
    (wf) => wf.pose_type === line.pose_type && wf.skill_level === skillLevel,
  );
  return exact ? 'exact' : 'repli std';
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
 * Le critère que `selectBestPackaging` minimise (E1-5) :
 *
 *     S = q_min × (nombre de contenants) + (volume acheté)
 *
 * où `q_min` est le plus petit format offert. C'est la grandeur que le moteur
 * traite comme un coût ; toute affirmation sur « ce qui coûte moins cher » se
 * dit dans cette unité et pas en nombre de contenants.
 */
export function purchaseCost(
  purchase: {
    packaging_breakdown?: PackagingUnitsLine[];
    packaging_label: string;
    units_needed: number;
  },
  material: MaterialInput,
): number {
  const qMin = Math.min(...material.packagings.map((p) => p.quantity_per_unit));
  return qMin * purchase.units_needed + purchasedVolume(purchase, material);
}

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
  `ouvrage : ${testCase.workType.label_fr} (${testCase.workType.code}) · surface ${testCase.workType.surface_target}\n` +
  `niveau  : ${testCase.skillLevel} · pose : ${testCase.poseType}` +
  (testCase.poseType === IMPLICIT_POSE ? ' (implicite)' : '');

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
  purchaseCell(line),
];

/** Chiffrage d'un cas sur une pièce, rendu en table relisible. */
export function renderRoomCase(
  engine: EstimationEngine,
  harnessRoom: HarnessRoom,
  testCase: HarnessCase,
): string {
  const byId = materialsById(testCase);
  const lines = engine.computeEstimation(harnessRoom.room, [
    workItemFor(testCase, 'wi-1'),
  ]);
  const first = lines[0];
  const deducted = first.gross_surface_m2 - first.surface_m2;

  return [
    `pièce   : ${harnessRoom.name}`,
    caseHeading(testCase),
    `surface : brute ${surface(first.gross_surface_m2)} · nette ${surface(first.surface_m2)} · déduction ${surface(deducted)}`,
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
): ProjectRun {
  const perRoomLines: EstimationLineItem[] = [];
  const perRoomUnitsByMaterial = new Map<string, number>();
  const packagings = new Map<string, PackagingInput[]>();

  rooms.forEach((harnessRoom, roomIndex) => {
    const workItems = cases.map((testCase, caseIndex) =>
      workItemFor(testCase, `wi-${roomIndex + 1}-${caseIndex + 1}`),
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
): string {
  const { perRoomLines, aggregated, perRoomUnitsByMaterial } = runProject(
    engine,
    rooms,
    cases,
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
        `${saved}`,
        saved > 0 ? 'contenants évités' : 'aucun contenant évité',
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
export function renderCaseInventory(): string {
  const blocks = seedWorkTypes.map((workType) => {
    const materials = materialsForWorkType(workType.code);
    const poses = poseTypesForWorkType(workType.code);
    return [
      `${workType.code} · ${workType.label_fr} · ${workType.category} · surface ${workType.surface_target}`,
      `  poses : ${poses.join(', ')} · niveaux : ${SKILL_LEVELS.join(', ')} · ${poses.length * SKILL_LEVELS.length} cas`,
      ...materials.map(
        (mat) =>
          `  - ${mat.name.padEnd(31)} ${(mat.role ?? '-').padEnd(12)} ${mat.unit.padEnd(5)} rendement ${mat.yield_per_unit} · couches ${mat.applies_coats ? 'oui' : 'non'}`,
      ),
    ].join('\n');
  });

  return [...blocks, '', `total : ${harnessCases.length} cas`].join('\n');
}

// ---------------------------------------------------------------------------
// Invariants — ce qu'un `--update-snapshot` distrait ne doit pas pouvoir effacer
// ---------------------------------------------------------------------------

/**
 * Un instantané fige ce que le moteur produit, juste ou faux : rejoué sur le
 * moteur d'avant E1-1, il aurait figé les 54 lignes sans broncher. Ces
 * invariants-ci ne dépendent d'aucune valeur enregistrée, donc `-u` ne les
 * emporte pas. Ils sont renvoyés en clair plutôt qu'assertés un par un : la
 * suite dit alors *tout* ce qui a cassé, pas le premier cas venu.
 */
export function invariantViolations(
  engine: EstimationEngine,
  room: RoomData,
): string[] {
  const violations: string[] = [];

  for (const testCase of harnessCases) {
    const label = `${testCase.workType.code} · ${testCase.skillLevel} · ${testCase.poseType}`;
    const materials = materialsForWorkType(testCase.workType.code);
    const byId = new Map(materials.map((mat) => [mat.id, mat]));
    const lines = engine.computeEstimation(room, [
      workItemFor(testCase, 'wi-1'),
    ]);

    // Le garde-fou direct contre le défaut des 54 lignes : un ouvrage chiffre
    // ses matériaux liés, ni plus (la catégorie entière) ni moins.
    if (lines.length !== materials.length) {
      violations.push(
        `${label} : ${lines.length} lignes chiffrées pour ${materials.length} matériaux liés`,
      );
    }

    // Un ouvrage sans matériau principal ne chiffre plus rien d'utile : le cas
    // rétrécirait sans qu'aucun compte de lignes ne s'en émeuve.
    if (!materials.some((mat) => mat.role === 'principal')) {
      violations.push(`${label} : aucun matériau principal lié`);
    }

    for (const line of lines) {
      const bought = purchasedVolume(line, byId.get(line.material_id)!);
      // Sous-acheter est le seul défaut qu'un chantier ne pardonne pas : il
      // faut retourner au magasin. Sur-acheter, lui, se voit dans l'instantané.
      if (bought < line.adjusted_qty) {
        violations.push(
          `${label} : ${line.material_name} — ${qty(bought, line.material_unit)} achetés ` +
            `pour ${qty(line.adjusted_qty, line.material_unit)} nécessaires`,
        );
      }
    }
  }

  return violations;
}

export interface MutualisationReport {
  /** Cas où mutualiser augmente le coût `S` du moteur. Doit rester vide. */
  costRegressions: string[];
  /** Cas où mutualiser évite au moins un contenant. */
  casesThatSave: number;
  /**
   * Cas où mutualiser retient **plus** de contenants — en achetant moins de
   * volume. Constaté, pas toléré par défaut : la suite en fige le nombre.
   */
  extraContainers: string[];
  /** Traçabilité de chaque contribution : somme des parts = total mutualisé. */
  contributionMismatches: string[];
}

/**
 * Ce que la mutualisation (ENG-2) garantit réellement.
 *
 * La documentation du moteur promettait `ceil(Σ) ≤ Σ ceil` — « mutualiser ne
 * coûte jamais plus de conditionnements ». C'était vrai avant E1-5, quand un
 * achat tenait dans un seul format : `ceil` est sous-additif. Depuis que
 * `selectBestPackaging` panache les formats en minimisant
 * `S = q_min × contenants + volume`, le **nombre** de contenants n'est plus
 * monotone, et ce harnais l'a montré dès sa première exécution sur le catalogue
 * réel : une peinture murale de débutant sur ces deux pièces demande 15,718 L,
 * achetés mutualisés en 10 + 5 + 0,5 + 0,5 L (4 contenants, 16 L) là où l'achat
 * pièce par pièce prenait 5 + 2,5 puis 10 L (3 contenants, 17,5 L). Quatre
 * contenants pour 1,5 L de peinture en moins : moins cher au sens du critère,
 * plus de contenants à porter.
 *
 * Ce qui reste vrai, et se démontre : la réunion des achats pièce par pièce est
 * une solution **admissible** du problème mutualisé (son volume couvre la somme
 * des besoins) et son coût vaut exactement `Σ S_pièce`. Le moteur minimisant `S`,
 * l'optimum mutualisé ne peut pas faire pire. C'est donc `S` qu'on assert ici —
 * la seule formulation de la promesse qui soit à la fois vraie et non triviale.
 */
export function mutualisationReport(
  engine: EstimationEngine,
  rooms: HarnessRoom[],
): MutualisationReport {
  const costRegressions: string[] = [];
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
      const splitCost = perRoomLines
        .filter((l) => l.material_id === agg.material_id)
        .reduce((sum, line) => sum + purchaseCost(line, material), 0);

      // Tolérance : `total_adjusted_qty` est la somme de quantités déjà
      // arrondies au millième, donc le besoin mutualisé peut excéder la somme
      // des besoins de quelques 1e-4 — sans rapport avec la promesse testée.
      if (purchaseCost(agg, material) > splitCost + 1e-3) {
        costRegressions.push(
          `${label} : ${agg.material_name} — coût mutualisé ${purchaseCost(agg, material)} ` +
            `contre ${splitCost} pièce par pièce`,
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
    costRegressions,
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
