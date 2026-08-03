import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E1-7 (BACKLOG_V1) — Traçabilité des rendements du catalogue V1.
 *
 * Chaque correction ci-dessous est adossée à une fiche technique fabricant
 * réelle, chargée et citée dans `docs/SOURCES_CATALOGUE.md` (une ligne par
 * matériau : valeur fiche verbatim, URL, date de consultation). Les écarts
 * majeurs :
 *
 *  - Mortier-colle C2 sous 45×45 sol : la fiche Cermix impose le double
 *    encollage (7 kg/m² U9) — le seedé 0,22 (4,55 kg/m²) correspondait à une
 *    colonne petit format en simple encollage. Sous-achat ~35 %.
 *  - Système Placostil 72/48 deux faces (fiche solution Placo, quantitatif
 *    par m² de cloison) : plaques 2,10 m²/m², rails 0,90 m/m², montants
 *    simples 2,10 m/m², vis 22/m², bande 2,80 m/m², enduits 0,47 kg/m² de
 *    parement (pâte) et 0,66 kg/m² d'ouvrage (poudre). Les placeholders à 1
 *    faisaient acheter une face sur deux, et une bande ou un rail « par m² ».
 *  - Colle papier peint intissé : les seaux 5/10 kg seedés désignent une
 *    colle en pâte (~8 m²/kg, Quelyd Perfect) — le seedé 30 ne correspondait
 *    à aucun produit (poudre ≈ 100-160, pâte ≈ 8).
 *
 * Le seed 006 est corrigé en parallèle (installs neuves / CI). Cette
 * migration met à jour les bases DÉJÀ seedées. Le prédicat
 * `AND yield_per_unit = <old>` rend l'UP rejouable et évite d'écraser une
 * valeur déjà retouchée par un admin (colonnes `modified_by`/`modified_at`
 * volontairement non touchées : ce n'est pas une édition admin mais une
 * correction de seed). Modèle : `1711468800033-RecalibrateCatalogYields`.
 */

interface YieldCorrection {
  name: string;
  category: string;
  old: number;
  new: number;
}

// Une ligne par décision « corriger » de docs/SOURCES_CATALOGUE.md.
const corrections: YieldCorrection[] = [
  // Peintures — fiches Dulux Valentine / V33 : 10 m²/L, pas 12 ni 9.
  {
    name: 'Peinture plafond anti-traces',
    category: 'painting',
    old: 12,
    new: 10,
  },
  {
    name: 'Peinture cuisine et salle de bain',
    category: 'painting',
    old: 9,
    new: 10,
  },
  // Carrelage — fiches Cermix (consommations double encollage incluses).
  {
    name: 'Mortier-colle flexible (C2)',
    category: 'tiling',
    old: 0.22,
    new: 0.14,
  },
  {
    name: "Colle en pâte prête à l'emploi",
    category: 'tiling',
    old: 0.4,
    new: 0.22,
  },
  {
    name: 'Joint fin 1-6mm',
    category: 'tiling',
    old: 2.5,
    new: 4,
  },
  // Papier peint — colle en pâte (seaux seedés), Quelyd Perfect ≈ 8 m²/kg.
  {
    name: 'Colle papier peint intissé',
    category: 'wall_covering',
    old: 30,
    new: 8,
  },
  // Sols — recouvrement des lés ≥ 20 cm (Wineo/Tarkett) sur lé de 1 m.
  {
    name: 'Film pare-vapeur PE',
    category: 'flooring',
    old: 1,
    new: 0.8,
  },
  // Cloison 72/48 — quantitatif Placo par m² de cloison (deux faces).
  {
    name: 'Plaque BA13 standard 2.5x1.2m',
    category: 'partition',
    old: 1,
    new: 0.48,
  },
  {
    name: 'Plaque BA13 hydro 2.5x1.2m',
    category: 'partition',
    old: 1,
    new: 0.48,
  },
  {
    name: 'Rail R48 3m',
    category: 'partition',
    old: 1,
    new: 1.11,
  },
  {
    name: 'Montant M48 2.7m',
    category: 'partition',
    old: 1,
    new: 0.48,
  },
  {
    name: 'Vis placo 25mm (x500)',
    category: 'partition',
    old: 1,
    new: 22.7,
  },
  {
    name: 'Bande à joint papier 23m',
    category: 'partition',
    old: 1,
    new: 0.36,
  },
  {
    name: 'Enduit à joint prêt 7kg',
    category: 'partition',
    old: 2.5,
    new: 1,
  },
  {
    name: 'Enduit à joint poudre 5kg',
    category: 'partition',
    old: 2,
    new: 1.52,
  },
];

export class RecalibrateSourcedYields1711468800070 implements MigrationInterface {
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
