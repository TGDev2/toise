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

/**
 * E1-3 — la trame d'un ouvrage à ossature, déclarée par l'ouvrage lui-même.
 *
 * Tout ce que le moteur sait de la plâtrerie tient ici : il ne connaît ni
 * entraxe de 0,60 m, ni « deux lisses », ni le code `drywall`. Un ouvrage sans
 * ossature laisse ce champ à `NULL` et aucun de ses matériaux ne peut porter un
 * `quantity_driver` de trame.
 */
export interface FrameSpec {
  /** Entraxe des montants, en mètres. `ceil(longueur / entraxe) + 1` montants. */
  stud_spacing_m: number;
  /**
   * Montants supplémentaires déclarés par l'ouvrage : rives et huisseries. Ils
   * s'ajoutent au calcul d'entraxe, qui ne compte que la trame courante.
   */
  extra_studs: number;
  /** Lisses par mètre linéaire d'ouvrage : 2 pour une lisse haute et basse. */
  runner_courses: number;
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

  /**
   * E1-2 — `room_surface` : quantité dérivée de `surface_target` et de la
   * géométrie de la pièce (comportement inchangé). `declared` : quantité
   * saisie par l'utilisateur sur l'ouvrage (`project_work_items.declared_*`).
   * Orthogonal à `surface_target`, pas encore lu par le moteur (E1-3).
   */
  @Column({ type: 'varchar', length: 20, default: 'room_surface' })
  quantity_basis!: string;

  @Column({
    type: 'numeric',
    precision: 4,
    scale: 2,
    default: 1.1,
    transformer: numericTransformer,
  })
  waste_factor_base!: number;

  @Column({ type: 'jsonb', default: [] })
  contextual_questions!: ContextualQuestion[];

  /**
   * E1-3 — trame de l'ouvrage, `NULL` pour un ouvrage sans ossature (les six
   * ouvrages de recouvrement). Lue par le moteur pour métrer rails et montants
   * sur le linéaire et la hauteur réels, jamais sur une surface.
   */
  @Column({ type: 'jsonb', nullable: true })
  frame_spec!: FrameSpec | null;

  @Column({ type: 'integer', default: 0 })
  display_order!: number;

  /**
   * Temps unitaire indicatif (E2-3), min/m², artisan seul. Ordre de grandeur
   * métier — pas un rendement fabricant sourcé au sens de
   * `docs/SOURCES_CATALOGUE.md` : voir la section dédiée de ce registre.
   * Nullable : un 8e ouvrage sans valeur ne propose aucune ligne, il n'invente
   * pas un temps.
   */
  @Column({
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  labor_minutes_per_m2!: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
