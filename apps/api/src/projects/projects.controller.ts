import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateDimensionsDto } from './dto/update-dimensions.dto';
import { CreateOpeningDto } from './dto/create-opening.dto';
import { UpdateOpeningDto } from './dto/update-opening.dto';
import { SaveWorkItemsDto } from './dto/save-work-items.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';

@Controller('projects')
@UseGuards(FirebaseAuthGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveUserId(firebaseUser: DecodedIdToken): Promise<string> {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) {
      throw new Error('User not found');
    }
    return user.id;
  }

  @Post()
  async create(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: CreateProjectDto,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    const project = await this.projectsService.createProject(userId, dto);
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
    const userId = await this.resolveUserId(firebaseUser);
    const { data, meta } = await this.projectsService.findByUser(userId, query);
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
    const userId = await this.resolveUserId(firebaseUser);
    await this.projectsService.softDeleteProject(id, userId);
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
    const userId = await this.resolveUserId(firebaseUser);
    const project = await this.projectsService.findOneByUser(id, userId);
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
      created_at: project.created_at,
      updated_at: project.updated_at,
    };
  }

  @Put(':id/dimensions')
  async updateDimensions(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDimensionsDto,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    const dimensions = await this.projectsService.updateDimensions(
      id,
      userId,
      dto,
    );
    return {
      length_cm: dimensions.length_cm,
      width_cm: dimensions.width_cm,
      height_cm: dimensions.height_cm,
      source: dimensions.source,
      confidence_score: dimensions.confidence_score,
    };
  }

  @Get(':id/dimensions')
  async getDimensions(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    const dimensions = await this.projectsService.getDimensions(id, userId);
    if (!dimensions) {
      return null;
    }
    return {
      length_cm: dimensions.length_cm,
      width_cm: dimensions.width_cm,
      height_cm: dimensions.height_cm,
      source: dimensions.source,
      confidence_score: dimensions.confidence_score,
    };
  }

  @Post(':id/openings')
  async addOpening(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateOpeningDto,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    const opening = await this.projectsService.addOpening(id, userId, dto);
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
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    const openings = await this.projectsService.getOpenings(id, userId);
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
    const userId = await this.resolveUserId(firebaseUser);
    const opening = await this.projectsService.updateOpening(
      id,
      userId,
      openingId,
      dto,
    );
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
    const userId = await this.resolveUserId(firebaseUser);
    await this.projectsService.removeOpening(id, userId, openingId);
  }

  @Post(':id/work-items')
  async saveWorkItems(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveWorkItemsDto,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    const items = await this.projectsService.saveWorkItems(id, userId, dto);
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
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    const items = await this.projectsService.getWorkItems(id, userId);
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
}
