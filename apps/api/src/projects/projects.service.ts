import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import {
  ConfidenceScore,
  DimensionSource,
  RoomDimensions,
} from './entities/room-dimensions.entity';
import { Opening } from './entities/opening.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateDimensionsDto } from './dto/update-dimensions.dto';
import { CreateOpeningDto } from './dto/create-opening.dto';
import { UpdateOpeningDto } from './dto/update-opening.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(RoomDimensions)
    private readonly dimensionsRepo: Repository<RoomDimensions>,
    @InjectRepository(Opening)
    private readonly openingsRepo: Repository<Opening>,
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

  async findByUser(userId: string): Promise<Project[]> {
    return this.projectsRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
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
}
