import { WorkTypeMaterialRole } from './entities/work-type-material.entity';

/**
 * Liaison ouvrage → matériaux, seedée par les migrations
 * `1711468800066-CreateWorkTypeMaterials` (base vierge : tableau complet) et
 * `1711468800067-CurateWorkTypeMaterials` (base existante : delta E1-3), et
 * rejouée telle quelle par les tests (`estimation-engine.seeded-catalog.spec.ts`) :
 * une seule source de vérité, sur le modèle posé par `seed-catalog.data.ts`.
 *
 * E1-3 matérialise la décision métier des 7 jeux (relecture artisan :
 * `docs/MATERIAUX_OUVRAGES.md`) : principal + consommables systématiques +
 * accessoires « petit matériel par chantier », 3 à 6 lignes obligatoires par
 * ouvrage. `is_optional: true` = alternative documentée, jamais chiffrée
 * automatiquement. Deux limites assumées, portées par les épics suivants :
 * les quantités des accessoires restent fausses tant qu'E1-4 n'est pas fait
 * (couches appliquées à tout, rendements `unit` à 1), et le recouvrement avec
 * les compléments calculés (`…009`/`…010` : rouleau, bâche, croisillons,
 * bande/enduit à joint, colle papier peint…) est arbitré par E1-6.
 */
export interface WorkTypeMaterialLink {
  work_type_code: string;
  material_name: string;
  material_category: string;
  role: WorkTypeMaterialRole;
  is_optional: boolean;
  display_order: number;
}

/**
 * Les 11 liaisons posées par E1-2, avec leurs attributs FINAUX après E1-3 :
 * le `Carrelage sol 30x30 cm` est rétrogradé d'un format daté par défaut à
 * une alternative documentée (la migration `…067` porte l'UPDATE pour les
 * bases déjà seedées par `…066`).
 */
const e12Links: WorkTypeMaterialLink[] = [
  {
    work_type_code: 'wall_painting',
    material_name: 'Peinture acrylique mate',
    material_category: 'painting',
    role: 'principal',
    is_optional: false,
    display_order: 1,
  },
  {
    work_type_code: 'wall_painting',
    material_name: 'Sous-couche universelle',
    material_category: 'painting',
    role: 'sous_couche',
    is_optional: false,
    display_order: 2,
  },
  {
    work_type_code: 'ceiling_painting',
    material_name: 'Peinture plafond mate',
    material_category: 'painting',
    role: 'principal',
    is_optional: false,
    display_order: 1,
  },
  {
    work_type_code: 'ceiling_painting',
    material_name: 'Sous-couche universelle',
    material_category: 'painting',
    role: 'sous_couche',
    is_optional: false,
    display_order: 2,
  },
  {
    work_type_code: 'floor_tiling',
    material_name: 'Carrelage sol 30x30 cm',
    material_category: 'tiling',
    role: 'principal',
    is_optional: true,
    display_order: 7,
  },
  {
    work_type_code: 'wall_tiling',
    material_name: 'Faïence murale 25x40 cm',
    material_category: 'tiling',
    role: 'principal',
    is_optional: false,
    display_order: 1,
  },
  {
    work_type_code: 'parquet_flooring',
    material_name: 'Stratifié 8mm AC4',
    material_category: 'flooring',
    role: 'principal',
    is_optional: false,
    display_order: 1,
  },
  {
    work_type_code: 'parquet_flooring',
    material_name: 'Sous-couche mousse 3mm',
    material_category: 'flooring',
    role: 'sous_couche',
    is_optional: false,
    display_order: 2,
  },
  {
    work_type_code: 'drywall',
    material_name: 'Plaque BA13 standard 2.5x1.2m',
    material_category: 'partition',
    role: 'principal',
    is_optional: false,
    display_order: 1,
  },
  {
    work_type_code: 'wall_covering',
    material_name: 'Papier peint intissé uni',
    material_category: 'wall_covering',
    role: 'principal',
    is_optional: false,
    display_order: 1,
  },
  {
    work_type_code: 'wall_covering',
    material_name: 'Colle papier peint intissé',
    material_category: 'wall_covering',
    role: 'consommable',
    is_optional: false,
    display_order: 2,
  },
];

/**
 * Delta E1-3 : les 45 liaisons ajoutées à la curation, insérées par `…067`
 * sur les bases déjà migrées (sur base vierge, `…066` insère directement le
 * tableau complet et ces INSERT sont des no-ops). Groupées par ouvrage,
 * `display_order` continuant après les rangs d'E1-2.
 */
