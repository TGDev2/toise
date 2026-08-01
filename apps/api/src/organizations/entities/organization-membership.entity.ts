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
import { User } from '../../users/entities/user.entity';
import { Organization } from './organization.entity';

/**
 * Rôle *dans une organisation*, orthogonal à `users.role` (`user`/`admin`) qui
 * reste un rôle plateforme.
 */
export enum OrganizationRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

@Entity('organization_memberships')
export class OrganizationMembership {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  organization_id!: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'varchar', length: 20, default: OrganizationRole.MEMBER })
  role!: OrganizationRole;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
