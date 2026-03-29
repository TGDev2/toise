import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { Project, ProjectStatus } from './entities/project.entity';
import {
  ConfidenceScore,
  DimensionSource,
  RoomDimensions,
} from './entities/room-dimensions.entity';
import { Opening } from './entities/opening.entity';
import { WorkType } from './entities/work-type.entity';
import { ProjectWorkItem } from './entities/project-work-item.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateDimensionsDto } from './dto/update-dimensions.dto';
import { CreateOpeningDto } from './dto/create-opening.dto';
import { UpdateOpeningDto } from './dto/update-opening.dto';
import { SaveWorkItemsDto } from './dto/save-work-items.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';

@Injectable()
export class ProjectsService {
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
  ) {}

  async createProject(userId: string, dto: CreateProjectDto): Promise<Project> {
    const project = this.projectsRepo.create({
      user_id: userId,
      name: dto.name,
      room_name: dto.room_name ?? '',
      work_type: dto.work_type,
    });
    return this.projectsRepo.save(project);
  }

  async findByUser(
    userId: string,
    query: ListProjectsQueryDto = {},
  ): Promise<{ data: Project[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
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
  ): Promise<RoomDimensions> {
    await this.findOneByUser(projectId, userId);

    let dimensions = await this.dimensionsRepo.findOne({
      where: { project_id: projectId },
    });

    if (dimensions) {
      dimensions.length_cm = dto.length_cm;
      dimensions.width_cm = dto.width_cm;
      dimensions.height_cm = dto.height_cm;
      dimensions.source = DimensionSource.MANUAL;
      dimensions.confidence_score = ConfidenceScore.HIGH;
    } else {
      dimensions = this.dimensionsRepo.create({
        project_id: projectId,
        length_cm: dto.length_cm,
        width_cm: dto.width_cm,
        height_cm: dto.height_cm,
        source: DimensionSource.MANUAL,
        confidence_score: ConfidenceScore.HIGH,
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
  ): Promise<Opening> {
    await this.findOneByUser(projectId, userId);

    const opening = this.openingsRepo.create({
      project_id: projectId,
      type: dto.type,
      width_cm: dto.width_cm,
      height_cm: dto.height_cm,
      count: dto.count ?? 1,
    });

    return this.openingsRepo.save(opening);
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

  async getOpenings(
    projectId: string,
    userId: string,
  ): Promise<Opening[]> {
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

    const saved = await this.workItemsRepo.save(entities);

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

  async updateStatus(
    projectId: string,
    status: ProjectStatus,
  ): Promise<void> {
    await this.projectsRepo.update(projectId, { status });
  }
}
