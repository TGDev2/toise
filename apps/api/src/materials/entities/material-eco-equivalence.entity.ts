import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MaterialCatalog } from './material-catalog.entity';

@Entity('material_eco_equivalences')
export class MaterialEcoEquivalence {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  standard_material_id!: string;

  @Column({ type: 'uuid' })
  eco_material_id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => MaterialCatalog, (m) => m.eco_equivalents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'standard_material_id' })
  standardMaterial!: MaterialCatalog;

  @ManyToOne(() => MaterialCatalog, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eco_material_id' })
  ecoMaterial!: MaterialCatalog;
}
