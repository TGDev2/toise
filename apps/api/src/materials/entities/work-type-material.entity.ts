import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MaterialCatalog } from './material-catalog.entity';

/**
 * `principal` : le matériau que l'utilisateur choisit, un seul par ouvrage.
 * `sous_couche` : consommé sur toute la surface, avant le matériau principal.
 * `consommable` : consommé systématiquement mais pas proportionnel à `yield_per_unit`
 * de la même façon (ex. colle) — distingué de `sous_couche` pour E1-3.
 * `accessoire` : petit matériel racheté par chantier, quantité indépendante de
 * la surface (seedé par E1-3 ; quantités justes à partir d'E1-4). Exclu de la
 * fourchette de référence de `checkQuotePublic`.
 */
export type WorkTypeMaterialRole =
  | 'principal'
  | 'sous_couche'
  | 'consommable'
  | 'accessoire';

@Entity('work_type_materials')
export class WorkTypeMaterial {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  work_type_id!: string;

  @Column({ type: 'uuid' })
  material_id!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: WorkTypeMaterialRole;

  /**
   * Alternative documentée mais jamais chiffrée automatiquement — seedé
   * `false` par E1-2 ; E1-3 s'en sert pour rattacher des variantes sans
   * regonfler `loadMaterialInputs`.
   */
  @Column({ type: 'boolean', default: false })
  is_optional!: boolean;

  @Column({ type: 'integer', default: 0 })
  display_order!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => MaterialCatalog, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'material_id' })
  material!: MaterialCatalog;
}
