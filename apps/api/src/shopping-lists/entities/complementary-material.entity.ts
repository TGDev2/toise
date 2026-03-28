import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

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
