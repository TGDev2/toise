import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from '../../common/transformers/numeric.transformer';

export interface ContextualQuestionOption {
  value: string;
  label_fr: string;
}

export interface ContextualQuestion {
  key: string;
  type: 'select' | 'number';
  label_fr: string;
  options?: ContextualQuestionOption[];
  required: boolean;
}

@Entity('work_types')
export class WorkType {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 100 })
  label_fr!: string;

  @Column({ type: 'varchar', length: 30 })
  category!: string;

  @Column({ type: 'varchar', length: 20 })
  surface_target!: string;

  @Column({
    type: 'numeric',
    precision: 4,
    scale: 2,
    default: 1.1,
    transformer: numericTransformer,
  })
  waste_factor_base!: number;

  @Column({ type: 'jsonb', default: [] })
  required_materials!: unknown[];

  @Column({ type: 'jsonb', default: [] })
  contextual_questions!: ContextualQuestion[];

  @Column({ type: 'integer', default: 0 })
  display_order!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
