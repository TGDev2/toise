import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedMaterials } from '../materials/seed-catalog.data';
import { seedWorkTypes } from '../projects/work-types.data';

/**
 * E1-7 (BACKLOG_V1) — le registre des facteurs de perte n'a plus de trou.
 *
 * ## Le défaut
 *
 * `resolveWasteFactor` résolvait en trois temps : pose exacte, pose `standard`,
 * puis 10 % génériques. Le troisième temps était silencieux et il était atteint
 * dans des cas nominaux, parce que la pose transmise par un ouvrage qui ne
 * demandait pas le calepinage valait `standard` — un mot qu'aucun carreau ni
 * aucun papier peint ne déclarait. Conséquences mesurées sur le harnais :
 * 24 des 111 lignes de matériau de chaque géométrie chiffrées à 10 % ; le
 * carrelage mural et le revêtement mural insensibles au niveau de compétence ;
 * la pose diagonale du parquet inatteignable depuis le produit.
 *
 * ## Ce que cette migration écrit
 *
 * 1. **`waste_factors`** — les trois familles concernées (`tiling`, `flooring`,
 *    `wall_covering`) sont réécrites depuis `seed-catalog.data.ts`, seule source
 *    de vérité. Trois changements de fond :
 *
 *    - les matériaux **dosés** (mortiers-colles, joints, primaires, ragréages,
 *      SEL, colles à papier peint) quittent les poses du revêtement pour une
 *      pose unique à 5/3/2 % : une chute de carreau est reposée ailleurs, donc
 *      la colle suit la surface **nette**, pas la surface achetée. En pose
 *      diagonale débutante, cela retire un sac de 25 kg par chantier ;
 *    - le parquet renomme sa pose `standard` en `straight`, corrige sa pose
 *      `diagonal` (15/10/7 → 20/17/15 ; 7 % en expert était un sous-achat) et
 *      gagne `herringbone` (25/22/20) ;
 *    - le revêtement mural fusionne `plain` et `patterned` en une pose unique
 *      à 15/8/3 : depuis E1-6 la chute de raccord est comptée géométriquement
 *      (`wallpaper-strips.ts`), la reporter en pourcentage la comptait deux
 *      fois.
 *
 *    Les familles `painting` et `partition` ne sont **pas** touchées : leurs
 *    valeurs sont cohérentes avec les usages relevés, et elles déclaraient déjà
 *    la seule pose de leur ouvrage.
 *
 * 2. **`work_types.contextual_questions`** — `wall_tiling` et
 *    `parquet_flooring` gagnent la question « Type de pose ». Sans elle, leurs
 *    poses restent des données que personne ne peut atteindre.
 *
 * Chaque valeur retenue est adossée à une source citée dans
 * `docs/SOURCES_CATALOGUE.md`, section « Facteurs de perte ». Aucune n'est
 * normative : aucun DTU ne fixe de pourcentage de perte, et le registre le dit.
 *
 * ## Réversibilité
 *
 * Additive au sens d'E6-5 : aucune colonne, aucune table, aucune ligne de
 * catalogue supprimée — seules des valeurs bougent. `down()` réécrit l'état
 * d'origine, décrit ci-dessous par les mêmes règles qui l'avaient produit, et
 * retire les deux questions.
 */

interface WasteRow {
  pose_type: string;
  skill_level: string;
  factor_percent: number;
}

/**
 * Les matériaux que ce lot réécrit, par leur **jeu de lignes d'origine**.
 *
 * Pourquoi des listes et non « toutes les catégories `tiling`, `flooring` et
 * `wall_covering` » : ces catégories contiennent aussi 31 accessoires
 * (croisillons, peignes, éponges, cales, kits de pose…) qui portaient — et
 * portent toujours — `accessoryWaste()`. Les inclure ferait tourner l'`up()`
 * pour rien, et surtout ferait écrire au `down()` des poses de carrelage sur un
 * paquet de croisillons. Le périmètre est donc l'ensemble des matériaux dont
 * les lignes **changent réellement**, énuméré ici pour que le retour arrière
 * soit exact et vérifiable à la lecture.
 */
