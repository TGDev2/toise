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
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateDimensionsDto } from './dto/update-dimensions.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(RoomDimensions)
    private readonly dimensionsRepo: Repository<RoomDimensions>,
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
}
