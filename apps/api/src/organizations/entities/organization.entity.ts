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

/**
 * Frontière de tenancy (BACKLOG PLAT-4). Tout utilisateur en possède exactement
 * une marquée `is_personal` — c'est ce qui rend « mon espace » ≡ « moi » pour un
 * solo, et donc la bascule de propriété invisible pour lui.
 *
 * L'organisation ne porte pas de palier d'abonnement : le palier effectif est
 * celui de son propriétaire (cf. OrgContextService). L'abonnement Stripe reste
 * attaché à l'utilisateur tant que PLAT-6 n'a pas déplacé la facturation.
 */
@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Index()
  @Column({ type: 'uuid' })
  owner_user_id!: string;

  /**
   * Espace personnel, créé d'office pour chaque compte. Un index unique partiel
   * (`WHERE is_personal`) garantit l'unicité par propriétaire : le repli de
   * résolution du contexte est donc toujours défini et non ambigu.
   */
  @Column({ type: 'boolean', default: true })
  is_personal!: boolean;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_user_id' })
  owner!: User;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
