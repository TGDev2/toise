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
import { SsoConnection } from './sso-connection.entity';

/**
 * Domaine e-mail rattaché à une connexion SSO (BACKLOG PLAT-6).
 *
 * Il ne sert **qu'à la découverte** — « quel IdP pour cette adresse ? ». Le
 * rattachement d'une session à une organisation ne dépend jamais du domaine mais
 * du `provider_id` (PLAT-6 D3), si bien qu'un domaine non vérifié n'ouvre aucun
 * accès. La vérification DNS reste néanmoins obligatoire : un domaine usurpé
 * enverrait les salariés d'un tiers vers l'IdP de l'usurpateur, c'est-à-dire du
 * hameçonnage (PLAT-6 D4).
 *
 * L'unicité globale est portée par un index **partiel**
 * (`WHERE verified_at IS NOT NULL`) : deux organisations peuvent tenter de
 * prouver le même domaine, une seule y parvient, et personne ne peut bloquer un
 * concurrent en squattant une ligne non vérifiée.
 */
@Entity('sso_domains')
export class SsoDomain {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  sso_connection_id!: string;

  /** Normalisé en minuscules à l'écriture (cf. SsoConnectionsService). */
  @Column({ type: 'varchar', length: 255 })
  domain!: string;

  /** Valeur attendue dans l'enregistrement TXT `chiffreo-verification=…`. */
  @Column({ type: 'varchar', length: 64 })
  verification_token!: string;

  @Column({ type: 'timestamptz', nullable: true })
  verified_at!: Date | null;

  @ManyToOne(() => SsoConnection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sso_connection_id' })
  connection!: SsoConnection;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
