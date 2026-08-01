import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';

/**
 * Clé d'accès à l'API publique (BACKLOG PLAT-5).
 *
 * La clé appartient à l'**organisation**, jamais à une personne
 * (`created_by_user_id` n'est qu'une trace d'auteur) : elle survit donc au
 * départ du salarié qui l'a créée, et elle porte elle-même la portée que
 * `OrgContextService` refuse par construction de lire depuis un en-tête client.
 *
 * Seul le SHA-256 du secret est stocké. `key_prefix` (« chf_a1b2c3d4 ») ne sert
 * qu'à identifier visuellement une clé dans une liste : il révèle 8 caractères
 * d'un secret qui en compte 64, ce qui laisse 224 bits d'entropie inentamés.
 */
@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  organization_id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  /** Fragment non secret affiché dans les listes, cf. doc-comment de la classe. */
  @Column({ type: 'varchar', length: 16 })
  key_prefix!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  key_hash!: string;

  /**
   * Empreinte de l'ancien secret pendant la fenêtre de grâce d'une rotation :
   * c'est ce qui permet à un intégrateur de redéployer sans coupure. Elle n'est
   * acceptée que tant que `previous_key_expires_at` est dans le futur, et elle
   * est effacée par une révocation.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  previous_key_hash!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  previous_key_expires_at!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  created_by_user_id!: string | null;

  /** Rafraîchi au plus une fois toutes les 5 minutes (cf. ApiKeysService). */
  @Column({ type: 'timestamptz', nullable: true })
  last_used_at!: Date | null;

  /**
   * Révocation logique plutôt que suppression : l'empreinte reste occupée, donc
   * irréutilisable, et l'organisation garde la trace de la clé qui a été
   * compromise.
   */
  @Column({ type: 'timestamptz', nullable: true })
  revoked_at!: Date | null;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
