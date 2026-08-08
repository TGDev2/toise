import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WorkType } from './work-type.entity';
import { numericTransformer } from '../../common/transformers/numeric.transformer';

/**
 * E2-1 — un temps de pose unitaire sourcé, par ouvrage, pose et niveau.
 *
 * Ce que `work_types.labor_minutes_per_m2` (E2-3, migration `…072`) n'est
 * pas : ici chaque ligne porte sa source complète — organisme, document, URL,
 * date — parce qu'un temps sans source a exactement le statut que la section
 * « Temps unitaires de main-d'œuvre » de `docs/SOURCES_CATALOGUE.md`
 * dénonçait : un ordre de grandeur qu'on ne peut ni défendre ni corriger.
 *
 * `skill_level` NULL signifie « tous niveaux » : les sources libres publient
 * des temps de professionnel, rarement une déclinaison par niveau. Une ligne
 * par niveau n'existe que si une source la différencie réellement — pas de
 * grille fabriquée (registre : `projects/labor-times.data.ts`).
 *
 * Personne ne lit cette table avant E2-2 (même séquence que
 * `consumption-bounds` : le registre d'abord, le consommateur ensuite).
 * L'entité existe dès maintenant pour que le contrôle de dérive
 * entité ↔ schéma (`schema.int-spec.ts`) couvre le DDL de la migration
 * `…097`, et non enregistrée dans un module puisque rien ne l'injecte.
 */
@Entity('labor_times')
export class LaborTime {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  work_type_id!: string;

  /** Une pose de `POSES_BY_WORK_TYPE[code]` — jamais un repli inventé. */
  @Column({ type: 'varchar', length: 50 })
  pose_type!: string;

  /** `beginner` | `intermediate` | `expert` — NULL = tous niveaux. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  skill_level!: string | null;

  /** Unité de rattachement du temps : `m2` | `ml` | `piece`. */
  @Column({ type: 'varchar', length: 10, default: 'm2' })
  unit_basis!: string;

  /** Valeur retenue, en heures par unité. */
  @Column({
    type: 'numeric',
    precision: 6,
    scale: 3,
    transformer: numericTransformer,
  })
  hours_per_unit!: number;

  /**
   * Fourchette basse/haute quand les sources divergent — l'étalement des
   * chiffres publiés, jamais la valeur retenue ± une tolérance (doctrine des
   * bornes de consommation). Les deux ensemble ou aucune.
   */
  @Column({
    type: 'numeric',
    precision: 6,
    scale: 3,
    nullable: true,
    transformer: numericTransformer,
  })
  hours_low!: number | null;

  @Column({
    type: 'numeric',
    precision: 6,
    scale: 3,
    nullable: true,
    transformer: numericTransformer,
  })
  hours_high!: number | null;

  /** Conditions supposées : hauteur accessible, support sain, pièce vide… */
  @Column({ type: 'text' })
  conditions_fr!: string;

  /** Organisme ou éditeur librement consultable (jamais un bordereau commercial). */
  @Column({ type: 'varchar', length: 120 })
  source_org!: string;

  @Column({ type: 'varchar', length: 255 })
  source_document!: string;

  @Column({ type: 'varchar', length: 500 })
  source_url!: string;

  @Column({ type: 'date' })
  source_consulted_on!: string;

  /** Le chiffre d'origine et sa conversion, sans marque. */
  @Column({ type: 'text' })
  source_basis_fr!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @ManyToOne(() => WorkType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_type_id' })
  work_type!: WorkType;
}
