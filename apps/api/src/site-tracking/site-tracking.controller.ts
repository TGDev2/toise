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
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { FeatureGateGuard } from '../feature-gates/guards/feature-gate.guard';
import { RequireFeature } from '../feature-gates/decorators/require-feature.decorator';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { SiteTrackingService } from './site-tracking.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';

@Controller('projects')
@UseGuards(FirebaseAuthGuard, FeatureGateGuard)
export class SiteTrackingController {
  constructor(
    private readonly siteTrackingService: SiteTrackingService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveUserId(firebaseUser: DecodedIdToken): Promise<string> {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) {
      throw new UnauthorizedException('Utilisateur non authentifie.');
    }
    return user.id;
  }

  @Get(':id/milestones')
  @RequireFeature('site_tracking')
  async findAll(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    return this.siteTrackingService.findAllForProject(projectId, userId);
  }

  @Post(':id/milestones')
  @RequireFeature('site_tracking')
  async create(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateMilestoneDto,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    return this.siteTrackingService.create(projectId, userId, dto);
  }

  @Patch(':id/milestones/:milestoneId')
  @RequireFeature('site_tracking')
  async update(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    return this.siteTrackingService.update(projectId, userId, milestoneId, dto);
  }

  @Delete(':id/milestones/:milestoneId')
  @RequireFeature('site_tracking')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    await this.siteTrackingService.remove(projectId, userId, milestoneId);
  }
}
