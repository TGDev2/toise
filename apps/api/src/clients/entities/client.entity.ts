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
   * Propriétaire de la fiche. Redevenu l'axe de propriété avec la suppression
   * des organisations (E4-1) : auteur et propriétaire sont de nouveau la même
   * personne, et la colonne n'est plus nullable.
   */
  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

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

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