const LEGACY_TILE_MATERIALS = [
  'Carrelage sol 20x20 cm',
  'Carrelage sol 30x30 cm',
  'Carrelage sol 45x45 cm',
  'Carrelage sol 60x60 cm',
  'Carrelage sol 30x60 cm',
  'Carrelage mural 10x10 cm',
  'Carrelage mural 15x15 cm',
  'Carrelage mural 20x20 cm',
  'Carrelage mural 20x40 cm',
  'Carrelage mural 30x60 cm',
  'Mosaïque 30x30 cm',
  'Faïence murale 25x40 cm',
  'Mortier-colle standard (C1)',
  'Mortier-colle flexible (C2)',
  'Mortier-colle rapide (C2F)',
  'Mortier-colle grand format (C2S1)',
  "Colle en pâte prête à l'emploi",
  'Joint fin 1-6mm',
  'Joint large 5-20mm',
  'Joint époxy',
  'Joint souple silicone',
  "SEL (Système d'Étanchéité Liquide)",
  "Bande d'étanchéité 120mm",
  'Natte de découplage',
  'Carrelage imitation bois 20x120 cm',
  'Carrelage imitation pierre 60x60 cm',
  'Carrelage extérieur antidérapant 30x30 cm',
  'Plinthe carrelage 8x30 cm',
  'Carrelage hexagonal 20cm',
  "Primaire d'accrochage carrelage",
  'Ragréage autolissant',
  'Carrelage sol 80x80 cm',
  'Carrelage métro 7.5x15 cm',
  'Carrelage mural 10x30 cm',
  'Mortier de ragréage extérieur',
];

const LEGACY_FLOOR_COVERING_MATERIALS = [
  'Stratifié 7mm AC3',
  'Stratifié 8mm AC4',
  'Stratifié 10mm AC4',
  'Stratifié 12mm AC5',
  'Parquet contrecollé chêne 14mm',
  'Parquet contrecollé chêne 10mm',
  'Parquet massif chêne 22mm',
  'Parquet bambou 15mm',
  'Lame vinyle clipsable 4mm',
  'Lame vinyle clipsable 5mm SPC',
  'Lame vinyle à coller 2.5mm',
  'Dalle vinyle 60x60 cm',
  'Sol PVC en rouleau',
  'Parquet pin 22mm',
  'Moquette aiguilletée',
  'Jonc de mer',
  'Sisal naturel',
  'Lame PVC adhésive',
];

const LEGACY_FLOOR_ANCILLARY_MATERIALS = [
  'Sous-couche mousse 2mm',
  'Sous-couche mousse 3mm',
  'Sous-couche liège 2mm',
  'Sous-couche acoustique 5mm',
  'Film pare-vapeur PE',
  'Plinthe MDF 60mm 2.4m',
  'Plinthe MDF 80mm 2.4m',
  'Plinthe chêne 70mm 2.4m',
  'Profilé de jonction 2.7m',
  'Colle parquet',
  'Sous-couche fibre de bois 5mm',
  'Colle vinyle',
  'Ragréage fibré sol',
  "Primaire d'accrochage sol",
];

const rows = (pose: string, b: number, i: number, e: number): WasteRow[] => [
  { pose_type: pose, skill_level: 'beginner', factor_percent: b },
  { pose_type: pose, skill_level: 'intermediate', factor_percent: i },
  { pose_type: pose, skill_level: 'expert', factor_percent: e },
];

// --- État d'origine ---------------------------------------------------------
//
// Figé ici, et non relu depuis le fichier de seed : celui-ci porte désormais le
// nouvel état, et un `down()` qui s'y référerait ne défaire rien.

const LEGACY_TILE = [
  ...rows('straight', 15, 10, 5),
  ...rows('diagonal', 20, 15, 10),
];
const LEGACY_FLOOR_COVERING = [
  ...rows('standard', 10, 7, 5),
  ...rows('diagonal', 15, 10, 7),
];
const LEGACY_FLOOR_ANCILLARY = rows('standard', 10, 7, 5);
const LEGACY_WC_PLAIN = rows('plain', 10, 7, 3);
const LEGACY_WC_PATTERNED = rows('patterned', 18, 12, 7);
const LEGACY_WC_BOTH = [...LEGACY_WC_PLAIN, ...LEGACY_WC_PATTERNED];

/**
 * Les 17 matériaux `wall_covering` qui ne déclaraient que `plain`, et les 2 qui
 * ne déclaraient que `patterned`. Les 5 restants portaient les deux poses.
 *
 * Ces trois listes sont écrites en clair parce qu'aucune règle ne les sépare :
 * `Papier peint panoramique` était `patterned` et `Papier peint intissé uni`
 * était `plain`, sans que rien dans leurs colonnes ne le dise. C'est d'ailleurs
 * une partie du défaut — le vocabulaire des poses ne se déduisait de rien.
 */
const LEGACY_WC_PLAIN_ONLY = [
  'Papier peint intissé uni',
  'Colle papier peint intissé',
  'Colle papier peint vinyle',
  'Colle universelle papier peint',
  'Colle papier peint renforcée (heavy)',
  "Papier d'apprêt lisse",
  'Toile de verre maille',
  'Toile de verre chevron',
  'Voile de verre à peindre',
  'Lambris PVC blanc 2.6m',
  'Lambris PVC couleur 2.6m',
  'Lambris bois brut 2m',
  'Lambris MDF 2.6m',
  'Parement pierre naturelle',
  'Parement brique',
  'Panneau mural 3D',
  'Colle de fixation lambris',
];

