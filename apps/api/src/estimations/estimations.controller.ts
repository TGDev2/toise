import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { OrgContextService } from '../organizations/org-context.service';
import type { OrgScope } from '../organizations/org-context.service';
import { EstimationsService } from './estimations.service';
import { EstimateRequestDto } from './dto/estimate-request.dto';
import { EstimationResponseDto } from './dto/estimation-response.dto';

@Controller('projects')
@UseGuards(FirebaseAuthGuard)
export class EstimationsController {
  constructor(
    private readonly estimationsService: EstimationsService,
    private readonly orgContext: OrgContextService,
  ) {}

  private async resolveScope(firebaseUser: DecodedIdToken): Promise<OrgScope> {
    try {
      return await this.orgContext.resolveForFirebaseUid(firebaseUser.uid);
    } catch {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
  }

  @Post(':id/estimate')
  async estimate(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: EstimateRequestDto,
  ): Promise<EstimationResponseDto> {
    const scope = await this.resolveScope(firebaseUser);
    const result = await this.estimationsService.estimate(
      projectId,
      scope.organizationId,
      scope.userId,
      dto.skill_level,
    );
    return EstimationResponseDto.fromEntity(result);
  }

  @Get(':id/estimates/latest')
  async getLatest(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<EstimationResponseDto> {
    const scope = await this.resolveScope(firebaseUser);
    const result = await this.estimationsService.getLatest(
      projectId,
      scope.organizationId,
    );
    return EstimationResponseDto.fromEntity(result);
  }

  @Get(':id/estimates')
  async getHistory(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<EstimationResponseDto[]> {
    const scope = await this.resolveScope(firebaseUser);
    const results = await this.estimationsService.getHistory(
      projectId,
      scope.organizationId,
    );
    return results.map((result) => EstimationResponseDto.fromEntity(result));
  }
}
