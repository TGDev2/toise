import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import { Project, ProjectStatus } from './entities/project.entity';
import {
  ConfidenceScore,
  DimensionSource,
  RoomDimensions,
} from './entities/room-dimensions.entity';
import { Opening, OpeningSource } from './entities/opening.entity';
import { WorkType } from './entities/work-type.entity';
import { ProjectWorkItem } from './entities/project-work-item.entity';
import { SubscriptionTier } from '../users/entities/user.entity';
import { FeatureGatesService } from '../feature-gates/feature-gates.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateDimensionsDto } from './dto/update-dimensions.dto';
import { CreateOpeningDto } from './dto/create-opening.dto';
import { UpdateOpeningDto } from './dto/update-opening.dto';
import { SaveWorkItemsDto } from './dto/save-work-items.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';

@Injectable()
export class ProjectsService {
  private readonly FREE_TIER_PROJECT_LIMIT = 2;

  constructor(
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(RoomDimensions)
    private readonly dimensionsRepo: Repository<RoomDimensions>,
    @InjectRepository(Opening)
    private readonly openingsRepo: Repository<Opening>,
    @InjectRepository(WorkType)
    private readonly workTypesRepo: Repository<WorkType>,
    @InjectRepository(ProjectWorkItem)
    private readonly workItemsRepo: Repository<ProjectWorkItem>,
    private readonly featureGatesService: FeatureGatesService,
  ) {}

  async createProject(
    userId: string,
    dto: CreateProjectDto,
    userTier: SubscriptionTier = SubscriptionTier.FREE,
  ): Promise<Project> {
    const unlimitedAllowed = await this.featureGatesService.isFeatureAllowed(
      'unlimited_projects',
      userTier,
    );

    if (!unlimitedAllowed) {
      const count = await this.countActiveProjects(userId);
      if (count >= this.FREE_TIER_PROJECT_LIMIT) {
        throw new ForbiddenException({
          message: 'Limite de projets atteinte pour le forfait gratuit',
          error: 'PROJECT_LIMIT_REACHED',
          limit: this.FREE_TIER_PROJECT_LIMIT,
          current_count: count,
        });
      }
    }

    const project = this.projectsRepo.create({
      user_id: userId,
      name: dto.name,
      room_name: dto.room_name ?? '',
      work_type: dto.work_type,
    });
    return this.projectsRepo.save(project);
  }

  async countActiveProjects(userId: string): Promise<number> {
    return this.projectsRepo.count({
      where: { user_id: userId, deleted_at: IsNull() },
    });
  }

  async isProjectWritable(
    projectId: string,
    userId: string,
    userTier: SubscriptionTier,
  ): Promise<boolean> {
    const unlimitedAllowed = await this.featureGatesService.isFeatureAllowed(
      'unlimited_projects',
      userTier,
    );
    if (unlimitedAllowed) return true;

    const topProjects = await this.projectsRepo.find({
      where: { user_id: userId, deleted_at: IsNull() },
      order: { updated_at: 'DESC' },
      take: this.FREE_TIER_PROJECT_LIMIT,
      select: ['id'],
    });

    return topProjects.some((p) => p.id === projectId);
  }

  async getWritableProjectIds(userId: string): Promise<string[]> {
    const topProjects = await this.projectsRepo.find({
      where: { user_id: userId, deleted_at: IsNull() },
      order: { updated_at: 'DESC' },
      take: this.FREE_TIER_PROJECT_LIMIT,
      select: ['id'],
    });
    return topProjects.map((p) => p.id);
  }

  async ensureProjectWritable(
    projectId: string,
    userId: string,
    userTier: SubscriptionTier,
  ): Promise<void> {
    const writable = await this.isProjectWritable(projectId, userId, userTier);
    if (!writable) {
      throw new ForbiddenException({
        message:
          'Ce projet est en lecture seule. Passez à Pro pour modifier tous vos projets.',
        error: 'PROJECT_READ_ONLY',
      });
    }
  }

