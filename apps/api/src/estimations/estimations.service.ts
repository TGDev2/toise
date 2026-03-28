import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstimationResult } from './entities/estimation-result.entity';
import { MaterialCatalog } from '../materials/entities/material-catalog.entity';
import { ProjectsService } from '../projects/projects.service';
import {
  EstimationEngine,
  RoomData,
  WorkItemInput,
  MaterialInput,
} from './estimation-engine';
import { SkillLevel } from '../projects/entities/project-work-item.entity';

@Injectable()
export class EstimationsService {
  constructor(
    @InjectRepository(EstimationResult)
    private readonly estimationRepo: Repository<EstimationResult>,
    @InjectRepository(MaterialCatalog)
    private readonly materialsRepo: Repository<MaterialCatalog>,
    private readonly projectsService: ProjectsService,
    private readonly engine: EstimationEngine,
  ) {}

  async estimate(
    projectId: string,
    userId: string,
    skillLevelOverride?: SkillLevel,
  ): Promise<EstimationResult> {
    const project = await this.projectsService.findOneByUser(
      projectId,
      userId,
    );

    if (!project.dimensions) {
      throw new BadRequestException(
        'Project must have room dimensions before estimation',
      );
    }

    const workItems = await this.projectsService.getWorkItems(
      projectId,
      userId,
    );

    if (workItems.length === 0) {
      throw new BadRequestException(
        'Project must have at least one work item before estimation',
      );
    }

    const room: RoomData = {
      length_cm: project.dimensions.length_cm,
      width_cm: project.dimensions.width_cm,
      height_cm: project.dimensions.height_cm,
      openings: (project.openings || []).map((o) => ({
        width_cm: o.width_cm,
        height_cm: o.height_cm,
        count: o.count,
      })),
    };

    // Build work item inputs with their materials
    const workItemInputs: WorkItemInput[] = [];
    const effectiveSkillLevel = skillLevelOverride;

    for (const wi of workItems) {
      const wt = wi.work_type;

      // Load active materials matching this work type's category
      const materials = await this.materialsRepo.find({
        where: { category: wt.category as MaterialCatalog['category'], is_active: true },
        relations: ['packagings', 'waste_factors'],
      });

      const materialInputs: MaterialInput[] = materials.map((m) => ({
        id: m.id,
        name: m.name,
        unit: m.unit,
        yield_per_unit: Number(m.yield_per_unit),
        waste_factors: m.waste_factors.map((wf) => ({
          pose_type: wf.pose_type,
          skill_level: wf.skill_level,
          factor_percent: Number(wf.factor_percent),
        })),
        packagings: m.packagings.map((p) => ({
          label: p.label,
          quantity_per_unit: Number(p.quantity_per_unit),
          unit: p.unit,
        })),
      }));

      workItemInputs.push({
        id: wi.id,
        work_type_code: wt.code,
        work_type_label: wt.label_fr,
        category: wt.category,
        surface_target: wt.surface_target,
        skill_level: effectiveSkillLevel || wi.skill_level,
        custom_params: wi.custom_params,
        materials: materialInputs,
      });
    }

    const items = this.engine.computeEstimation(room, workItemInputs);

    const result = this.estimationRepo.create({
      project_id: projectId,
      skill_level: effectiveSkillLevel || workItems[0].skill_level,
      items_json: items,
      total_items: items.length,
    });

    return this.estimationRepo.save(result);
  }

  async getLatest(
    projectId: string,
    userId: string,
  ): Promise<EstimationResult> {
    await this.projectsService.findOneByUser(projectId, userId);

    const result = await this.estimationRepo.findOne({
      where: { project_id: projectId },
      order: { created_at: 'DESC' },
    });

    if (!result) {
      throw new NotFoundException('No estimation found for this project');
    }

    return result;
  }

  async getHistory(
    projectId: string,
    userId: string,
  ): Promise<EstimationResult[]> {
    await this.projectsService.findOneByUser(projectId, userId);

    return this.estimationRepo.find({
      where: { project_id: projectId },
      order: { created_at: 'DESC' },
    });
  }
}
