import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Room } from './room.entity';

export enum ConfidenceScore {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum DimensionSource {
  MANUAL = 'manual',
  SCAN = 'scan',
  IMPORT = 'import',
  CV = 'cv',
}

/**
 * Rectangle composant une pièce non rectangulaire (L, T, U…), vue de dessus.
 * Miroir de `RectSegment` du moteur d'estimation, gardé local à ce module pour
 * ne pas coupler l'entité au module estimations.
 */
export interface RoomSegment {
  x_cm: number;
  y_cm: number;
  length_cm: number;
  width_cm: number;
}

export enum ExclusionType {
  CREDENCE = 'credence',
  HALF_WALL = 'half_wall',
  BASEBOARD = 'baseboard',
  OTHER = 'other',
}

/**
 * Zone non traitée à déduire d'une surface (ENG-3) : crédence, demi-mur,
 * plinthes… Déduction manuelle simple (une aire), pas une géométrie comme
 * `RoomSegment` — l'utilisateur déclare directement les m² à exclure.
 */
export interface SurfaceExclusion {
  surface_target: 'wall' | 'floor' | 'ceiling';
  type: ExclusionType;
  label?: string;
  area_m2: number;
}

@Entity('room_dimensions')
export class RoomDimensions {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  room_id!: string;

  @Column({ type: 'int' })
  length_cm!: number;

  @Column({ type: 'int' })
  width_cm!: number;

  @Column({ type: 'int' })
  height_cm!: number;

  @Column({ type: 'varchar', length: 10, default: ConfidenceScore.HIGH })
  confidence_score!: ConfidenceScore;

  @Column({ type: 'varchar', length: 10, default: DimensionSource.MANUAL })
  source!: DimensionSource;

  @Column({ type: 'jsonb', nullable: true, default: null })
  raw_cv_output_json!: Record<string, unknown> | null;

  /**
   * Incertitude de mesure (cm) par champ, source = écart médian empirique
   * `cv-accuracy` (CV-2) si assez d'échantillons, sinon bande heuristique par
   * `confidence_score` (CV-5). `null` pour toute dimension `source !== 'cv'`
   * (aucun modèle d'erreur pour la saisie manuelle).
   */
  @Column({ type: 'int', nullable: true, default: null })
  length_cm_uncertainty!: number | null;

  @Column({ type: 'int', nullable: true, default: null })
  width_cm_uncertainty!: number | null;

  @Column({ type: 'int', nullable: true, default: null })
  height_cm_uncertainty!: number | null;

  /**
   * Décomposition en rectangles d'une pièce non rectangulaire (ENG-1).
   * `null` → pièce rectangulaire simple `length_cm × width_cm`.
   */
  @Column({ type: 'jsonb', nullable: true, default: null })
  segments_json!: RoomSegment[] | null;

  /** Zones à exclure des surfaces calculées (ENG-3). `null` → aucune. */
  @Column({ type: 'jsonb', nullable: true, default: null })
  exclusions_json!: SurfaceExclusion[] | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @OneToOne(() => Room, (r) => r.dimensions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room!: Room;
}
