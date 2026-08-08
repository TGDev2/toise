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

  /**
   * Défaut aligné sur celui de la colonne (migration 1711468800099) : une gate
   * insérée sans palier explicite est fermée, et le seul palier payant est
   * `contractor_essentiel`. Il valait `pro`, retiré de l'offre en E3-1.
   */
  @Column({ type: 'varchar', length: 20, default: 'contractor_essentiel' })
  min_tier!: string;

  @Column({ type: 'boolean', default: true })
  is_enabled!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
