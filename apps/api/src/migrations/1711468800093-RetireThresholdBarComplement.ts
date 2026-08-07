import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E1-10 (BACKLOG_V1) — la barre de seuil sort du forfait complément.
 *
 * La règle d'E1-6, appliquée un cran plus loin : **dès qu'une quantité dépend
 * de la géométrie, le produit relève du catalogue.** Depuis `…086`, la barre
 * de seuil se compte sur `door_count` (une par passage de porte) et est liée
 * à `floor_tiling` et `parquet_flooring` (`…092`) — le forfait « 1 pièce »
 * de `complementary_materials` produirait la même ligne deux fois, le doublon
 * exact que `…069` a purgé.
 *
 * Ne restent en complément que **bac à peinture** et **profil de finition**,
 * dont les quantités ne dépendent d'aucune grandeur du modèle. Même modèle
 * que `…069` : contenu d'origine (`…009`) recopié en dur, down à
 * l'identique.
 */

const RETIRED = {
  category: 'flooring',
  name: 'Barre de seuil',
  description_fr: 'Barre de seuil adhesive 93cm',
  default_quantity: 1,
  unit_label: 'piece',
  display_order: 3,
  /** Le matériau du catalogue qui le remplace. Documentaire. */
  superseded_by: 'Barre de seuil alu 93cm (door_count, …086/…092)',
};

export class RetireThresholdBarComplement1711468800093 implements MigrationInterface {
  name = 'RetireThresholdBarComplement1711468800093';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "complementary_materials" WHERE "category" = $1 AND "name" = $2`,
      [RETIRED.category, RETIRED.name],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "complementary_materials"
         ("category", "name", "description_fr", "default_quantity", "unit_label", "display_order")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        RETIRED.category,
        RETIRED.name,
        RETIRED.description_fr,
        RETIRED.default_quantity,
        RETIRED.unit_label,
        RETIRED.display_order,
      ],
    );
  }
}
