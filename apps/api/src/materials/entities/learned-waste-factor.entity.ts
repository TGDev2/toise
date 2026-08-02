import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { MaterialCatalog } from './material-catalog.entity';

/**
 * BACKLOG DATA-3 : facteur de perte appris sur les achats réels, superposé au
 * catalogue au chargement (`overlayLearnedWasteFactors`).
 *
 * Table **distincte** de `waste_factors` à dessein : l'étalonnage DTU d'ENG-5
 * reste la référence auditable et n'est jamais réécrit par un calcul
 * automatique. On peut donc comparer à tout moment l'appris et la norme, et
 * revenir au catalogue seul en vidant cette table.
 */
@Entity('learned_waste_factors')
@Unique('UQ_learned_waste_factors_cell', [
  'material_id',
  'pose_type',
  'skill_level',
])
export class LearnedWasteFactor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  material_id!: string;

  @Column({ type: 'varchar', length: 50 })
  pose_type!: string;

  @Column({ type: 'varchar', length: 20 })
  skill_level!: string;

  /** Valeur retenue, après crédibilité et bornes — celle que le moteur applique. */
  @Column({ type: 'numeric', precision: 5, scale: 2 })
  factor_percent!: number;

  /** Valeur catalogue de référence au moment du calcul (audit). */
  @Column({ type: 'numeric', precision: 5, scale: 2 })
  baseline_percent!: number;

  /** Médiane brute des pertes impliquées, avant crédibilité et bornes (audit). */
  @Column({ type: 'numeric', precision: 6, scale: 2 })
  observed_percent!: number;

  /** Observations retenues, après plafonnement par organisation. */
  @Column({ type: 'integer' })
  sample_size!: number;

  @Column({ type: 'timestamptz' })
  computed_at!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => MaterialCatalog, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'material_id' })
  material!: MaterialCatalog;
}
