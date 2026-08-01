import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from './organization.entity';
import { OrganizationRole } from './organization-membership.entity';

/**
 * Invitation à rejoindre une organisation. Seul le SHA-256 du jeton est stocké :
 * une fuite de la base ne donne aucune invitation utilisable, le secret ne vit
 * que dans le lien envoyé par e-mail.
 */
@Entity('organization_invitations')
export class OrganizationInvitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  organization_id!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 20, default: OrganizationRole.MEMBER })
  role!: OrganizationRole;

  @Column({ type: 'varchar', length: 64, unique: true })
  token_hash!: string;

  @Column({ type: 'uuid', nullable: true })
  invited_by_user_id!: string | null;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  accepted_at!: Date | null;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
