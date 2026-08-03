import { WorkTypeMaterialRole } from './entities/work-type-material.entity';

/**
 * Liaison ouvrage → matériaux, seedée par la migration
 * `1711468800066-CreateWorkTypeMaterials` et rejouée telle quelle par les
 * tests (`estimation-engine.seeded-catalog.spec.ts`) : une seule source de
 * vérité, sur le modèle déjà posé par `seed-catalog.data.ts` pour E1-1.
 *
 * E1-2 ne lie que ce dont le moteur sait calculer la quantité aujourd'hui —
 * le matériau principal et la couche de préparation appliquée sur toute la
 * surface. Colle/joint/croisillons portent déjà une formule de complément
 * calculé (migrations `…009`/`…010`) : les lier ici en doublerait l'achat sur
 * la liste — l'arbitrage entre les deux mécanismes est confié à E1-6. La
 * curation complète des 7 jeux, avec relecture par un artisan, est E1-3.
 */
export interface WorkTypeMaterialLink {
  work_type_code: string;
  material_name: string;
  material_category: string;
  role: WorkTypeMaterialRole;
  is_optional: boolean;
  display_order: number;
}

export const workTypeMaterialLinks: WorkTypeMaterialLink[] = [
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
    is_optional: false,
    display_order: 1,
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
