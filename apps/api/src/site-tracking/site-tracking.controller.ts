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
import { OrgContextService } from '../organizations/org-context.service';
import type { OrgScope } from '../organizations/org-context.service';
import { SiteTrackingService } from './site-tracking.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';

@Controller('projects')
@UseGuards(FirebaseAuthGuard, FeatureGateGuard)
export class SiteTrackingController {
  constructor(
    private readonly siteTrackingService: SiteTrackingService,
    private readonly orgContext: OrgContextService,
  ) {}

  private async resolveScope(firebaseUser: DecodedIdToken): Promise<OrgScope> {
    try {
      return await this.orgContext.resolveForFirebaseUid(firebaseUser.uid);
    } catch {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
  }

  @Get(':id/milestones')
  @RequireFeature('site_tracking')
  async findAll(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.siteTrackingService.findAllForProject(
      projectId,
      scope.organizationId,
    );
  }

  @Post(':id/milestones')
  @RequireFeature('site_tracking')
  async create(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateMilestoneDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.siteTrackingService.create(
      projectId,
      scope.organizationId,
      dto,
    );
  }

  @Patch(':id/milestones/:milestoneId')
  @RequireFeature('site_tracking')
  async update(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.siteTrackingService.update(
      projectId,
      scope.organizationId,
      milestoneId,
      dto,
    );
  }

  @Delete(':id/milestones/:milestoneId')
  @RequireFeature('site_tracking')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    await this.siteTrackingService.remove(
      projectId,
      scope.organizationId,
      milestoneId,
    );
  }
}
