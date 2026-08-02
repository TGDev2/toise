import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';

/**
 * Configuration du widget marque blanche (BACKLOG PLAT-7).
 *
 * `widget_key` n'est **pas** un secret, contrairement au `chf_` de PLAT-5 : il
 * est destiné à être collé tel quel dans le HTML statique d'un site tiers, donc
 * visible de quiconque ouvre les outils de développement de son navigateur.
 * L'autorisation ne repose donc pas sur le secret de la clé mais sur
 * `allowed_origins`, une liste blanche d'origines gérée par l'organisation :
 * seule une page servie depuis une de ces origines peut faire aboutir un appel
 * (cf. `WidgetOriginGuard`). Une organisation n'a qu'une configuration : le
 * widget est un canal, pas une collection de credentials comme les clés d'API.
 */
@Entity('widget_configs')
export class WidgetConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  organization_id!: string;

  @Column({ type: 'varchar', length: 40, unique: true })
  widget_key!: string;

  /** Origines exactes (`scheme://host[:port]`, sans chemin ni slash final). */
  @Column({ type: 'text', array: true, default: '{}' })
  allowed_origins!: string[];

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  /** Libellé affiché dans le widget — rendu en texte brut côté client, jamais en HTML. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  display_name!: string | null;

  @Column({ type: 'varchar', length: 7, nullable: true })
  accent_color!: string | null;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
