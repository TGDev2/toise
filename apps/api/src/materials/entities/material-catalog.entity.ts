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

  @Column({ type: 'numeric', precision: 10, scale: 4 })
  yield_per_unit!: number;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

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

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'modified_by' })
  modifier!: User | null;
}
