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

/**
 * Une ligne de l'instantané validé. Volontairement pauvre : ce qui est prouvé,
 * c'est une quantité rattachée à un matériau et à un ouvrage, pas l'écran qui
 * l'affichait. Les libellés sont figés parce qu'un catalogue renommé ne doit
 * pas réécrire ce que l'artisan a lu.
 */
export interface ValidatedQuantityLine {
  material_id: string;
  material_name: string;
  work_type_code: string;
  work_type_label: string;
  packaging_label: string;
  units_needed: number;
}

/**
 * E2-4 — l'acte de validation des quantités, écrit une fois et jamais modifié.
 *
 * Écrit uniquement par `QuantityValidationsService.validate`, lu par
 * `QuotesService` avant toute émission. Il n'y a pas de `updated_at` : une
 * correction de quantité ne modifie pas la validation précédente, elle la
 * périme et en appelle une nouvelle. L'historique complet des validations d'un
 * chantier est donc conservé, et c'est voulu — savoir qu'une première
 * validation a été remplacée après correction fait partie de la preuve.
 */
@Entity('quantity_validations')
export class QuantityValidation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  project_id!: string;

  @Column({ type: 'uuid' })
  organization_id!: string;

  /**
   * `NULL` après suppression du compte. `user_email` reste : sans lui, la
   * suppression d'un compte effacerait l'identité que cette table existe pour
   * établir.
   */
  @Column({ type: 'uuid', nullable: true })
  user_id!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_email!: string | null;

  /** `sha256` hexadécimal de `quantities_json`, cf. `quantity-fingerprint.ts`. */
  @Column({ type: 'char', length: 64 })
  quantities_fingerprint!: string;

  @Column({ type: 'jsonb' })
  quantities_json!: ValidatedQuantityLine[];

  @Column({ type: 'int' })
  line_count!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  validated_at!: Date;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;
}
