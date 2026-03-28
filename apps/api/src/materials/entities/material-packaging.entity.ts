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

@Entity('material_packaging')
export class MaterialPackaging {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  material_id!: string;

  @Column({ type: 'varchar', length: 255 })
  label!: string;

  @Column({ type: 'numeric', precision: 10, scale: 4 })
  quantity_per_unit!: number;

  @Column({ type: 'varchar', length: 20 })
  unit!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @ManyToOne(() => MaterialCatalog, (m) => m.packagings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'material_id' })
  material!: MaterialCatalog;
}
