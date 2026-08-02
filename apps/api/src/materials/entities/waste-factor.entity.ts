import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MaterialCatalog } from './material-catalog.entity';
import { numericTransformer } from '../../common/transformers/numeric.transformer';

@Entity('waste_factors')
export class WasteFactor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  material_id!: string;

  @Column({ type: 'varchar', length: 50 })
  pose_type!: string;

  @Column({ type: 'varchar', length: 20 })
  skill_level!: string;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    transformer: numericTransformer,
  })
  factor_percent!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @ManyToOne(() => MaterialCatalog, (m) => m.waste_factors, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'material_id' })
  material!: MaterialCatalog;
}
