import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { numericTransformer } from '../../common/transformers/numeric.transformer';

/**
 * D'où vient le geste. Sert à distinguer une correction faite en chiffrant les
 * courses d'une correction faite face au devis, la seconde ayant plus de poids
 * probatoire — elle précède immédiatement l'engagement.
 */
export enum QuantityCorrectionSource {
  SHOPPING_LIST = 'shopping_list',
  QUOTE_VALIDATION = 'quote_validation',
}

/**
 * E2-4 — une correction manuelle d'une quantité, conservée avec l'ancienne
 * valeur, la nouvelle et l'horodatage.
 *
 * **C'est aussi une observation de terrain**, et c'est à ce titre qu'elle est
 * structurée plutôt que journalisée : E8-2 (`BACKLOG_V1.md:1492`) agrège ces
 * écarts par matériau et par ouvrage pour dire ce qu'il faut corriger dans le
 * registre. D'où les libellés figés — un agrégat qui joindrait le catalogue
 * courant ferait mentir l'historique le jour où un ratio change — et d'où
 * `relative_deviation`, calculé une fois à l'écriture plutôt que recalculé par
 * chaque lecteur.
 *
 * Ce que cette table ne porte pas, volontairement : la **raison** de l'écart.
 * C'est un geste que personne n'a encore demandé à l'artisan ; E8-2 l'ajoutera
 * à la clôture, où la question a un sens. Écrire ici une colonne toujours nulle
 * en aurait fait une donnée qu'on croirait collectée (leçon 18).
 */
@Entity('quantity_corrections')
export class QuantityCorrection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  project_id!: string;

  /**
   * Trace d'auteur, `NULL` après suppression du compte. La portée de lecture
   * passe par `project_id` (cf. `QuantityValidation.user_id`).
   */
  @Column({ type: 'uuid', nullable: true })
  user_id!: string | null;

  @Column({ type: 'uuid' })
  material_id!: string;

  @Column({ type: 'varchar', length: 255 })
  material_name!: string;

  @Column({ type: 'varchar', length: 50 })
  material_unit!: string;

  @Column({ type: 'varchar', length: 255 })
  packaging_label!: string;

  @Column({ type: 'varchar', length: 50 })
  work_type_code!: string;

  @Column({ type: 'varchar', length: 255 })
  work_type_label!: string;

  /** Niveau déclaré sur l'ouvrage, `NULL` quand la ligne mutualise plusieurs pièces. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  skill_level!: string | null;

  /**
   * Ce que le catalogue a calculé (`original_units_needed`). Référence stable
   * de l'écart : une deuxième correction sur la même ligne repart d'elle, pas
   * de la valeur corrigée entre-temps.
   */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 3,
    transformer: numericTransformer,
  })
  computed_units!: number;

  /** Ce qu'affichait l'écran juste avant le geste. */
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 3,
    transformer: numericTransformer,
  })
  previous_units!: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 3,
    transformer: numericTransformer,
  })
  corrected_units!: number;

  /**
   * `(corrected - computed) / computed`. `NULL` quand `computed_units` vaut 0 —
   * un écart relatif à rien n'existe pas, et un `0` y ferait croire à un accord
   * parfait (leçon 18).
   */
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 4,
    nullable: true,
    transformer: numericTransformer,
  })
  relative_deviation!: number | null;

  @Column({ type: 'varchar', length: 32 })
  source!: QuantityCorrectionSource;

  @CreateDateColumn({ type: 'timestamptz' })
  corrected_at!: Date;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;
}
