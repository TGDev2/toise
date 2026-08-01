import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Project } from '../../projects/entities/project.entity';
import { CommunityLike } from './community-like.entity';
import { CommunityComment } from './community-comment.entity';
import type {
  ShoppingListMaterialItem,
  ShoppingListComplementaryItem,
  BudgetSummary,
} from '../../shopping-lists/entities/shopping-list.entity';

export enum ModerationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface PurchaseListSnapshot {
  material_items: ShoppingListMaterialItem[];
  complementary_items: ShoppingListComplementaryItem[];
}

@Entity('community_projects')
export class CommunityProject {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  project_id!: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  work_type!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb', nullable: true, default: null })
  purchase_list_json!: PurchaseListSnapshot | null;

  @Column({ type: 'jsonb', nullable: true, default: null })
  budget_summary_json!: BudgetSummary | null;

  @Column({ type: 'integer' })
  total_cost_cents!: number;

  @Column({ type: 'integer' })
  duration_days!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  length_cm!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  width_cm!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  height_cm!: number | null;

  @Column({ type: 'uuid', array: true, default: '{}' })
  before_photo_ids!: string[];

  @Column({ type: 'uuid', array: true, default: '{}' })
  after_photo_ids!: string[];

  @Index()
  @Column({ type: 'varchar', length: 20, default: ModerationStatus.PENDING })
  moderation_status!: ModerationStatus;

  @Column({ type: 'text', nullable: true })
  rejection_reason!: string | null;

  @Column({ type: 'boolean', default: false })
  gdpr_consent!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  gdpr_consent_at!: Date | null;

  @Column({ type: 'integer', default: 0 })
  likes_count!: number;

  @Column({ type: 'timestamptz', nullable: true })
  published_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @OneToMany(() => CommunityLike, (like) => like.communityProject)
  likes!: CommunityLike[];

  @OneToMany(() => CommunityComment, (comment) => comment.communityProject)
  comments!: CommunityComment[];
}
