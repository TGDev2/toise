import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EstimationLineItem,
  EstimationResult,
} from './entities/estimation-result.entity';
import { EmailCapture } from './entities/email-capture.entity';
import { MaterialCatalog } from '../materials/entities/material-catalog.entity';
import { ProjectsService } from '../projects/projects.service';
import {
  EstimationEngine,
  RoomData,
  WorkItemInput,
  MaterialInput,
} from './estimation-engine';
import { SkillLevel } from '../projects/entities/project-work-item.entity';
import { ProjectStatus } from '../projects/entities/project.entity';
import { WorkType } from '../projects/entities/work-type.entity';
import { PublicEstimateRequestDto } from './dto/public-estimate-request.dto';
import { PublicEstimateEmailDto } from './dto/public-estimate-email.dto';
import { EmailService } from '../email/email.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';

export interface PublicEstimateResponse {
  work_type_code: string;
  work_type_label: string;
  skill_level: string;
  total_items: number;
  items: EstimationLineItem[];
}

export interface PublicEstimateEmailResponse {
  sent: boolean;
}

@Injectable()
export class EstimationsService {
  private readonly logger = new Logger(EstimationsService.name);

  constructor(
    @InjectRepository(EstimationResult)
    private readonly estimationRepo: Repository<EstimationResult>,
    @InjectRepository(MaterialCatalog)
    private readonly materialsRepo: Repository<MaterialCatalog>,
    @InjectRepository(WorkType)
    private readonly workTypesRepo: Repository<WorkType>,
    @InjectRepository(EmailCapture)
    private readonly emailCaptureRepo: Repository<EmailCapture>,
    private readonly projectsService: ProjectsService,
    private readonly engine: EstimationEngine,
    private readonly emailService: EmailService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  private async loadMaterialInputs(category: string): Promise<MaterialInput[]> {
    const materials = await this.materialsRepo.find({
      where: {
        category: category as MaterialCatalog['category'],
        is_active: true,
      },
      relations: ['packagings', 'waste_factors'],
    });

    return materials.map((m) => ({
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
  }

  async estimate(
    projectId: string,
    userId: string,
    skillLevelOverride?: SkillLevel,
  ): Promise<EstimationResult> {
    const project = await this.projectsService.findOneByUser(projectId, userId);

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
      segments: project.dimensions.segments_json ?? undefined,
    };

    // Build work item inputs with their materials
    const workItemInputs: WorkItemInput[] = [];
    const effectiveSkillLevel = skillLevelOverride;

    for (const wi of workItems) {
      const wt = wi.work_type;
      const materialInputs = await this.loadMaterialInputs(wt.category);

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

    const saved = await this.estimationRepo.save(result);

    await this.projectsService.updateStatus(projectId, ProjectStatus.ESTIMATED);

    this.analyticsService.track(AnalyticsEventName.ESTIMATE_CREATED, userId, {
      project_id: projectId,
      total_items: items.length,
    });

    return saved;
  }

  async estimatePublic(
    dto: PublicEstimateRequestDto,
  ): Promise<PublicEstimateResponse> {
    const workType = await this.workTypesRepo.findOne({
      where: { code: dto.work_type_code },
    });

    if (!workType) {
      throw new NotFoundException('Unknown work type');
    }

    const room: RoomData = {
      length_cm: dto.length_cm,
      width_cm: dto.width_cm,
      height_cm: dto.height_cm,
      openings: (dto.openings || []).map((o) => ({
        width_cm: o.width_cm,
        height_cm: o.height_cm,
        count: o.count,
      })),
      segments: dto.segments?.map((s) => ({
        x_cm: s.x_cm,
        y_cm: s.y_cm,
        length_cm: s.length_cm,
        width_cm: s.width_cm,
      })),
    };

    const skillLevel = dto.skill_level || SkillLevel.INTERMEDIATE;
    const workItemInput: WorkItemInput = {
      id: 'public',
      work_type_code: workType.code,
      work_type_label: workType.label_fr,
      category: workType.category,
      surface_target: workType.surface_target,
      skill_level: skillLevel,
      custom_params: { ...dto.custom_params },
      materials: await this.loadMaterialInputs(workType.category),
    };

    const items = this.engine.computeEstimation(room, [workItemInput]);

    return {
      work_type_code: workType.code,
      work_type_label: workType.label_fr,
      skill_level: skillLevel,
      total_items: items.length,
      items,
    };
  }

  async emailEstimate(
    dto: PublicEstimateEmailDto,
  ): Promise<PublicEstimateEmailResponse> {
    if (!dto.consent) {
      throw new BadRequestException(
        'Le consentement est requis pour recevoir cette estimation par e-mail.',
      );
    }

    // Ne jamais faire confiance à un résultat fourni par le client : on
    // recalcule toujours côté serveur avant de l'inclure dans l'e-mail.
    const result = await this.estimatePublic(dto);

    const entry = this.emailCaptureRepo.create({
      email: dto.email,
      work_type_code: result.work_type_code,
      skill_level: result.skill_level,
      estimate_snapshot: result.items,
      consent: true,
      consent_at: new Date(),
    });
    const saved = await this.emailCaptureRepo.save(entry);

    let sent = false;
    try {
      await this.emailService.sendCalculatorResultEmail(dto.email, {
        workTypeLabel: result.work_type_label,
        items: result.items,
      });
      saved.email_sent_at = new Date();
      await this.emailCaptureRepo.save(saved);
      sent = true;
    } catch (err) {
      // Ne jamais logger l'adresse elle-même, seulement l'id de la capture.
      this.logger.warn(
        `Échec de l'envoi Brevo pour la capture ${saved.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    this.analyticsService.track(AnalyticsEventName.EMAIL_CAPTURE, null, {
      work_type_code: result.work_type_code,
      skill_level: result.skill_level,
      sent,
    });

    return { sent };
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

  async findById(estimationId: string): Promise<EstimationResult> {
    const result = await this.estimationRepo.findOne({
      where: { id: estimationId },
    });

    if (!result) {
      throw new NotFoundException('Estimation not found');
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
