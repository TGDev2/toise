import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ENG-5 — Étalonnage du catalogue.
 *
 * Le moteur calcule `qty = surface_m2 / yield_per_unit`, donc `yield_per_unit`
 * est la surface (m²) couverte par unité de matériau. Plusieurs rendements
 * seedés en 1711468800006 étaient faux au regard des fiches techniques
 * fabricants (Weber, Cermix, Bostik, PRB, Sika, QUELYD…) :
 *
 *  - Mortiers-colles / ragréages / SEL : rendements ~15–20× trop élevés
 *    ⇒ le moteur faisait ACHETER TROP PEU (ex. mortier-colle 0,20 kg/m² au lieu
 *    de ~4 kg/m²). Sous-achat critique.
 *  - Plaques BA (BA13/BA10/BA18/phonique) : `yield_per_unit: 3` alors que le
 *    conditionnement vaut déjà 3 m²/plaque ⇒ double division par 3 ⇒ ~3× trop
 *    peu de plaques. Doit valoir 1 (un revêtement couvre 1 m² pour 1 m²).
 *  - Colles à papier peint : rendements trop faibles ⇒ sur-achat massif (poudre
 *    ~10 g/m² réel vs ~200 g/m² seedé).
 *  - Ajustements mineurs : enduit de lissage, colle parquet, joint fin/large,
 *    colle vinyle.
 *
 * Le seed 006 est corrigé en parallèle (installs neuves / CI). Cette migration
 * met à jour les bases DÉJÀ seedées. Le prédicat `AND yield_per_unit = <old>`
 * rend l'UP rejouable et évite d'écraser une valeur déjà retouchée par un admin
 * (colonnes `modified_by`/`modified_at` volontairement non touchées : ce n'est
 * pas une édition admin mais une correction de seed).
 */

interface YieldCorrection {
  name: string;
  category: string;
  old: number;
  new: number;
}

// Aligné sur les tables A/B/C du plan ENG-5 (source → valeur recommandée).
const corrections: YieldCorrection[] = [
  // A — sous-achats critiques
  {
    name: 'Mortier-colle standard (C1)',
    category: 'tiling',
    old: 5,
    new: 0.25,
  },
  {
    name: 'Mortier-colle flexible (C2)',
    category: 'tiling',
    old: 4,
    new: 0.22,
  },
  { name: 'Mortier-colle rapide (C2F)', category: 'tiling', old: 4, new: 0.25 },
  {
    name: 'Mortier-colle grand format (C2S1)',
    category: 'tiling',
    old: 3.5,
    new: 0.15,
  },
  {
    name: "Colle en pâte prête à l'emploi",
    category: 'tiling',
    old: 3,
    new: 0.4,
  },
  { name: 'Ragréage autolissant', category: 'tiling', old: 1.5, new: 0.2 },
  {
    name: 'Mortier de ragréage extérieur',
    category: 'tiling',
    old: 1.5,
    new: 0.2,
  },
  { name: 'Ragréage fibré sol', category: 'flooring', old: 1.5, new: 0.2 },
  {
    name: "SEL (Système d'Étanchéité Liquide)",
    category: 'tiling',
    old: 1.5,
    new: 0.7,
  },
  {
    name: 'Plaque BA13 standard 2.5x1.2m',
    category: 'partition',
    old: 3,
    new: 1,
  },
  { name: 'Plaque BA13 hydro 2.5x1.2m', category: 'partition', old: 3, new: 1 },
  { name: 'Plaque BA13 feu 2.5x1.2m', category: 'partition', old: 3, new: 1 },
  {
    name: 'Plaque BA10 standard 2.5x1.2m',
    category: 'partition',
    old: 3,
    new: 1,
  },
  {
    name: 'Plaque BA18 standard 2.5x1.2m',
    category: 'partition',
    old: 3,
    new: 1,
  },
  {
    name: 'Plaque placo phonique 2.5x1.2m',
    category: 'partition',
    old: 3,
    new: 1,
  },
  // B — sur-achats
  {
    name: 'Colle papier peint intissé',
    category: 'wall_covering',
    old: 5,
    new: 30,
  },
  {
    name: 'Colle papier peint vinyle',
    category: 'wall_covering',
    old: 4.5,
    new: 30,
  },
  {
    name: 'Colle universelle papier peint',
    category: 'wall_covering',
    old: 5,
    new: 30,
  },
  {
    name: 'Colle papier peint renforcée (heavy)',
    category: 'wall_covering',
    old: 4,
    new: 30,
  },
  { name: 'Joint fin 1-6mm', category: 'tiling', old: 1, new: 2.5 },
  { name: 'Colle vinyle', category: 'flooring', old: 1.5, new: 3 },
  // C — ajustements mineurs
  { name: 'Enduit de lissage', category: 'painting', old: 1.5, new: 0.8 },
  { name: 'Colle parquet', category: 'flooring', old: 1.2, new: 0.9 },
  { name: 'Joint large 5-20mm', category: 'tiling', old: 0.5, new: 1 },
];

export class RecalibrateCatalogYields1711468800033 implements MigrationInterface {
  private async apply(
    queryRunner: QueryRunner,
    from: 'old' | 'new',
    to: 'old' | 'new',
  ): Promise<void> {
    for (const c of corrections) {
      await queryRunner.query(
        `UPDATE "materials_catalog"
           SET "yield_per_unit" = $1
         WHERE "name" = $2 AND "category" = $3 AND "yield_per_unit" = $4`,
        [c[to], c.name, c.category, c[from]],
      );
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.apply(queryRunner, 'old', 'new');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.apply(queryRunner, 'new', 'old');
  }
}