  async findByUser(
    userId: string,
    query: ListProjectsQueryDto = {},
  ): Promise<{
    data: Project[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;

    const where: FindOptionsWhere<Project> = { user_id: userId };
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await this.projectsRepo.findAndCount({
      where,
      order: { updated_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOneByUser(projectId: string, userId: string): Promise<Project> {
    const project = await this.projectsRepo.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.user_id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return project;
  }

  async updateDimensions(
    projectId: string,
    userId: string,
    dto: UpdateDimensionsDto,
    overrides?: {
      source?: DimensionSource;
      confidence_score?: ConfidenceScore;
      raw_cv_output_json?: Record<string, unknown> | null;
    },
  ): Promise<RoomDimensions> {
    await this.findOneByUser(projectId, userId);

    const source = overrides?.source ?? DimensionSource.MANUAL;
    const confidence = overrides?.confidence_score ?? ConfidenceScore.HIGH;

    let dimensions = await this.dimensionsRepo.findOne({
      where: { project_id: projectId },
    });

    if (dimensions) {
      dimensions.length_cm = dto.length_cm;
      dimensions.width_cm = dto.width_cm;
      dimensions.height_cm = dto.height_cm;
      dimensions.source = source;
      dimensions.confidence_score = confidence;
      // Le formulaire renvoie l'état complet à chaque enregistrement : une
      // sauvegarde rectangulaire (segments absents) efface une forme antérieure.
      dimensions.segments_json = dto.segments ?? null;
      if (overrides?.raw_cv_output_json !== undefined) {
        dimensions.raw_cv_output_json = overrides.raw_cv_output_json;
      }
    } else {
      dimensions = this.dimensionsRepo.create({
        project_id: projectId,
        length_cm: dto.length_cm,
        width_cm: dto.width_cm,
        height_cm: dto.height_cm,
        source,
        confidence_score: confidence,
        segments_json: dto.segments ?? null,
        raw_cv_output_json: overrides?.raw_cv_output_json ?? null,
      });
    }

    return this.dimensionsRepo.save(dimensions);
  }

  async getDimensions(
    projectId: string,
    userId: string,
  ): Promise<RoomDimensions | null> {
    await this.findOneByUser(projectId, userId);

    return this.dimensionsRepo.findOne({
      where: { project_id: projectId },
    });
  }

  async addOpening(
    projectId: string,
    userId: string,
    dto: CreateOpeningDto,
    overrides?: { source?: OpeningSource; cv_confidence?: number },
  ): Promise<Opening> {
    await this.findOneByUser(projectId, userId);

    const opening = this.openingsRepo.create({
      project_id: projectId,
      type: dto.type,
      width_cm: dto.width_cm,
      height_cm: dto.height_cm,
      count: dto.count ?? 1,
      source: overrides?.source ?? OpeningSource.MANUAL,
      cv_confidence: overrides?.cv_confidence ?? null,
    });

    return this.openingsRepo.save(opening);
  }

  async removeCvOpenings(projectId: string): Promise<void> {
    await this.openingsRepo.delete({
      project_id: projectId,
      source: OpeningSource.CV,
    });
  }

  async updateOpening(
    projectId: string,
    userId: string,
    openingId: string,
    dto: UpdateOpeningDto,
  ): Promise<Opening> {
    await this.findOneByUser(projectId, userId);

    const opening = await this.openingsRepo.findOne({
      where: { id: openingId, project_id: projectId },
    });

    if (!opening) {
      throw new NotFoundException('Opening not found');
    }

    if (dto.type !== undefined) opening.type = dto.type;
    if (dto.width_cm !== undefined) opening.width_cm = dto.width_cm;
    if (dto.height_cm !== undefined) opening.height_cm = dto.height_cm;
    if (dto.count !== undefined) opening.count = dto.count;

    return this.openingsRepo.save(opening);
  }

  async removeOpening(
    projectId: string,
    userId: string,
    openingId: string,
  ): Promise<void> {
    await this.findOneByUser(projectId, userId);

    const opening = await this.openingsRepo.findOne({
      where: { id: openingId, project_id: projectId },
    });

    if (!opening) {
      throw new NotFoundException('Opening not found');
    }

    await this.openingsRepo.remove(opening);
  }

  async getOpenings(projectId: string, userId: string): Promise<Opening[]> {
    await this.findOneByUser(projectId, userId);

    return this.openingsRepo.find({
      where: { project_id: projectId },
      order: { created_at: 'ASC' },
    });
  }

  async getWorkTypes(): Promise<WorkType[]> {
    return this.workTypesRepo.find({
      order: { display_order: 'ASC' },
    });
  }

  async saveWorkItems(
    projectId: string,
    userId: string,
    dto: SaveWorkItemsDto,
  ): Promise<ProjectWorkItem[]> {
    await this.findOneByUser(projectId, userId);

    // Validate all work_type_ids exist
    const workTypeIds = dto.items.map((item) => item.work_type_id);
    const workTypes = await this.workTypesRepo.find({
      where: { id: In(workTypeIds) },
    });

    if (workTypes.length !== new Set(workTypeIds).size) {
      throw new BadRequestException('One or more work type IDs are invalid');
    }

    // Validate required contextual params
    const workTypeMap = new Map(workTypes.map((wt) => [wt.id, wt]));
    for (const item of dto.items) {
      const workType = workTypeMap.get(item.work_type_id)!;
      const requiredQuestions = workType.contextual_questions.filter(
        (q) => q.required,
      );
      for (const question of requiredQuestions) {
        if (
          !item.custom_params ||
          item.custom_params[question.key] === undefined ||
          item.custom_params[question.key] === ''
        ) {
          throw new BadRequestException(
            `Missing required parameter "${question.key}" for work type "${workType.code}"`,
          );
        }
      }
    }

    // Delete existing work items for this project
    await this.workItemsRepo.delete({ project_id: projectId });

    // Insert new items
    const entities = dto.items.map((item) =>
      this.workItemsRepo.create({
        project_id: projectId,
        work_type_id: item.work_type_id,
        skill_level: item.skill_level,
        custom_params: item.custom_params ?? {},
      }),
    );

    await this.workItemsRepo.save(entities);

    // Return with work_type relation loaded
    return this.workItemsRepo.find({
      where: { project_id: projectId },
      relations: ['work_type'],
      order: { work_type: { display_order: 'ASC' } },
    });
  }

  async getWorkItems(
    projectId: string,
    userId: string,
  ): Promise<ProjectWorkItem[]> {
    await this.findOneByUser(projectId, userId);

    return this.workItemsRepo.find({
      where: { project_id: projectId },
      relations: ['work_type'],
      order: { work_type: { display_order: 'ASC' } },
    });
  }

  async softDeleteProject(projectId: string, userId: string): Promise<void> {
    await this.findOneByUser(projectId, userId);
    await this.projectsRepo.softDelete(projectId);
  }

  async updateStatus(projectId: string, status: ProjectStatus): Promise<void> {
    await this.projectsRepo.update(projectId, { status });
  }
}