export const workTypeMaterialLinksE13: WorkTypeMaterialLink[] = [
  // --- wall_painting : peinture murale intérieure (E1-2 : ordres 1-2) ---
  {
    work_type_code: 'wall_painting',
    material_name: 'Rouleau méché 180mm',
    material_category: 'painting',
    role: 'accessoire',
    is_optional: false,
    display_order: 3,
  },
  {
    work_type_code: 'wall_painting',
    material_name: 'Pinceau à rechampir 25mm',
    material_category: 'painting',
    role: 'accessoire',
    is_optional: false,
    display_order: 4,
  },
  {
    work_type_code: 'wall_painting',
    material_name: 'Ruban de masquage 50m',
    material_category: 'painting',
    role: 'accessoire',
    is_optional: false,
    display_order: 5,
  },
  {
    work_type_code: 'wall_painting',
    material_name: 'Bâche de protection 4x5m',
    material_category: 'painting',
    role: 'accessoire',
    is_optional: false,
    display_order: 6,
  },
  {
    work_type_code: 'wall_painting',
    material_name: 'Peinture acrylique satinée',
    material_category: 'painting',
    role: 'principal',
    is_optional: true,
    display_order: 7,
  },
  {
    work_type_code: 'wall_painting',
    material_name: 'Peinture acrylique velours',
    material_category: 'painting',
    role: 'principal',
    is_optional: true,
    display_order: 8,
  },
  {
    work_type_code: 'wall_painting',
    material_name: 'Peinture cuisine et salle de bain',
    material_category: 'painting',
    role: 'principal',
    is_optional: true,
    display_order: 9,
  },
  // --- ceiling_painting : peinture plafond (E1-2 : ordres 1-2) ---
  {
    work_type_code: 'ceiling_painting',
    material_name: 'Rouleau méché 180mm',
    material_category: 'painting',
    role: 'accessoire',
    is_optional: false,
    display_order: 3,
  },
  {
    work_type_code: 'ceiling_painting',
    material_name: 'Pinceau à rechampir 25mm',
    material_category: 'painting',
    role: 'accessoire',
    is_optional: false,
    display_order: 4,
  },
  {
    work_type_code: 'ceiling_painting',
    material_name: 'Bâche de protection 4x5m',
    material_category: 'painting',
    role: 'accessoire',
    is_optional: false,
    display_order: 5,
  },
  {
    work_type_code: 'ceiling_painting',
    material_name: 'Ruban de masquage 50m',
    material_category: 'painting',
    role: 'accessoire',
    is_optional: false,
    display_order: 6,
  },
  {
    work_type_code: 'ceiling_painting',
    material_name: 'Peinture plafond anti-traces',
    material_category: 'painting',
    role: 'principal',
    is_optional: true,
    display_order: 7,
  },
  // --- floor_tiling : carrelage sol intérieur (E1-2 : 30x30 rétrogradé en 7) ---
  {
    work_type_code: 'floor_tiling',
    material_name: 'Carrelage sol 45x45 cm',
    material_category: 'tiling',
    role: 'principal',
    is_optional: false,
    display_order: 1,
  },
  {
    work_type_code: 'floor_tiling',
    material_name: 'Mortier-colle flexible (C2)',
    material_category: 'tiling',
    role: 'consommable',
    is_optional: false,
    display_order: 2,
  },
  {
    work_type_code: 'floor_tiling',
    material_name: 'Joint fin 1-6mm',
    material_category: 'tiling',
    role: 'consommable',
    is_optional: false,
    display_order: 3,
  },
  {
    work_type_code: 'floor_tiling',
    material_name: 'Croisillons 3mm (x200)',
    material_category: 'tiling',
    role: 'accessoire',
    is_optional: false,
    display_order: 4,
  },
  {
    work_type_code: 'floor_tiling',
    material_name: 'Éponge de carreleur',
    material_category: 'tiling',
    role: 'accessoire',
    is_optional: false,
    display_order: 5,
  },
  {
    work_type_code: 'floor_tiling',
    material_name: 'Peigne à colle 10mm',
    material_category: 'tiling',
    role: 'accessoire',
    is_optional: false,
    display_order: 6,
  },
  {
    work_type_code: 'floor_tiling',
    material_name: 'Carrelage sol 60x60 cm',
    material_category: 'tiling',
    role: 'principal',
    is_optional: true,
    display_order: 8,
  },
  {
    work_type_code: 'floor_tiling',
    material_name: 'Carrelage imitation bois 20x120 cm',
    material_category: 'tiling',
    role: 'principal',
    is_optional: true,
    display_order: 9,
  },
  // --- wall_tiling : faïence murale (E1-2 : ordre 1) ---
  {
    work_type_code: 'wall_tiling',
    material_name: "Colle en pâte prête à l'emploi",
    material_category: 'tiling',
    role: 'consommable',
    is_optional: false,
    display_order: 2,
  },
  {
    work_type_code: 'wall_tiling',
    material_name: 'Joint fin 1-6mm',
    material_category: 'tiling',
    role: 'consommable',
    is_optional: false,
    display_order: 3,
  },
  {
    work_type_code: 'wall_tiling',
    material_name: 'Joint souple silicone',
    material_category: 'tiling',
    role: 'consommable',
    is_optional: false,
    display_order: 4,
  },
  {
    work_type_code: 'wall_tiling',
    material_name: 'Croisillons 2mm (x200)',
    material_category: 'tiling',
    role: 'accessoire',
    is_optional: false,
    display_order: 5,
  },
  {
    work_type_code: 'wall_tiling',
    material_name: 'Éponge de carreleur',
    material_category: 'tiling',
    role: 'accessoire',
    is_optional: false,
    display_order: 6,
  },
  {
    work_type_code: 'wall_tiling',
    material_name: 'Carrelage métro 7.5x15 cm',
    material_category: 'tiling',
    role: 'principal',
    is_optional: true,
    display_order: 7,
  },
  {
    work_type_code: 'wall_tiling',
    material_name: 'Carrelage mural 20x40 cm',
    material_category: 'tiling',
    role: 'principal',
    is_optional: true,
    display_order: 8,
  },
  // --- parquet_flooring : pose flottante (E1-2 : ordres 1-2) ---
  {
    work_type_code: 'parquet_flooring',
    material_name: 'Film pare-vapeur PE',
    material_category: 'flooring',
    role: 'sous_couche',
    is_optional: false,
    display_order: 3,
  },
  {
    work_type_code: 'parquet_flooring',
    material_name: 'Ruban adhésif pare-vapeur',
    material_category: 'flooring',
    role: 'consommable',
    is_optional: false,
    display_order: 4,
  },
  {
    work_type_code: 'parquet_flooring',
    material_name: 'Cale de dilatation (x40)',
    material_category: 'flooring',
    role: 'accessoire',
    is_optional: false,
    display_order: 5,
  },
  {
    work_type_code: 'parquet_flooring',
    material_name: 'Parquet contrecollé chêne 14mm',
    material_category: 'flooring',
    role: 'principal',
    is_optional: true,
    display_order: 6,
  },
  {
    work_type_code: 'parquet_flooring',
    material_name: 'Stratifié 12mm AC5',
    material_category: 'flooring',
    role: 'principal',
    is_optional: true,
    display_order: 7,
  },
  // --- drywall : cloison 72/48 simple peau (E1-2 : ordre 1) ---
  {
    work_type_code: 'drywall',
    material_name: 'Rail R48 3m',
    material_category: 'partition',
    role: 'consommable',
    is_optional: false,
    display_order: 2,
  },
  {
    work_type_code: 'drywall',
    material_name: 'Montant M48 2.7m',
    material_category: 'partition',
    role: 'consommable',
    is_optional: false,
    display_order: 3,
  },
  {
    work_type_code: 'drywall',
    material_name: 'Vis placo 25mm (x500)',
    material_category: 'partition',
    role: 'consommable',
    is_optional: false,
    display_order: 4,
  },
  {
    work_type_code: 'drywall',
    material_name: 'Bande à joint papier 23m',
    material_category: 'partition',
    role: 'consommable',
    is_optional: false,
    display_order: 5,
  },
  {
    work_type_code: 'drywall',
    material_name: 'Enduit à joint prêt 7kg',
    material_category: 'partition',
    role: 'consommable',
    is_optional: false,
    display_order: 6,
  },
  {
    work_type_code: 'drywall',
    material_name: 'Plaque BA13 hydro 2.5x1.2m',
    material_category: 'partition',
    role: 'principal',
    is_optional: true,
    display_order: 7,
  },
  {
    work_type_code: 'drywall',
    material_name: 'Laine de verre 45mm',
    material_category: 'partition',
    role: 'consommable',
    is_optional: true,
    display_order: 8,
  },
  {
    work_type_code: 'drywall',
    material_name: 'Enduit à joint poudre 5kg',
    material_category: 'partition',
    role: 'consommable',
    is_optional: true,
    display_order: 9,
  },
  // --- wall_covering : papier peint intissé (E1-2 : ordres 1-2) ---
  {
    work_type_code: 'wall_covering',
    material_name: 'Brosse à maroufler',
    material_category: 'wall_covering',
    role: 'accessoire',
    is_optional: false,
    display_order: 3,
  },
  {
    work_type_code: 'wall_covering',
    material_name: 'Roulette de joint',
    material_category: 'wall_covering',
    role: 'accessoire',
    is_optional: false,
    display_order: 4,
  },
  {
    work_type_code: 'wall_covering',
    material_name: 'Cutter de précision',
    material_category: 'wall_covering',
    role: 'accessoire',
    is_optional: false,
    display_order: 5,
  },
  {
    work_type_code: 'wall_covering',
    material_name: 'Papier peint intissé à motif',
    material_category: 'wall_covering',
    role: 'principal',
    is_optional: true,
    display_order: 6,
  },
  {
    work_type_code: 'wall_covering',
    material_name: 'Papier peint vinyle sur intissé',
    material_category: 'wall_covering',
    role: 'principal',
    is_optional: true,
    display_order: 7,
  },
];

/** Curation complète — importée par la migration `…066` et par les tests. */
export const workTypeMaterialLinks: WorkTypeMaterialLink[] = [
  ...e12Links,
  ...workTypeMaterialLinksE13,
];