const LEGACY_WC_PATTERNED_ONLY = [
  'Papier peint panoramique',
  'Frise murale décorative',
];

/** Les 5 qui portaient les deux poses — tous des papiers peints en rouleau. */
const LEGACY_WC_BOTH_ONLY = [
  'Papier peint intissé à motif',
  'Papier peint vinyle expansé',
  'Papier peint vinyle sur intissé',
  'Papier peint traditionnel',
  'Papier peint intissé texturé',
];

/**
 * Tous les matériaux du périmètre, et le jeu de lignes qu'ils portaient avant
 * ce lot. Toute lecture — `up()` comme `down()` — passe par cette liste : le
 * périmètre est donc rigoureusement le même dans les deux sens.
 */
const LEGACY_BY_MATERIAL: { name: string; legacy: WasteRow[] }[] = [
  ...LEGACY_TILE_MATERIALS.map((name) => ({ name, legacy: LEGACY_TILE })),
  ...LEGACY_FLOOR_COVERING_MATERIALS.map((name) => ({
    name,
    legacy: LEGACY_FLOOR_COVERING,
  })),
  ...LEGACY_FLOOR_ANCILLARY_MATERIALS.map((name) => ({
    name,
    legacy: LEGACY_FLOOR_ANCILLARY,
  })),
  ...LEGACY_WC_PLAIN_ONLY.map((name) => ({ name, legacy: LEGACY_WC_PLAIN })),
  ...LEGACY_WC_PATTERNED_ONLY.map((name) => ({
    name,
    legacy: LEGACY_WC_PATTERNED,
  })),
  ...LEGACY_WC_BOTH_ONLY.map((name) => ({ name, legacy: LEGACY_WC_BOTH })),
];

const POSE_QUESTION_CODES = ['wall_tiling', 'parquet_flooring'];

async function rewriteWasteFactors(
  queryRunner: QueryRunner,
  rowsFor: (entry: { name: string; legacy: WasteRow[] }) => WasteRow[],
): Promise<void> {
  let materials = 0;
  let inserted = 0;

  for (const entry of LEGACY_BY_MATERIAL) {
    const found = (await queryRunner.query(
      `SELECT "id" FROM "materials_catalog" WHERE "name" = $1`,
      [entry.name],
    )) as { id: string }[];
    if (found.length === 0) {
      // Un matériau retiré à la main d'une base : on ne le ressuscite pas.
      continue;
    }
    const materialId = found[0].id;

    await queryRunner.query(
      `DELETE FROM "waste_factors" WHERE "material_id" = $1`,
      [materialId],
    );
    for (const row of rowsFor(entry)) {
      await queryRunner.query(
        `INSERT INTO "waste_factors" ("material_id", "pose_type", "skill_level", "factor_percent")
         VALUES ($1, $2, $3, $4)`,
        [materialId, row.pose_type, row.skill_level, row.factor_percent],
      );
      inserted++;
    }
    materials++;
  }

  console.log(
    `[…083] facteurs de perte réécrits : ${materials} matériaux, ${inserted} lignes`,
  );
}

export class RebuildWasteFactorRegistry1711468800083 implements MigrationInterface {
  name = 'RebuildWasteFactorRegistry1711468800083';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await rewriteWasteFactors(queryRunner, ({ name }) => {
      const seed = seedMaterials.find((m) => m.name === name);
      if (!seed) {
        throw new Error(`Matériau absent du catalogue seedé : ${name}`);
      }
      return seed.waste_factors as WasteRow[];
    });

    for (const code of POSE_QUESTION_CODES) {
      const workType = seedWorkTypes.find((wt) => wt.code === code);
      if (!workType) {
        throw new Error(`Ouvrage absent du seed : ${code}`);
      }
      const [, affected] = (await queryRunner.query(
        `UPDATE "work_types" SET "contextual_questions" = $1 WHERE "code" = $2`,
        [JSON.stringify(workType.contextual_questions), code],
      )) as [unknown, number];
      console.log(
        `[…083] question de calepinage posée sur ${code} : ${affected} ligne(s)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await rewriteWasteFactors(queryRunner, ({ legacy }) => legacy);

    for (const code of POSE_QUESTION_CODES) {
      const [, affected] = (await queryRunner.query(
        `UPDATE "work_types" SET "contextual_questions" = '[]'::jsonb WHERE "code" = $1`,
        [code],
      )) as [unknown, number];
      console.log(
        `[…083] question de calepinage retirée de ${code} : ${affected} ligne(s)`,
      );
    }
  }
}
