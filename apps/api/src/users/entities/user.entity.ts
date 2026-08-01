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

  /** Code de parrainage propre à cet utilisateur, généré paresseusement (cf. ReferralsService). */
  @Column({ type: 'varchar', length: 10, unique: true, nullable: true })
  referral_code!: string | null;

  /** Parrain, posé une seule fois à l'inscription (cf. POST /referrals/redeem). */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  referred_by_user_id!: string | null;

  /** Posé une seule fois, au premier paiement réel du filleul (cf. ReferralsService.handleReferredUserConverted). */
  @Column({ type: 'timestamptz', nullable: true })
  referral_converted_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
