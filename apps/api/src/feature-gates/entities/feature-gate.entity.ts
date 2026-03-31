import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('feature_gates')
export class FeatureGate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  feature_key!: string;

  @Column({ type: 'varchar', length: 100 })
  label_fr!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description_fr!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pro' })
  min_tier!: string;

  @Column({ type: 'boolean', default: true })
  is_enabled!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
