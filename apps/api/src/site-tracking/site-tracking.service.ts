import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SiteMilestone,
  MilestoneStatus,
} from './entities/site-milestone.entity';
import { ProjectsService } from '../projects/projects.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class SiteTrackingService {
  constructor(
    @InjectRepository(SiteMilestone)
    private readonly repo: Repository<SiteMilestone>,
    private readonly projectsService: ProjectsService,
  ) {}

  async findAllForProject(
    projectId: string,
    userId: string,
  ): Promise<SiteMilestone[]> {
    await this.projectsService.findOneForUser(projectId, userId);
    return this.repo.find({
      where: { project_id: projectId },
      order: { sort_order: 'ASC', created_at: 'ASC' },
    });
  }

  async create(
    projectId: string,
    userId: string,
    dto: CreateMilestoneDto,
  ): Promise<SiteMilestone> {
    await this.projectsService.findOneForUser(projectId, userId);

    const sortOrder =
      dto.sort_order ??
      (await this.repo.count({ where: { project_id: projectId } }));

    const milestone = this.repo.create({
      project_id: projectId,
      label: dto.label,
      planned_date: dto.planned_date ?? null,
      sort_order: sortOrder,
    });

    return this.repo.save(milestone);
  }

  private async findOneForProject(
    projectId: string,
    userId: string,
    milestoneId: string,
  ): Promise<SiteMilestone> {
    await this.projectsService.findOneForUser(projectId, userId);

    const milestone = await this.repo.findOne({
      where: { id: milestoneId, project_id: projectId },
    });
    if (!milestone) {
      throw new NotFoundException('Jalon non trouve');
    }
    return milestone;
  }

  async update(
    projectId: string,
    userId: string,
    milestoneId: string,
    dto: UpdateMilestoneDto,
  ): Promise<SiteMilestone> {
    const milestone = await this.findOneForProject(
      projectId,
      userId,
      milestoneId,
    );

    if (dto.label !== undefined) milestone.label = dto.label;
    if (dto.planned_date !== undefined)
      milestone.planned_date = dto.planned_date;
    if (dto.sort_order !== undefined) milestone.sort_order = dto.sort_order;

    if (dto.actual_date !== undefined) {
      milestone.actual_date = dto.actual_date;
    }

    if (dto.status !== undefined) {
      milestone.status = dto.status;
      // Un jalon marque "termine" sans date reelle explicite recoit la date
      // du jour, meme logique que sent_at/accepted_at sur les devis.
      if (
        dto.status === MilestoneStatus.DONE &&
        dto.actual_date === undefined
      ) {
        milestone.actual_date = milestone.actual_date ?? today();
      }
    }

    return this.repo.save(milestone);
  }

  async remove(
    projectId: string,
    userId: string,
    milestoneId: string,
  ): Promise<void> {
    const milestone = await this.findOneForProject(
      projectId,
      userId,
      milestoneId,
    );
    await this.repo.remove(milestone);
  }
}
