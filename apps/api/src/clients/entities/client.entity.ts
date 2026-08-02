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

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Auteur de la fiche. La propriété est portée par `organization_id` (PLAT-4) :
   * `null` quand l'auteur a supprimé son compte, la fiche restant acquise à
   * l'organisation.
   */
  @Column({ type: 'uuid', nullable: true })
  user_id!: string | null;

  @Index()
  @Column({ type: 'uuid' })
  organization_id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address_line1!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address_line2!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  postal_code!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city!: string | null;

  /** Client professionnel : déclenche le SIREN acheteur obligatoire sur facture (réforme 2026). */
  @Column({ type: 'boolean', default: false })
  is_company!: boolean;

  @Column({ type: 'varchar', length: 14, nullable: true })
  siret!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  vat_number!: string | null;

  /** EN 16931 BT-55. */
  @Column({ type: 'varchar', length: 2, default: 'FR' })
  country!: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
