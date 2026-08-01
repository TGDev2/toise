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
import { OrganizationRole } from '../../organizations/entities/organization-membership.entity';

export enum SsoProtocol {
  SAML = 'saml',
  OIDC = 'oidc',
}

export enum SsoConnectionStatus {
  /** Ligne écrite, fournisseur GCIP pas encore créé (PLAT-6 D12). */
  PENDING = 'pending',
  ACTIVE = 'active',
  /** La création chez GCIP a échoué ; le motif est dans `provisioning_error`. */
  FAILED = 'failed',
}

/**
 * Fédération d'identité d'une organisation (BACKLOG PLAT-6).
 *
 * `provider_id` est **l'ancre de confiance** de tout le dispositif : c'est nous
 * qui l'émettons au moment de créer le fournisseur chez GCIP, donc un jeton dont
 * `firebase.sign_in_provider` vaut cette valeur prouve que l'assertion vient de
 * l'IdP de cette organisation-là. Le rattachement est `provider_id →
 * organization_id`, jamais « domaine de l'e-mail affirmé → organisation » : un
 * IdP ne parle que pour lui-même, sans quoi celui d'un client pourrait affirmer
 * `ceo@concurrent.fr` et entrer chez un autre client (PLAT-6 D3).
 *
 * **Aucun secret d'IdP n'est stocké ici.** Certificats X.509, `client_secret`
 * OIDC et URL de SSO sont transmis à GCIP puis oubliés : une fuite de cette base
 * ne livre aucun credential fédéré (PLAT-6 D5).
 */
@Entity('sso_connections')
export class SsoConnection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Une connexion par organisation : le rattachement reste sans ambiguïté. */
  @Column({ type: 'uuid', unique: true })
  organization_id!: string;

  /** « saml.acme-1a2b » / « oidc.acme-1a2b » — cf. doc-comment de la classe. */
  @Column({ type: 'varchar', length: 64, unique: true })
  provider_id!: string;

  @Column({ type: 'varchar', length: 10 })
  protocol!: SsoProtocol;

  @Column({ type: 'varchar', length: 100 })
  display_name!: string;

  @Column({ type: 'varchar', length: 20, default: SsoConnectionStatus.PENDING })
  status!: SsoConnectionStatus;

  /**
   * Impose à tout membre de passer par l'IdP. Le **propriétaire** en est exempté
   * (bris de glace) : un certificat expiré rendrait sinon une organisation à
   * 10 k€/an inaccessible sans intervention du support (PLAT-6 D9).
   */
  @Column({ type: 'boolean', default: false })
  enforced!: boolean;

  /** Rôle donné à l'adhésion créée au vol. Jamais `owner`. */
  @Column({ type: 'varchar', length: 20, default: OrganizationRole.MEMBER })
  default_role!: OrganizationRole;

  @Column({ type: 'varchar', length: 500, nullable: true })
  provisioning_error!: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by_user_id!: string | null;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
