import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import { Project, ProjectStatus } from './entities/project.entity';
import { Room } from './entities/room.entity';
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
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
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
    @InjectRepository(Room)
    private readonly roomsRepo: Repository<Room>,
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
    const saved = await this.projectsRepo.save(project);

    // Tout projet possède ≥ 1 pièce dès sa création : invariant qui rend la
    // « pièce par défaut » toujours disponible pour les endpoints historiques.
    await this.roomsRepo.save(
      this.roomsRepo.create({
        project_id: saved.id,
        name: saved.room_name || 'Pièce 1',
        sort_order: 0,
      }),
    );

    return saved;
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

  // ---------------------------------------------------------------------------
  // Pièces (ENG-2)
  // ---------------------------------------------------------------------------

  /**
   * Pièce par défaut (1re par `sort_order` puis ancienneté) sans effet de bord.
   * Chemins de LECTURE uniquement.
   */
  private async findDefaultRoom(projectId: string): Promise<Room | null> {
    return this.roomsRepo.findOne({
      where: { project_id: projectId },
      order: { sort_order: 'ASC', created_at: 'ASC' },
    });
  }

  /**
   * Pièce par défaut, créée à la volée si le projet n'en a aucune (projets
   * antérieurs à ENG-2 non backfillés, robustesse). Chemins d'ÉCRITURE.
   */
  private async getOrCreateDefaultRoom(projectId: string): Promise<Room> {
    const existing = await this.findDefaultRoom(projectId);
    if (existing) return existing;
    return this.roomsRepo.save(
      this.roomsRepo.create({
        project_id: projectId,
        name: 'Pièce 1',
        sort_order: 0,
      }),
    );
  }

  /**
   * Toutes les pièces d'un projet avec géométrie et travaux chargés, ordonnées.
   * Source de vérité de l'estimation multi-pièces.
   */
  async getRooms(projectId: string, userId: string): Promise<Room[]> {
    await this.findOneByUser(projectId, userId);
    return this.roomsRepo.find({
      where: { project_id: projectId },
      relations: ['dimensions', 'openings', 'workItems', 'workItems.work_type'],
      order: { sort_order: 'ASC', created_at: 'ASC' },
    });
  }

  /**
   * Pièce cible d'une ÉCRITURE : `roomId` explicite (validé appartenance) ou
   * pièce par défaut (créée au besoin). Cœur de la compat mono-pièce + du
   * ciblage multi-pièces (Phase 2).
   */
  private async resolveRoomForWrite(
    projectId: string,
    roomId?: string,
  ): Promise<Room> {
    if (roomId) {
      const room = await this.roomsRepo.findOne({
        where: { id: roomId, project_id: projectId },
      });
      if (!room) throw new NotFoundException('Room not found');
      return room;
    }
    return this.getOrCreateDefaultRoom(projectId);
  }

  /** Pièce cible d'une LECTURE : `roomId` validé, ou pièce par défaut (peut être null). */
  private async resolveRoomForRead(
    projectId: string,
    roomId?: string,
  ): Promise<Room | null> {
    if (roomId) {
      const room = await this.roomsRepo.findOne({
        where: { id: roomId, project_id: projectId },
      });
      if (!room) throw new NotFoundException('Room not found');
      return room;
    }
    return this.findDefaultRoom(projectId);
  }

  async createRoom(
    projectId: string,
    userId: string,
    dto: CreateRoomDto,
  ): Promise<Room> {
    await this.findOneByUser(projectId, userId);
    const count = await this.roomsRepo.count({
      where: { project_id: projectId },
    });
    return this.roomsRepo.save(
      this.roomsRepo.create({
        project_id: projectId,
        name: dto.name?.trim() || `Pièce ${count + 1}`,
        sort_order: count,
      }),
    );
  }

  async renameRoom(
    projectId: string,
    userId: string,
    roomId: string,
    dto: UpdateRoomDto,
  ): Promise<Room> {
    await this.findOneByUser(projectId, userId);
    const room = await this.roomsRepo.findOne({
      where: { id: roomId, project_id: projectId },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (dto.name !== undefined) room.name = dto.name.trim();
    if (dto.sort_order !== undefined) room.sort_order = dto.sort_order;
    return this.roomsRepo.save(room);
  }

  async deleteRoom(
    projectId: string,
    userId: string,
    roomId: string,
  ): Promise<void> {
    await this.findOneByUser(projectId, userId);
    // Garde-fou : un projet conserve toujours ≥ 1 pièce.
    const count = await this.roomsRepo.count({
      where: { project_id: projectId },
    });
    if (count <= 1) {
      throw new BadRequestException(
        'Un projet doit conserver au moins une pièce.',
      );
    }
    const room = await this.roomsRepo.findOne({
      where: { id: roomId, project_id: projectId },
    });
    if (!room) throw new NotFoundException('Room not found');
    // La suppression cascade sur dimensions / ouvertures / work items (FK).
    await this.roomsRepo.remove(room);
  }

  async updateDimensions(
    projectId: string,
    userId: string,
    dto: UpdateDimensionsDto,
    overrides?: {
      source?: DimensionSource;
      confidence_score?: ConfidenceScore;
      raw_cv_output_json?: Record<string, unknown> | null;
      /**
       * Incertitude de mesure (cm) par champ (CV-5). Toujours réécrite en
       * entier comme `source`/`confidence_score` : absente → `null` sur les
       * 3 colonnes, donc une sauvegarde manuelle efface une incertitude CV
       * antérieure (pas de modèle d'erreur pour la saisie manuelle).
       */
      uncertainty?: {
        length_cm?: number;
        width_cm?: number;
        height_cm?: number;
      };
    },
    roomId?: string,
  ): Promise<RoomDimensions> {
    await this.findOneByUser(projectId, userId);
    const room = await this.resolveRoomForWrite(projectId, roomId);

    const source = overrides?.source ?? DimensionSource.MANUAL;
    const confidence = overrides?.confidence_score ?? ConfidenceScore.HIGH;
    const lengthUncertainty = overrides?.uncertainty?.length_cm ?? null;
    const widthUncertainty = overrides?.uncertainty?.width_cm ?? null;
    const heightUncertainty = overrides?.uncertainty?.height_cm ?? null;

    let dimensions = await this.dimensionsRepo.findOne({
      where: { room_id: room.id },
    });

    if (dimensions) {
      dimensions.length_cm = dto.length_cm;
      dimensions.width_cm = dto.width_cm;
      dimensions.height_cm = dto.height_cm;
      dimensions.source = source;
      dimensions.confidence_score = confidence;
      dimensions.length_cm_uncertainty = lengthUncertainty;
      dimensions.width_cm_uncertainty = widthUncertainty;
      dimensions.height_cm_uncertainty = heightUncertainty;
      // Le formulaire renvoie l'état complet à chaque enregistrement : une
      // sauvegarde rectangulaire (segments absents) efface une forme antérieure.
      dimensions.segments_json = dto.segments ?? null;
      dimensions.exclusions_json = dto.exclusions ?? null;
      if (overrides?.raw_cv_output_json !== undefined) {
        dimensions.raw_cv_output_json = overrides.raw_cv_output_json;
      }
    } else {
      dimensions = this.dimensionsRepo.create({
        room_id: room.id,
        length_cm: dto.length_cm,
        width_cm: dto.width_cm,
        height_cm: dto.height_cm,
        source,
        confidence_score: confidence,
        length_cm_uncertainty: lengthUncertainty,
        width_cm_uncertainty: widthUncertainty,
        height_cm_uncertainty: heightUncertainty,
        segments_json: dto.segments ?? null,
        exclusions_json: dto.exclusions ?? null,
        raw_cv_output_json: overrides?.raw_cv_output_json ?? null,
      });
    }

    return this.dimensionsRepo.save(dimensions);
  }

  async getDimensions(
    projectId: string,
    userId: string,
    roomId?: string,
  ): Promise<RoomDimensions | null> {
    await this.findOneByUser(projectId, userId);

    const room = await this.resolveRoomForRead(projectId, roomId);
    if (!room) return null;

    return this.dimensionsRepo.findOne({
      where: { room_id: room.id },
    });
  }

  async addOpening(
    projectId: string,
    userId: string,
    dto: CreateOpeningDto,
    overrides?: { source?: OpeningSource; cv_confidence?: number },
    roomId?: string,
  ): Promise<Opening> {
    await this.findOneByUser(projectId, userId);
    const room = await this.resolveRoomForWrite(projectId, roomId);

    const opening = this.openingsRepo.create({
      room_id: room.id,
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
    const rooms = await this.roomsRepo.find({
      where: { project_id: projectId },
      select: ['id'],
    });
    if (rooms.length === 0) return;

    await this.openingsRepo.delete({
      room_id: In(rooms.map((r) => r.id)),
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
      where: { id: openingId },
      relations: ['room'],
    });

    if (!opening || opening.room.project_id !== projectId) {
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
      where: { id: openingId },
      relations: ['room'],
    });

    if (!opening || opening.room.project_id !== projectId) {
      throw new NotFoundException('Opening not found');
    }

    await this.openingsRepo.remove(opening);
  }

  async getOpenings(
    projectId: string,
    userId: string,
    roomId?: string,
  ): Promise<Opening[]> {
    await this.findOneByUser(projectId, userId);

    const room = await this.resolveRoomForRead(projectId, roomId);
    if (!room) return [];

    return this.openingsRepo.find({
      where: { room_id: room.id },
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
    roomId?: string,
  ): Promise<ProjectWorkItem[]> {
    await this.findOneByUser(projectId, userId);
    const room = await this.resolveRoomForWrite(projectId, roomId);

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

    // Delete existing work items for this room
    await this.workItemsRepo.delete({ room_id: room.id });

    // Insert new items
    const entities = dto.items.map((item) =>
      this.workItemsRepo.create({
        room_id: room.id,
        work_type_id: item.work_type_id,
        skill_level: item.skill_level,
        custom_params: item.custom_params ?? {},
      }),
    );

    await this.workItemsRepo.save(entities);

    // Return with work_type relation loaded
    return this.workItemsRepo.find({
      where: { room_id: room.id },
      relations: ['work_type'],
      order: { work_type: { display_order: 'ASC' } },
    });
  }

  async getWorkItems(
    projectId: string,
    userId: string,
    roomId?: string,
  ): Promise<ProjectWorkItem[]> {
    await this.findOneByUser(projectId, userId);

    const room = await this.resolveRoomForRead(projectId, roomId);
    if (!room) return [];

    return this.workItemsRepo.find({
      where: { room_id: room.id },
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
