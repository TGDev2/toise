import { MigrationInterface, QueryRunner } from 'typeorm';

interface ComplementarySeed {
  category: string;
  name: string;
  description_fr: string;
  default_quantity: number;
  unit_label: string;
  display_order: number;
}

const seeds: ComplementarySeed[] = [
  // Painting
  {
    category: 'painting',
    name: 'Rouleau de peinture',
    description_fr: 'Rouleau laqueur polyamide 180mm',
    default_quantity: 2,
    unit_label: 'piece',
    display_order: 1,
  },
  {
    category: 'painting',
    name: 'Bache de protection',
    description_fr: 'Bache plastique 4x5m',
    default_quantity: 1,
    unit_label: 'piece',
    display_order: 2,
  },
  {
    category: 'painting',
    name: 'Ruban de masquage',
    description_fr: 'Scotch de masquage 50m',
    default_quantity: 2,
    unit_label: 'rouleau',
    display_order: 3,
  },
  {
    category: 'painting',
    name: 'Sous-couche / Primaire',
    description_fr: "Primaire d'accrochage universel",
    default_quantity: 1,
    unit_label: 'pot',
    display_order: 4,
  },
  {
    category: 'painting',
    name: 'Bac a peinture',
    description_fr: 'Bac plat pour rouleau',
    default_quantity: 1,
    unit_label: 'piece',
    display_order: 5,
  },
  // Tiling
  {
    category: 'tiling',
    name: 'Croisillons',
    description_fr: 'Croisillons 2mm (sachet 200)',
    default_quantity: 1,
    unit_label: 'sachet',
    display_order: 1,
  },
  {
    category: 'tiling',
    name: 'Profil de finition',
    description_fr: 'Profil alu angle sortant 2.5m',
    default_quantity: 2,
    unit_label: 'piece',
    display_order: 2,
  },
  {
    category: 'tiling',
    name: 'Peigne a colle',
    description_fr: 'Peigne a colle crantee 6mm',
    default_quantity: 1,
    unit_label: 'piece',
    display_order: 3,
  },
  // Flooring
  {
    category: 'flooring',
    name: 'Sous-couche parquet',
    description_fr: 'Sous-couche acoustique 2mm rouleau 15m2',
    default_quantity: 1,
    unit_label: 'rouleau',
    display_order: 1,
  },
  {
    category: 'flooring',
    name: 'Cales de dilatation',
    description_fr: 'Kit cales de dilatation',
    default_quantity: 1,
    unit_label: 'kit',
    display_order: 2,
  },
  {
    category: 'flooring',
    name: 'Barre de seuil',
    description_fr: 'Barre de seuil adhesive 93cm',
    default_quantity: 1,
    unit_label: 'piece',
    display_order: 3,
  },
  // Partition
  {
    category: 'partition',
    name: 'Bande a joint',
    description_fr: 'Bande a joint papier 23m',
    default_quantity: 2,
    unit_label: 'rouleau',
    display_order: 1,
  },
  {
    category: 'partition',
    name: 'Enduit a joint',
    description_fr: "Enduit a joint pret a l'emploi 7kg",
    default_quantity: 1,
    unit_label: 'seau',
    display_order: 2,
  },
  // Wall covering
  {
    category: 'wall_covering',
    name: 'Colle papier peint',
    description_fr: 'Colle papier peint intisse 200g',
    default_quantity: 1,
    unit_label: 'paquet',
    display_order: 1,
  },
  {
    category: 'wall_covering',
    name: 'Cutter et lames',
    description_fr: 'Cutter de precision + lames',
    default_quantity: 1,
    unit_label: 'kit',
    display_order: 2,
  },
];

export class SeedComplementaryMaterials1711468800009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const s of seeds) {
      await queryRunner.query(
        `INSERT INTO "complementary_materials"
           ("category", "name", "description_fr", "default_quantity", "unit_label", "display_order")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          s.category,
          s.name,
          s.description_fr,
          s.default_quantity,
          s.unit_label,
          s.display_order,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "complementary_materials";`);
  }
}
