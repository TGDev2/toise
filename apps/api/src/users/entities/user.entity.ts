import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum AuthProvider {
  EMAIL = 'email',
  GOOGLE = 'google',
  APPLE = 'apple',
  ANONYMOUS = 'anonymous',
}

export enum SubscriptionTier {
  FREE = 'free',
  PRO = 'pro',
  CONTRACTOR_ESSENTIEL = 'contractor_essentiel',
  CONTRACTOR_STANDARD = 'contractor_standard',
  CONTRACTOR_PREMIUM = 'contractor_premium',
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 20, default: AuthProvider.EMAIL })
  auth_provider!: AuthProvider;

  @Column({ type: 'varchar', length: 20, default: SubscriptionTier.FREE })
  subscription_tier!: SubscriptionTier;

  @Column({ type: 'varchar', length: 20, default: UserRole.USER })
  role!: UserRole;

  @Column({ type: 'boolean', default: false })
  email_verified!: boolean;

  @Index()
  @Column({ type: 'varchar', length: 128, unique: true })
  firebase_uid!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
