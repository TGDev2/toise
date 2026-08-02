import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import type { SurfaceBand } from '../cost-benchmark';
import { numericTransformer } from '../../common/transformers/numeric.transformer';

/**
 * BACKLOG DATA-4 : une cellule publiable du benchmark de coûts.
 *
 * La table ne contient **que** des cellules qui satisfont le k-anonymat : une
 * cohorte trop petite n'y est pas écrite avec une médiane masquée, elle n'y est
 * pas écrite du tout. `median_cost_per_m2` est donc `NOT NULL`, et une
 * contrainte `CHECK` verrouille les seuils côté base (cf. migration `…059`).
 */
@Entity('cost_benchmarks')
@Index(['work_type_code', 'surface_band'], { unique: true })
export class CostBenchmark {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  work_type_code!: string;

  @Column({ type: 'varchar', length: 20 })
  surface_band!: SurfaceBand;

  /** Médiane du coût matériaux au m². Lue en `string` (numeric) → coercer. */
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  median_cost_per_m2!: number;

  /** Observations retenues, après plafonnement par organisation. */
  @Column({ type: 'integer' })
  sample_size!: number;

  @Column({ type: 'integer' })
  organization_count!: number;

  @Column({ type: 'timestamptz' })
  computed_at!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
