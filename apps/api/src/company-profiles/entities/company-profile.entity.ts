import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('company_profiles')
export class CompanyProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'varchar', length: 255 })
  raison_sociale!: string;

  @Column({ type: 'varchar', length: 14, unique: true })
  siret!: string;

  @Column({ type: 'varchar', length: 255 })
  address_line1!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address_line2!: string | null;

  @Column({ type: 'varchar', length: 10 })
  postal_code!: string;

  @Column({ type: 'varchar', length: 100 })
  city!: string;

  @Column({ type: 'varchar', length: 2, default: 'FR' })
  country!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  specialties!: string[];

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
