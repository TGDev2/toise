import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CommunityProject } from './community-project.entity';

@Entity('community_likes')
@Unique(['community_project_id', 'user_id'])
export class CommunityLike {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  community_project_id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => CommunityProject, (cp) => cp.likes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'community_project_id' })
  communityProject!: CommunityProject;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
