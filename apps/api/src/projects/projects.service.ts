import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  IsNull,
  Repository,
} from 'typeorm';
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
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';
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

  /**
   * Un compte invité (anonyme Firebase) n'a droit qu'à **un** projet, là où un
   * compte gratuit en a deux (E2-1).
   *
   * Ce n'est pas une brimade : c'est le seul quota qu'un compte anonyme rende
   * significatif. Se créer un compte anonyme est gratuit, instantané et
   * reproductible à l'infini — l'allocation par compte doit donc être le strict
   * nécessaire au parcours, qui est d'un projet, de la page d'accueil à la
   * liste d'achat. Le deuxième projet se mérite en créant son compte, ce qui
   * est précisément la conversion que ce lot cherche à provoquer.
   */
  private readonly GUEST_PROJECT_LIMIT = 1;

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
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly analyticsService: AnalyticsService,
  ) {}

  /**
   * `organizationId` porte la propriété (et donc le quota), `userId` l'auteur —
   * les deux divergent dès qu'une organisation a plusieurs membres (PLAT-4).
   */
  async createProject(
    organizationId: string,
    userId: string,
    dto: CreateProjectDto,
    userTier: SubscriptionTier = SubscriptionTier.FREE,
    isGuest = false,
  ): Promise<Project> {
    const unlimitedAllowed = await this.featureGatesService.isFeatureAllowed(
      'unlimited_projects',
      userTier,
    );

    // Un invité reste borné même si `unlimited_projects` venait à s'ouvrir au
    // palier `free` : son quota ne dépend pas d'une gate qu'un réglage
    // d'administration peut déplacer.
    if (isGuest || !unlimitedAllowed) {
      const limit = isGuest
        ? this.GUEST_PROJECT_LIMIT
        : this.FREE_TIER_PROJECT_LIMIT;
      const count = await this.countActiveProjects(organizationId);
      if (count >= limit) {
        throw new ForbiddenException({
          message: isGuest
            ? 'Créez votre compte gratuit pour démarrer un deuxième projet.'
            : 'Limite de projets atteinte pour le forfait gratuit',
          error: isGuest ? 'ACCOUNT_REQUIRED' : 'PROJECT_LIMIT_REACHED',
          limit,
          current_count: count,
        });
      }
    }

    const project = this.projectsRepo.create({
      organization_id: organizationId,
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

  async countActiveProjects(organizationId: string): Promise<number> {
    return this.projectsRepo.count({
      where: { organization_id: organizationId, deleted_at: IsNull() },
    });
  }

  /**
   * Les `FREE_TIER_PROJECT_LIMIT` projets les plus récemment modifiés — les
   * seuls qu'un palier sans `unlimited_projects` puisse encore écrire.
   *
   * **`updated_at` doit figurer dans le `select`, alors qu'on ne lit que
   * `id`.** `Project.rooms` est `eager`, donc TypeORM ne peut pas appliquer
   * `take` par un simple `LIMIT` : il passe par une sous-requête
   * `SELECT DISTINCT … AS distinctAlias` qui ne projette que les colonnes
   * demandées, puis ordonne le tout sur `distinctAlias.Project_updated_at`.
   * Omettre la colonne de tri produit donc `column
   * distinctAlias.Project_updated_at does not exist` — une erreur SQL, à
   * l'exécution, sur toutes les écritures d'un compte gratuit.
   */
  private async findMostRecentlyUpdated(
    organizationId: string,
  ): Promise<Project[]> {
    return this.projectsRepo.find({
      where: { organization_id: organizationId, deleted_at: IsNull() },
      order: { updated_at: 'DESC' },
      take: this.FREE_TIER_PROJECT_LIMIT,
      select: ['id', 'updated_at'],
    });
  }

  async isProjectWritable(
    projectId: string,
    organizationId: string,
    userTier: SubscriptionTier,
  ): Promise<boolean> {
    const unlimitedAllowed = await this.featureGatesService.isFeatureAllowed(
      'unlimited_projects',
      userTier,
    );
    if (unlimitedAllowed) return true;

    const topProjects = await this.findMostRecentlyUpdated(organizationId);

    return topProjects.some((p) => p.id === projectId);
  }

  async getWritableProjectIds(organizationId: string): Promise<string[]> {
    const topProjects = await this.findMostRecentlyUpdated(organizationId);
    return topProjects.map((p) => p.id);
  }

  async ensureProjectWritable(
    projectId: string,
    organizationId: string,
    userTier: SubscriptionTier,
  ): Promise<void> {
    const writable = await this.isProjectWritable(
      projectId,
      organizationId,
      userTier,
    );
    if (!writable) {
      throw new ForbiddenException({
        message:
          'Ce projet est en lecture seule. Passez à Pro pour modifier tous vos projets.',
        error: 'PROJECT_READ_ONLY',
      });
    }
  }

  async findByOrg(
    organizationId: string,
    query: ListProjectsQueryDto = {},
  ): Promise<{
    data: Project[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;

    const where: FindOptionsWhere<Project> = {
      organization_id: organizationId,
    };
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

  async findOneForOrg(
    projectId: string,
    organizationId: string,
  ): Promise<Project> {
    const project = await this.projectsRepo.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.organization_id !== organizationId) {
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
  async getRooms(projectId: string, organizationId: string): Promise<Room[]> {
    await this.findOneForOrg(projectId, organizationId);
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
    organizationId: string,
    dto: CreateRoomDto,
  ): Promise<Room> {
    await this.findOneForOrg(projectId, organizationId);
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
    organizationId: string,
    roomId: string,
    dto: UpdateRoomDto,
  ): Promise<Room> {
    await this.findOneForOrg(projectId, organizationId);
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
    organizationId: string,
    roomId: string,
  ): Promise<void> {
    await this.findOneForOrg(projectId, organizationId);
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
    organizationId: string,
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
    await this.findOneForOrg(projectId, organizationId);
    const room = await this.resolveRoomForWrite(projectId, roomId);

    const dimensions = await this.writeDimensions(
      this.dimensionsRepo,
      room.id,
      dto,
      overrides,
    );

    // Marche « dimensions saisies » du funnel de revenu (BACKLOG_V1) : ne
    // couvre que la saisie manuelle. Les dimensions détectées par CV passent
    // par `writeDimensions` via `applyCvAnalysis`, jamais par ici.
    this.analyticsService.track(AnalyticsEventName.DIMENSIONS_ENTERED, userId, {
      project_id: projectId,
      room_id: room.id,
    });

    return dimensions;
  }

  /**
   * Cœur d'écriture de `updateDimensions`, isolé pour pouvoir être rejoué sur
   * un dépôt transactionnel (cf. `applyCvAnalysis`). Ne fait aucun contrôle de
   * propriété : les appelants l'ont déjà fait en résolvant la pièce.
   */
  private async writeDimensions(
    dimensionsRepo: Repository<RoomDimensions>,
    roomId: string,
    dto: UpdateDimensionsDto,
    overrides?: {
      source?: DimensionSource;
      confidence_score?: ConfidenceScore;
      raw_cv_output_json?: Record<string, unknown> | null;
      uncertainty?: {
        length_cm?: number;
        width_cm?: number;
        height_cm?: number;
      };
    },
  ): Promise<RoomDimensions> {
    const source = overrides?.source ?? DimensionSource.MANUAL;
    const confidence = overrides?.confidence_score ?? ConfidenceScore.HIGH;
    const lengthUncertainty = overrides?.uncertainty?.length_cm ?? null;
    const widthUncertainty = overrides?.uncertainty?.width_cm ?? null;
    const heightUncertainty = overrides?.uncertainty?.height_cm ?? null;

    let dimensions = await dimensionsRepo.findOne({
      where: { room_id: roomId },
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
      dimensions = dimensionsRepo.create({
        room_id: roomId,
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

    return dimensionsRepo.save(dimensions);
  }

  /**
   * Applique le résultat d'une analyse CV : dimensions **et** remplacement
   * intégral des ouvertures d'origine CV, en une seule transaction.
   *
   * Les deux écritures forment un seul fait métier. Séparées, un échec au
   * milieu laissait le projet dans un état que rien ne décrit : des dimensions
   * fraîches à côté d'ouvertures périmées, sous un job marqué en échec. Le
   * remplacement des ouvertures est inconditionnel — une analyse qui n'en
   * détecte aucune doit effacer celles de l'analyse précédente, sans quoi le
   * chiffrage déduit des surfaces qui n'existent plus.
   *
   * Les ouvertures saisies à la main ne sont jamais touchées.
   */
  async applyCvAnalysis(
    projectId: string,
    organizationId: string,
    result: {
      dimensions: UpdateDimensionsDto;
      confidence_score: ConfidenceScore;
      raw_cv_output_json?: Record<string, unknown> | null;
      uncertainty?: {
        length_cm?: number;
        width_cm?: number;
        height_cm?: number;
      };
      openings: Array<CreateOpeningDto & { cv_confidence?: number }>;
    },
    roomId?: string,
  ): Promise<void> {
    await this.findOneForOrg(projectId, organizationId);
    const room = await this.resolveRoomForWrite(projectId, roomId);
    const rooms = await this.roomsRepo.find({
      where: { project_id: projectId },
      select: ['id'],
    });

    await this.dataSource.transaction(async (manager) => {
      await this.writeDimensions(
        manager.getRepository(RoomDimensions),
        room.id,
        result.dimensions,
        {
          source: DimensionSource.CV,
          confidence_score: result.confidence_score,
          raw_cv_output_json: result.raw_cv_output_json,
          uncertainty: result.uncertainty,
        },
      );

      const openingsRepo = manager.getRepository(Opening);
      if (rooms.length > 0) {
        await openingsRepo.delete({
          room_id: In(rooms.map((r) => r.id)),
          source: OpeningSource.CV,
        });
      }

      for (const detected of result.openings) {
        await openingsRepo.save(
          openingsRepo.create({
            room_id: room.id,
            type: detected.type,
            width_cm: detected.width_cm,
            height_cm: detected.height_cm,
            count: detected.count ?? 1,
            source: OpeningSource.CV,
            cv_confidence: detected.cv_confidence ?? null,
          }),
        );
      }
    });
  }

  async getDimensions(
    projectId: string,
    organizationId: string,
    roomId?: string,
  ): Promise<RoomDimensions | null> {
    await this.findOneForOrg(projectId, organizationId);

    const room = await this.resolveRoomForRead(projectId, roomId);
    if (!room) return null;

    return this.dimensionsRepo.findOne({
      where: { room_id: room.id },
    });
  }

  async addOpening(
    projectId: string,
    organizationId: string,
    dto: CreateOpeningDto,
    overrides?: { source?: OpeningSource; cv_confidence?: number },
    roomId?: string,
  ): Promise<Opening> {
    await this.findOneForOrg(projectId, organizationId);
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

  async findOpeningForOrg(
    projectId: string,
    organizationId: string,
    openingId: string,
  ): Promise<Opening> {
    await this.findOneForOrg(projectId, organizationId);

    const opening = await this.openingsRepo.findOne({
      where: { id: openingId },
      relations: ['room'],
    });

    if (!opening || opening.room.project_id !== projectId) {
      throw new NotFoundException('Opening not found');
    }

    return opening;
  }

  async updateOpening(
    projectId: string,
    organizationId: string,
    openingId: string,
    dto: UpdateOpeningDto,
  ): Promise<Opening> {
    const opening = await this.findOpeningForOrg(
      projectId,
      organizationId,
      openingId,
    );

    if (dto.type !== undefined) opening.type = dto.type;
    if (dto.width_cm !== undefined) opening.width_cm = dto.width_cm;
    if (dto.height_cm !== undefined) opening.height_cm = dto.height_cm;
    if (dto.count !== undefined) opening.count = dto.count;

    return this.openingsRepo.save(opening);
  }

  async removeOpening(
    projectId: string,
    organizationId: string,
    openingId: string,
  ): Promise<void> {
    const opening = await this.findOpeningForOrg(
      projectId,
      organizationId,
      openingId,
    );

    await this.openingsRepo.remove(opening);
  }

  async getOpenings(
    projectId: string,
    organizationId: string,
    roomId?: string,
  ): Promise<Opening[]> {
    await this.findOneForOrg(projectId, organizationId);

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
    organizationId: string,
    dto: SaveWorkItemsDto,
    roomId?: string,
  ): Promise<ProjectWorkItem[]> {
    await this.findOneForOrg(projectId, organizationId);
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

  /**
   * E4-4 — les ouvrages et le niveau de compétence du dernier chantier de
   * l'organisation, pour pré-remplir l'étape « Travaux » d'un chantier neuf.
   *
   * L'artisan de finition refait les mêmes ouvrages, et son niveau ne change
   * pas d'un chantier à l'autre : la sélection était pourtant repartie de zéro
   * à chaque pièce de chaque chantier, pour 15,3 s par pièce mesurées à 390 px
   * (`docs/AUDIT_PARCOURS_10MIN.md`).
   *
   * Le chantier courant est exclu : à l'intérieur d'un même chantier, le web
   * reprend la pièce précédente depuis les données qu'il a déjà en main, sans
   * appel supplémentaire.
   *
   * **Lecture pure**, et le web annonce à l'écran que la sélection est reprise :
   * un pré-remplissage muet mettrait un choix dans la bouche de l'artisan alors
   * que `skill_level` pilote le facteur de perte, donc les quantités.
   */
  async findLastWorkSelection(
    organizationId: string,
    excludeProjectId: string,
  ): Promise<ProjectWorkItem[]> {
    const latest = await this.workItemsRepo
      .createQueryBuilder('wi')
      .innerJoin(Room, 'r', 'r.id = wi.room_id')
      .innerJoin(Project, 'p', 'p.id = r.project_id')
      .where('p.organization_id = :organizationId', { organizationId })
      .andWhere('p.deleted_at IS NULL')
      .andWhere('r.project_id != :excludeProjectId', { excludeProjectId })
      .orderBy('wi.created_at', 'DESC')
      .select('wi.room_id', 'room_id')
      .limit(1)
      .getRawOne<{ room_id: string }>();

    if (!latest?.room_id) return [];

    return this.workItemsRepo.find({
      where: { room_id: latest.room_id },
      relations: ['work_type'],
      order: { work_type: { display_order: 'ASC' } },
    });
  }

  async getWorkItems(
    projectId: string,
    organizationId: string,
    roomId?: string,
  ): Promise<ProjectWorkItem[]> {
    await this.findOneForOrg(projectId, organizationId);

    const room = await this.resolveRoomForRead(projectId, roomId);
    if (!room) return [];

    return this.workItemsRepo.find({
      where: { room_id: room.id },
      relations: ['work_type'],
      order: { work_type: { display_order: 'ASC' } },
    });
  }

  async softDeleteProject(
    projectId: string,
    organizationId: string,
  ): Promise<void> {
    await this.findOneForOrg(projectId, organizationId);
    await this.projectsRepo.softDelete(projectId);
  }

  /**
   * `manager` permet à l'appelant d'inscrire le changement de statut dans **sa**
   * transaction. `finalizeBudgetSummary` s'en sert pour que « budget finalisé »
   * et « projet terminé » soient un seul fait, indivisible.
   */
  async updateStatus(
    projectId: string,
    status: ProjectStatus,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(Project) : this.projectsRepo;
    await repo.update(projectId, { status });
  }
}
