import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E1-6 — arbitrage entre les deux mécanismes qui produisaient la même ligne
 * d'achat. Le catalogue (`materials_catalog` × `work_type_materials`, curation
 * E1-3) est la seule source des produits chiffrés : il est lié par **ouvrage**
 * et non par catégorie, ses quantités passent par le rendement, le facteur de
 * perte et le choix du conditionnement, et lui seul est atteignable par
 * l'appariement fournisseur, les alternatives éco et les facteurs appris — tous
 * clés sur `materials_catalog.id`.
 *
 * `complementary_materials` ne garde donc que ce que la curation exclut
 * explicitement du chiffrage à la surface et qui reste utile à l'achat : le
 * linéaire (barre de seuil, profil de finition) et le petit outillage
 * (bac à peinture). Dès qu'une quantité dépend de la géométrie, le produit
 * relève du catalogue — d'où la disparition de `formula_code` avec les trois
 * lignes calculées qui l'utilisaient.
 */

interface RetiredComplement {
  category: string;
  name: string;
  description_fr: string;
  default_quantity: number;
  unit_label: string;
  display_order: number;
  formula_code: string | null;
  /** Le matériau curé qui rend ce complément redondant. Documentaire. */
  superseded_by: string;
}

/**
 * Les 14 compléments de `…009`/`…010` qu'un matériau curé double, avec leur
 * contenu d'origine : `down()` les réinsère à l'identique.
 */
const retired: RetiredComplement[] = [
  {
    category: 'painting',
    name: 'Rouleau de peinture',
    description_fr: 'Rouleau laqueur polyamide 180mm',
    default_quantity: 2,
    unit_label: 'piece',
    display_order: 1,
    formula_code: null,
    superseded_by: 'Rouleau méché 180mm',
  },
  {
    category: 'painting',
    name: 'Bache de protection',
    description_fr: 'Bache plastique 4x5m',
    default_quantity: 1,
    unit_label: 'piece',
    display_order: 2,
    formula_code: null,
    superseded_by: 'Bâche de protection 4x5m',
  },
  {
    category: 'painting',
    name: 'Ruban de masquage',
    description_fr: 'Scotch de masquage 50m',
    default_quantity: 2,
    unit_label: 'rouleau',
    display_order: 3,
    formula_code: null,
    superseded_by: 'Ruban de masquage 50m',
  },
  {
    category: 'painting',
    name: 'Sous-couche / Primaire',
    description_fr: "Primaire d'accrochage universel",
    default_quantity: 1,
    unit_label: 'pot',
    display_order: 4,
    formula_code: null,
    superseded_by: 'Sous-couche universelle',
  },
  {
    category: 'tiling',
    name: 'Colle a carrelage',
    description_fr: 'Colle flexible tous supports, sac 25kg',
    default_quantity: 1,
    unit_label: 'sac 25kg',
    display_order: 0,
    formula_code: 'tiling_adhesive',
    superseded_by:
      "Mortier-colle flexible (C2) · Colle en pâte prête à l'emploi",
  },
  {
    category: 'tiling',
    name: 'Joint de carrelage',
    description_fr: 'Joint fin ciment, sac 5kg',
    default_quantity: 1,
    unit_label: 'sac 5kg',
    display_order: 4,
    formula_code: 'tiling_grout',
    superseded_by: 'Joint fin 1-6mm',
  },
  {
    category: 'tiling',
    name: 'Croisillons',
    description_fr: 'Croisillons 2mm (sachet 200)',
    default_quantity: 1,
    unit_label: 'sachet',
    display_order: 1,
    formula_code: 'tiling_spacers',
    superseded_by: 'Croisillons 3mm (x200) · Croisillons 2mm (x200)',
  },
  {
    category: 'tiling',
    name: 'Peigne a colle',
    description_fr: 'Peigne a colle crantee 6mm',
    default_quantity: 1,
    unit_label: 'piece',
    display_order: 3,
    formula_code: null,
    superseded_by: 'Peigne à colle 10mm',
  },
  {
    category: 'flooring',
    name: 'Sous-couche parquet',
    description_fr: 'Sous-couche acoustique 2mm rouleau 15m2',
    default_quantity: 1,
    unit_label: 'rouleau',
    display_order: 1,
    formula_code: null,
    superseded_by: 'Sous-couche mousse 3mm',
  },
  {
    category: 'flooring',
    name: 'Cales de dilatation',
    description_fr: 'Kit cales de dilatation',
    default_quantity: 1,
    unit_label: 'kit',
    display_order: 2,
    formula_code: null,
    superseded_by: 'Cale de dilatation (x40)',
  },
  {
    category: 'partition',
    name: 'Bande a joint',
    description_fr: 'Bande a joint papier 23m',
    default_quantity: 2,
    unit_label: 'rouleau',
    display_order: 1,
    formula_code: null,
    superseded_by: 'Bande à joint papier 23m',
  },
  {
    category: 'partition',
    name: 'Enduit a joint',
    description_fr: "Enduit a joint pret a l'emploi 7kg",
    default_quantity: 1,
    unit_label: 'seau',
    display_order: 2,
    formula_code: null,
    superseded_by: 'Enduit à joint prêt 7kg',
  },
  {
    category: 'wall_covering',
    name: 'Colle papier peint',
    description_fr: 'Colle papier peint intisse 200g',
    default_quantity: 1,
    unit_label: 'paquet',
    display_order: 1,
    formula_code: null,
    superseded_by: 'Colle papier peint intissé',
  },
  {
    category: 'wall_covering',
    name: 'Cutter et lames',
    description_fr: 'Cutter de precision + lames',
    default_quantity: 1,
    unit_label: 'kit',
    display_order: 2,
    formula_code: null,
    superseded_by: 'Cutter de précision',
  },
];

export class RetireDuplicateComplementaryMaterials1711468800069 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const c of retired) {
      await queryRunner.query(
        `DELETE FROM "complementary_materials" WHERE "category" = $1 AND "name" = $2`,
        [c.category, c.name],
      );
    }

    // Plus aucune ligne ne porte de formule : les trois seules qui en avaient
    // une viennent d'être supprimées. La colonne part avec elles — une quantité
    // qui dépend de la géométrie se calcule dans le moteur, sur un matériau du
    // catalogue.
    await queryRunner.query(
      `ALTER TABLE "complementary_materials" DROP COLUMN "formula_code"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "complementary_materials" ADD "formula_code" varchar(50) NULL`,
    );

    for (const c of retired) {
      await queryRunner.query(
        `INSERT INTO "complementary_materials"
           ("category", "name", "description_fr", "default_quantity", "unit_label", "display_order", "formula_code")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          c.category,
          c.name,
          c.description_fr,
          c.default_quantity,
          c.unit_label,
          c.display_order,
          c.formula_code,
        ],
      );
    }
  }
}
