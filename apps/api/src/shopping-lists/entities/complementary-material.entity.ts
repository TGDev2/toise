import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * Ce que la curation E1-3 exclut du chiffrage à la surface mais qu'il faut
 * quand même acheter : le linéaire et le petit outillage. Toujours un forfait —
 * dès qu'une quantité dépend de la géométrie, le produit relève du catalogue
 * (`materials_catalog` × `work_type_materials`), seul mécanisme qui porte
 * rendement, facteur de perte, conditionnement et appariement fournisseur.
 * C'est l'arbitrage d'E1-6, appliqué par la migration `…069`.
 */
@Entity('complementary_materials')
export class ComplementaryMaterial {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 30 })
  category!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  description_fr!: string;

  @Column({ type: 'integer', default: 1 })
  default_quantity!: number;

  @Column({ type: 'varchar', length: 50 })
  unit_label!: string;

  @Column({ type: 'integer', default: 0 })
  display_order!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
