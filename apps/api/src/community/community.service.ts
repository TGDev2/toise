import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import {
  CommunityProject,
  ModerationStatus,
} from './entities/community-project.entity';
import { CommunityLike } from './entities/community-like.entity';
import { CommunityComment } from './entities/community-comment.entity';
import { Project, ProjectStatus } from '../projects/entities/project.entity';
import { ProjectPhoto } from '../photos/entities/project-photo.entity';
import { CreateCommunityProjectDto } from './dto/create-community-project.dto';
import { ListCommunityQueryDto } from './dto/list-community-query.dto';
import {
  ModerateCommunityProjectDto,
  ModerationAction,
} from './dto/moderate-community-project.dto';
import { CreateCommunityCommentDto } from './dto/create-community-comment.dto';

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(CommunityProject)
    private readonly communityRepo: Repository<CommunityProject>,
    @InjectRepository(CommunityLike)
    private readonly likeRepo: Repository<CommunityLike>,
    @InjectRepository(CommunityComment)
    private readonly commentRepo: Repository<CommunityComment>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(ProjectPhoto)
    private readonly photoRepo: Repository<ProjectPhoto>,
    private readonly dataSource: DataSource,
  ) {}

  async submitProject(
    userId: string,
    dto: CreateCommunityProjectDto,
  ): Promise<CommunityProject> {
    if (!dto.gdpr_consent) {
      throw new BadRequestException(
        'Le consentement RGPD est requis pour partager dans la communaute',
      );
    }

    const project = await this.projectRepo.findOne({
      where: { id: dto.project_id },
      relations: ['dimensions'],
    });
    if (!project) {
      throw new NotFoundException('Projet non trouve');
    }
    if (project.user_id !== userId) {
      throw new ForbiddenException('Acces interdit');
    }
    if (project.status !== ProjectStatus.COMPLETED) {
      throw new BadRequestException(
        'Seul un projet termine peut etre partage dans la communaute',
      );
    }

    const existing = await this.communityRepo.findOne({
      where: { project_id: dto.project_id },
      withDeleted: true,
    });
    if (existing) {
      throw new BadRequestException(
        'Ce projet a deja ete soumis a la communaute',
      );
    }

    // Validate photo IDs belong to this project
    const allPhotoIds = [...dto.before_photo_ids, ...dto.after_photo_ids];
    if (allPhotoIds.length > 0) {
      const photos = await this.photoRepo
        .createQueryBuilder('p')
        .where('p.id IN (:...ids)', { ids: allPhotoIds })
        .andWhere('p.project_id = :projectId', { projectId: dto.project_id })
        .getMany();
      if (photos.length !== allPhotoIds.length) {
        throw new BadRequestException(
          'Certaines photos ne correspondent pas a ce projet',
        );
      }
    }

    const dimensions = project.dimensions;

    const entry = this.communityRepo.create({
      project_id: dto.project_id,
      user_id: userId,
      work_type: project.work_type ?? '',
      title: dto.title,
      description: dto.description ?? null,
      materials_list: dto.materials_list,
      total_cost_cents: dto.total_cost_cents,
      duration_days: dto.duration_days,
      length_cm: dimensions?.length_cm ?? 0,
      width_cm: dimensions?.width_cm ?? 0,
      height_cm: dimensions?.height_cm ?? null,
      before_photo_ids: dto.before_photo_ids,
      after_photo_ids: dto.after_photo_ids,
      moderation_status: ModerationStatus.PENDING,
      gdpr_consent: true,
      gdpr_consent_at: new Date(),
    });

    return this.communityRepo.save(entry);
  }

  async withdrawProject(
    userId: string,
    communityProjectId: string,
  ): Promise<void> {
    const entry = await this.communityRepo.findOne({
      where: { id: communityProjectId },
    });
    if (!entry) {
      throw new NotFoundException('Publication communautaire non trouvee');
    }
    if (entry.user_id !== userId) {
      throw new ForbiddenException('Acces interdit');
    }
    await this.communityRepo.softRemove(entry);
  }

  async listApproved(query: ListCommunityQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;

    const qb = this.communityRepo
      .createQueryBuilder('cp')
      .leftJoin('cp.user', 'u')
      .addSelect(['u.email'])
      .where('cp.moderation_status = :status', {
        status: ModerationStatus.APPROVED,
      })
      .andWhere('cp.deleted_at IS NULL');

    if (query.work_type) {
      qb.andWhere('cp.work_type = :workType', { workType: query.work_type });
    }

    qb.orderBy('cp.published_at', 'DESC');

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = await Promise.all(
      items.map(async (item) => {
        const commentsCount = await this.commentRepo.count({
          where: {
            community_project_id: item.id,
            deleted_at: IsNull(),
          },
        });

        return {
          id: item.id,
          title: item.title,
          work_type: item.work_type,
          thumbnail_url:
            item.after_photo_ids.length > 0
              ? `/community/${item.id}/photos/${item.after_photo_ids[0]}/thumbnail`
              : null,
          likes_count: item.likes_count,
          comments_count: commentsCount,
          user_display_name: this.maskEmail(item.user?.email),
          published_at: item.published_at?.toISOString() ?? null,
        };
      }),
    );

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getApprovedDetail(
    communityProjectId: string,
    currentUserId?: string | null,
  ) {
    const entry = await this.communityRepo.findOne({
      where: {
        id: communityProjectId,
        moderation_status: ModerationStatus.APPROVED,
      },
      relations: ['user'],
    });
    if (!entry) {
      throw new NotFoundException('Publication communautaire non trouvee');
    }

    let hasLiked = false;
    if (currentUserId) {
      const like = await this.likeRepo.findOne({
        where: {
          community_project_id: communityProjectId,
          user_id: currentUserId,
        },
      });
      hasLiked = !!like;
    }

    const commentsCount = await this.commentRepo.count({
      where: {
        community_project_id: communityProjectId,
        deleted_at: IsNull(),
      },
    });

    return {
      id: entry.id,
      title: entry.title,
      work_type: entry.work_type,
      description: entry.description,
      materials_list: entry.materials_list,
      total_cost_cents: entry.total_cost_cents,
      duration_days: entry.duration_days,
      length_cm: Number(entry.length_cm),
      width_cm: Number(entry.width_cm),
      height_cm: entry.height_cm != null ? Number(entry.height_cm) : null,
      before_photo_ids: entry.before_photo_ids,
      after_photo_ids: entry.after_photo_ids,
      likes_count: entry.likes_count,
      comments_count: commentsCount,
      user_display_name: this.maskEmail(entry.user?.email),
      published_at: entry.published_at?.toISOString() ?? null,
      has_liked: hasLiked,
      is_owner: currentUserId === entry.user_id,
    };
  }

  async toggleLike(
    userId: string,
    communityProjectId: string,
  ): Promise<{ liked: boolean; likes_count: number }> {
    const entry = await this.communityRepo.findOne({
      where: {
        id: communityProjectId,
        moderation_status: ModerationStatus.APPROVED,
      },
    });
    if (!entry) {
      throw new NotFoundException('Publication communautaire non trouvee');
    }

    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(CommunityLike, {
        where: {
          community_project_id: communityProjectId,
          user_id: userId,
        },
      });

      if (existing) {
        await manager.remove(existing);
        await manager
          .createQueryBuilder()
          .update(CommunityProject)
          .set({ likes_count: () => 'likes_count - 1' })
          .where('id = :id', { id: communityProjectId })
          .execute();
        const updated = await manager.findOneBy(CommunityProject, {
          id: communityProjectId,
        });
        return { liked: false, likes_count: updated?.likes_count ?? 0 };
      } else {
        const like = manager.create(CommunityLike, {
          community_project_id: communityProjectId,
          user_id: userId,
        });
        await manager.save(like);
        await manager
          .createQueryBuilder()
          .update(CommunityProject)
          .set({ likes_count: () => 'likes_count + 1' })
          .where('id = :id', { id: communityProjectId })
          .execute();
        const updated = await manager.findOneBy(CommunityProject, {
          id: communityProjectId,
        });
        return { liked: true, likes_count: updated?.likes_count ?? 0 };
      }
    });
  }

  async listComments(
    communityProjectId: string,
    page = 1,
    limit = 20,
    currentUserId?: string | null,
  ) {
    const entry = await this.communityRepo.findOne({
      where: {
        id: communityProjectId,
        moderation_status: ModerationStatus.APPROVED,
      },
    });
    if (!entry) {
      throw new NotFoundException('Publication communautaire non trouvee');
    }

    const [items, total] = await this.commentRepo.findAndCount({
      where: {
        community_project_id: communityProjectId,
      },
      relations: ['user'],
      order: { created_at: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: items.map((c) => ({
        id: c.id,
        content: c.content,
        user_display_name: this.maskEmail(c.user?.email),
        is_owner: currentUserId != null && c.user_id === currentUserId,
        created_at: c.created_at.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async addComment(
    userId: string,
    communityProjectId: string,
    dto: CreateCommunityCommentDto,
  ) {
    const entry = await this.communityRepo.findOne({
      where: {
        id: communityProjectId,
        moderation_status: ModerationStatus.APPROVED,
      },
    });
    if (!entry) {
      throw new NotFoundException('Publication communautaire non trouvee');
    }

    const comment = this.commentRepo.create({
      community_project_id: communityProjectId,
      user_id: userId,
      content: dto.content,
    });
    return this.commentRepo.save(comment);
  }

  async deleteComment(userId: string, commentId: string): Promise<void> {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId },
    });
    if (!comment) {
      throw new NotFoundException('Commentaire non trouve');
    }
    if (comment.user_id !== userId) {
      throw new ForbiddenException('Acces interdit');
    }
    await this.commentRepo.softRemove(comment);
  }

  async listPendingForModeration(page = 1, limit = 20) {
    const [items, total] = await this.communityRepo.findAndCount({
      where: { moderation_status: ModerationStatus.PENDING },
      relations: ['user'],
      order: { created_at: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: items.map((item) => ({
        id: item.id,
        title: item.title,
        work_type: item.work_type,
        user_display_name: this.maskEmail(item.user?.email),
        total_cost_cents: item.total_cost_cents,
        duration_days: item.duration_days,
        before_photo_ids: item.before_photo_ids,
        after_photo_ids: item.after_photo_ids,
        materials_list: item.materials_list,
        description: item.description,
        length_cm: Number(item.length_cm),
        width_cm: Number(item.width_cm),
        height_cm: item.height_cm != null ? Number(item.height_cm) : null,
        created_at: item.created_at.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async moderate(
    communityProjectId: string,
    dto: ModerateCommunityProjectDto,
  ): Promise<CommunityProject> {
    const entry = await this.communityRepo.findOne({
      where: { id: communityProjectId },
    });
    if (!entry) {
      throw new NotFoundException('Publication communautaire non trouvee');
    }
    if (entry.moderation_status !== ModerationStatus.PENDING) {
      throw new BadRequestException('Ce projet a deja ete modere');
    }

    if (dto.action === ModerationAction.APPROVE) {
      entry.moderation_status = ModerationStatus.APPROVED;
      entry.published_at = new Date();
    } else {
      entry.moderation_status = ModerationStatus.REJECTED;
      entry.rejection_reason = dto.rejection_reason ?? null;
    }

    return this.communityRepo.save(entry);
  }

  async findPhotoForCommunityProject(
    communityProjectId: string,
    photoId: string,
  ): Promise<ProjectPhoto> {
    const entry = await this.communityRepo.findOne({
      where: {
        id: communityProjectId,
        moderation_status: ModerationStatus.APPROVED,
      },
    });
    if (!entry) {
      throw new NotFoundException('Publication communautaire non trouvee');
    }

    const allIds = [...entry.before_photo_ids, ...entry.after_photo_ids];
    if (!allIds.includes(photoId)) {
      throw new NotFoundException('Photo non trouvee');
    }

    const photo = await this.photoRepo.findOne({ where: { id: photoId } });
    if (!photo) {
      throw new NotFoundException('Photo non trouvee');
    }
    return photo;
  }

  private maskEmail(email: string | null | undefined): string {
    if (!email) return 'Utilisateur';
    const atIndex = email.indexOf('@');
    if (atIndex <= 1) return 'Utilisateur';
    return email[0] + '***';
  }
}
