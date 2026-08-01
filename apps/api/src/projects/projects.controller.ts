import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { OrgContextService } from '../organizations/org-context.service';
import type { OrgScope } from '../organizations/org-context.service';
import { ProjectsService } from './projects.service';
import { FeatureGatesService } from '../feature-gates/feature-gates.service';
import { CvCorrectionService } from '../analysis/cv-correction.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { UpdateDimensionsDto } from './dto/update-dimensions.dto';
import { Room } from './entities/room.entity';
import { CreateOpeningDto } from './dto/create-opening.dto';
import { UpdateOpeningDto } from './dto/update-opening.dto';
import { SaveWorkItemsDto } from './dto/save-work-items.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { DimensionSource } from './entities/room-dimensions.entity';
import { Opening, OpeningSource } from './entities/opening.entity';

// Snapshot jsonb d'une ouverture pour cv_correction_logs : l'opening_id
// permet au builder de dataset CV-6 de dédoublonner les éditions successives,
// le reste fait le lien avec les groupes de détections de raw_output.
function openingSnapshot(o: Opening) {
  return {
    opening_id: o.id,
    type: o.type,
    width_cm: o.width_cm,
    height_cm: o.height_cm,
    count: o.count,
    cv_confidence: o.cv_confidence,
  };
}

