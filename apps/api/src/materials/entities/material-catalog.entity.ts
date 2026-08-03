import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MaterialPackaging } from './material-packaging.entity';
import { WasteFactor } from './waste-factor.entity';
import { MaterialEcoEquivalence } from './material-eco-equivalence.entity';
import { numericTransformer } from '../../common/transformers/numeric.transformer';

export enum MaterialCategory {
  PAINTING = 'painting',
  TILING = 'tiling',
  FLOORING = 'flooring',
  PARTITION = 'partition',
  WALL_COVERING = 'wall_covering',
}

@Entity('materials_catalog')
export class MaterialCatalog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 30 })
  category!: MaterialCategory;

  @Column({ type: 'varchar', length: 20 })
  unit!: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 4,
    transformer: numericTransformer,
  })
  yield_per_unit!: number;

  /**
   * E1-4 — la quantité de ce matériau est proportionnelle au nombre de couches
   * saisi (`custom_params.number_of_coats`). Vrai des seuls revêtements
   * appliqués en couches successives sur la surface : peintures, lasures,
   * vernis. Faux pour tout le reste — accessoires, consommables, enduits, et
   * les sous-couches, qui s'appliquent en une passe quel que soit le nombre de
   * couches de finition.
   *
   * Remplace la déduction `category === 'painting'` du moteur, qui commandait
   * un pinceau autant de fois qu'il y avait de mètres carrés et de couches.
   */
  @Column({ type: 'boolean', default: false })
  applies_coats!: boolean;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ type: 'boolean', default: false })
  is_eco!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  eco_label_fr!: string | null;

  @Column({ type: 'uuid', nullable: true })
  modified_by!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  modified_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @OneToMany(() => MaterialPackaging, (p) => p.material, { cascade: true })
  packagings!: MaterialPackaging[];

  @OneToMany(() => WasteFactor, (w) => w.material, { cascade: true })
  waste_factors!: WasteFactor[];

  @OneToMany(() => MaterialEcoEquivalence, (e) => e.standardMaterial)
  eco_equivalents!: MaterialEcoEquivalence[];

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'modified_by' })
  modifier!: User | null;
}