@Controller('projects')
@UseGuards(FirebaseAuthGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly orgContext: OrgContextService,
    private readonly featureGatesService: FeatureGatesService,
    private readonly cvCorrectionService: CvCorrectionService,
  ) {}

  private async resolveScope(firebaseUser: DecodedIdToken): Promise<OrgScope> {
    try {
      return await this.orgContext.resolveForFirebaseUid(firebaseUser.uid);
    } catch {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
  }

  @Post()
  async create(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: CreateProjectDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    const project = await this.projectsService.createProject(
      scope.organizationId,
      scope.userId,
      dto,
      scope.effectiveTier,
    );
    return {
      id: project.id,
      name: project.name,
      room_name: project.room_name,
      work_type: project.work_type,
      status: project.status,
      created_at: project.created_at,
    };
  }

  @Get()
  async findAll(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Query() query: ListProjectsQueryDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    const { data, meta } = await this.projectsService.findByOrg(
      scope.organizationId,
      query,
    );

    // Determine writable project IDs for free-tier users
    const unlimitedAllowed = await this.featureGatesService.isFeatureAllowed(
      'unlimited_projects',
      scope.effectiveTier,
    );
    let writableIds: Set<string> | null = null;
    if (!unlimitedAllowed && data.length > 0) {
      const topProjects = await this.projectsService.getWritableProjectIds(
        scope.organizationId,
      );
      writableIds = new Set(topProjects);
    }

    return {
      data: data.map((p) => ({
        id: p.id,
        name: p.name,
        room_name: p.room_name,
        work_type: p.work_type,
        status: p.status,
        dimensions: p.dimensions
          ? {
              length_cm: p.dimensions.length_cm,
              width_cm: p.dimensions.width_cm,
              height_cm: p.dimensions.height_cm,
              segments: p.dimensions.segments_json ?? null,
              exclusions: p.dimensions.exclusions_json ?? [],
            }
          : null,
        openings:
          p.openings?.map((o) => ({
            id: o.id,
            type: o.type,
            width_cm: o.width_cm,
            height_cm: o.height_cm,
            count: o.count,
          })) ?? [],
        is_read_only: writableIds ? !writableIds.has(p.id) : false,
        created_at: p.created_at,
        updated_at: p.updated_at,
      })),
      meta,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    await this.projectsService.softDeleteProject(id, scope.organizationId);
  }

  @Get('work-types')
  async getWorkTypes() {
    return this.projectsService.getWorkTypes();
  }

  @Get(':id')
  async findOne(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    const project = await this.projectsService.findOneForOrg(
      id,
      scope.organizationId,
    );
    const isReadOnly = !(await this.projectsService.isProjectWritable(
      id,
      scope.organizationId,
      scope.effectiveTier,
    ));
    return {
      id: project.id,
      name: project.name,
      room_name: project.room_name,
      work_type: project.work_type,
      status: project.status,
      dimensions: project.dimensions
        ? {
            length_cm: project.dimensions.length_cm,
            width_cm: project.dimensions.width_cm,
            height_cm: project.dimensions.height_cm,
            segments: project.dimensions.segments_json ?? null,
            exclusions: project.dimensions.exclusions_json ?? [],
          }
        : null,
      openings:
        project.openings?.map((o) => ({
          id: o.id,
          type: o.type,
          width_cm: o.width_cm,
          height_cm: o.height_cm,
          count: o.count,
        })) ?? [],
      is_read_only: isReadOnly,
      created_at: project.created_at,
      updated_at: project.updated_at,
    };
  }

  @Put(':id/dimensions')
  async updateDimensions(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDimensionsDto,
    @Query('room', new ParseUUIDPipe({ optional: true })) roomId?: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    await this.projectsService.ensureProjectWritable(
      id,
      scope.organizationId,
      scope.effectiveTier,
    );

    // Check if current dimensions are CV-sourced for correction logging
    const currentDims = await this.projectsService.getDimensions(
      id,
      scope.organizationId,
      roomId,
    );
    const wasCvSourced = currentDims?.source === DimensionSource.CV;

    const dimensions = await this.projectsService.updateDimensions(
      id,
      scope.organizationId,
      dto,
      undefined,
      roomId,
    );

    // Log corrections if user is overriding CV-detected values
    if (wasCvSourced && currentDims) {
      const fields = ['length_cm', 'width_cm', 'height_cm'] as const;
      for (const field of fields) {
        if (currentDims[field] !== dto[field]) {
          this.cvCorrectionService
            .logCorrection(
              id,
              'dimension',
              field,
              currentDims[field],
              dto[field],
            )
            .catch(() => {});
        }
      }
    }

    return {
      length_cm: dimensions.length_cm,
      width_cm: dimensions.width_cm,
      height_cm: dimensions.height_cm,
      segments: dimensions.segments_json ?? null,
      exclusions: dimensions.exclusions_json ?? [],
      source: dimensions.source,
      confidence_score: dimensions.confidence_score,
      length_cm_uncertainty: dimensions.length_cm_uncertainty,
      width_cm_uncertainty: dimensions.width_cm_uncertainty,
      height_cm_uncertainty: dimensions.height_cm_uncertainty,
    };
  }

  @Get(':id/dimensions')
  async getDimensions(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('room', new ParseUUIDPipe({ optional: true })) roomId?: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    const dimensions = await this.projectsService.getDimensions(
      id,
      scope.organizationId,
      roomId,
    );
    if (!dimensions) {
      return null;
    }
    return {
      length_cm: dimensions.length_cm,
      width_cm: dimensions.width_cm,
      height_cm: dimensions.height_cm,
      segments: dimensions.segments_json ?? null,
      exclusions: dimensions.exclusions_json ?? [],
      source: dimensions.source,
      confidence_score: dimensions.confidence_score,
      length_cm_uncertainty: dimensions.length_cm_uncertainty,
      width_cm_uncertainty: dimensions.width_cm_uncertainty,
      height_cm_uncertainty: dimensions.height_cm_uncertainty,
    };
  }

  @Post(':id/openings')
  async addOpening(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateOpeningDto,
    @Query('room', new ParseUUIDPipe({ optional: true })) roomId?: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    await this.projectsService.ensureProjectWritable(
      id,
      scope.organizationId,
      scope.effectiveTier,
    );
    const opening = await this.projectsService.addOpening(
      id,
      scope.organizationId,
      dto,
      undefined,
      roomId,
    );

    // Ajout manuel dans la room par défaut (la seule où le CV dépose ses
    // détections) = détection potentiellement manquée. Report-only pour
    // CV-6 : sans bbox, jamais utilisé comme label d'entraînement.
    // logCorrection skippe silencieusement sans analyse complétée.
    if (!roomId) {
      this.cvCorrectionService
        .logCorrection(
          id,
          'opening',
          'added',
          { missed: true },
          openingSnapshot(opening),
        )
        .catch(() => {});
    }

    return {
      id: opening.id,
      type: opening.type,
      width_cm: opening.width_cm,
      height_cm: opening.height_cm,
      count: opening.count,
    };
  }

  @Get(':id/openings')
  async getOpenings(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('room', new ParseUUIDPipe({ optional: true })) roomId?: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    const openings = await this.projectsService.getOpenings(
      id,
      scope.organizationId,
      roomId,
    );
    return openings.map((o) => ({
      id: o.id,
      type: o.type,
      width_cm: o.width_cm,
      height_cm: o.height_cm,
      count: o.count,
    }));
  }

  @Put(':id/openings/:openingId')
  async updateOpening(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('openingId', ParseUUIDPipe) openingId: string,
    @Body() dto: UpdateOpeningDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    await this.projectsService.ensureProjectWritable(
      id,
      scope.organizationId,
      scope.effectiveTier,
    );
    // État avant mutation, pour le log de correction (pattern dimensions)
    const before = await this.projectsService.findOpeningForOrg(
      id,
      scope.organizationId,
      openingId,
    );

    const opening = await this.projectsService.updateOpening(
      id,
      scope.organizationId,
      openingId,
      dto,
    );

    if (before.source === OpeningSource.CV) {
      const fields = ['type', 'width_cm', 'height_cm', 'count'] as const;
      for (const field of fields) {
        if (before[field] !== opening[field]) {
          this.cvCorrectionService
            .logCorrection(
              id,
              'opening',
              field,
              openingSnapshot(before),
              openingSnapshot(opening),
            )
            .catch(() => {});
        }
      }
    }

    return {
      id: opening.id,
      type: opening.type,
      width_cm: opening.width_cm,
      height_cm: opening.height_cm,
      count: opening.count,
    };
  }

  @Delete(':id/openings/:openingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeOpening(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('openingId', ParseUUIDPipe) openingId: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    await this.projectsService.ensureProjectWritable(
      id,
      scope.organizationId,
      scope.effectiveTier,
    );
    const before = await this.projectsService.findOpeningForOrg(
      id,
      scope.organizationId,
      openingId,
    );

    await this.projectsService.removeOpening(
      id,
      scope.organizationId,
      openingId,
    );

    // Suppression d'une détection CV : signal pour le rapport de précision
    // et le triage CV-6 (jamais converti en négatif d'entraînement).
    // Colonnes jsonb NOT NULL → objet marqueur, pas de null.
    if (before.source === OpeningSource.CV) {
      this.cvCorrectionService
        .logCorrection(id, 'opening', 'removed', openingSnapshot(before), {
          deleted: true,
        })
        .catch(() => {});
    }
  }

  @Post(':id/work-items')
  async saveWorkItems(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveWorkItemsDto,
    @Query('room', new ParseUUIDPipe({ optional: true })) roomId?: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    await this.projectsService.ensureProjectWritable(
      id,
      scope.organizationId,
      scope.effectiveTier,
    );
    const items = await this.projectsService.saveWorkItems(
      id,
      scope.organizationId,
      dto,
      roomId,
    );
    return items.map((item) => ({
      id: item.id,
      work_type: {
        id: item.work_type.id,
        code: item.work_type.code,
        label_fr: item.work_type.label_fr,
        category: item.work_type.category,
        surface_target: item.work_type.surface_target,
        contextual_questions: item.work_type.contextual_questions,
      },
      skill_level: item.skill_level,
      custom_params: item.custom_params,
    }));
  }

  @Get(':id/work-items')
  async getWorkItems(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('room', new ParseUUIDPipe({ optional: true })) roomId?: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    const items = await this.projectsService.getWorkItems(
      id,
      scope.organizationId,
      roomId,
    );
    return items.map((item) => ({
      id: item.id,
      work_type: {
        id: item.work_type.id,
        code: item.work_type.code,
        label_fr: item.work_type.label_fr,
        category: item.work_type.category,
        surface_target: item.work_type.surface_target,
        contextual_questions: item.work_type.contextual_questions,
      },
      skill_level: item.skill_level,
      custom_params: item.custom_params,
    }));
  }

  // ---------------------------------------------------------------------------
  // Pièces (ENG-2 Phase 2)
  // ---------------------------------------------------------------------------

  @Get(':id/rooms')
  async getRooms(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    const rooms = await this.projectsService.getRooms(id, scope.organizationId);
    return rooms.map((r) => this.mapRoom(r));
  }

  @Post(':id/rooms')
  async createRoom(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRoomDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    await this.projectsService.ensureProjectWritable(
      id,
      scope.organizationId,
      scope.effectiveTier,
    );
    const room = await this.projectsService.createRoom(
      id,
      scope.organizationId,
      dto,
    );
    return this.mapRoom(room);
  }

  @Patch(':id/rooms/:roomId')
  async renameRoom(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: UpdateRoomDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    await this.projectsService.ensureProjectWritable(
      id,
      scope.organizationId,
      scope.effectiveTier,
    );
    const room = await this.projectsService.renameRoom(
      id,
      scope.organizationId,
      roomId,
      dto,
    );
    return this.mapRoom(room);
  }

  @Delete(':id/rooms/:roomId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRoom(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    await this.projectsService.ensureProjectWritable(
      id,
      scope.organizationId,
      scope.effectiveTier,
    );
    await this.projectsService.deleteRoom(id, scope.organizationId, roomId);
  }

  private mapRoom(room: Room) {
    return {
      id: room.id,
      name: room.name,
      sort_order: room.sort_order,
      dimensions: room.dimensions
        ? {
            length_cm: room.dimensions.length_cm,
            width_cm: room.dimensions.width_cm,
            height_cm: room.dimensions.height_cm,
            segments: room.dimensions.segments_json ?? null,
            exclusions: room.dimensions.exclusions_json ?? [],
            source: room.dimensions.source,
            confidence_score: room.dimensions.confidence_score,
            length_cm_uncertainty: room.dimensions.length_cm_uncertainty,
            width_cm_uncertainty: room.dimensions.width_cm_uncertainty,
            height_cm_uncertainty: room.dimensions.height_cm_uncertainty,
          }
        : null,
      openings: (room.openings ?? []).map((o) => ({
        id: o.id,
        type: o.type,
        width_cm: o.width_cm,
        height_cm: o.height_cm,
        count: o.count,
      })),
      work_items: (room.workItems ?? []).map((wi) => ({
        id: wi.id,
        work_type: {
          id: wi.work_type.id,
          code: wi.work_type.code,
          label_fr: wi.work_type.label_fr,
          category: wi.work_type.category,
          surface_target: wi.work_type.surface_target,
          contextual_questions: wi.work_type.contextual_questions,
        },
        skill_level: wi.skill_level,
        custom_params: wi.custom_params,
      })),
    };
  }
}
