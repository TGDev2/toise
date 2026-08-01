import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseUUIDPipe,
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
import { AnalysisService } from './analysis.service';
import { StartAnalysisRequestDto } from './dto/start-analysis-request.dto';
import type {
  StartAnalysisResponseDto,
  AnalysisStatusDto,
} from './dto/analysis-status.dto';

@Controller('projects')
@UseGuards(FirebaseAuthGuard)
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly orgContext: OrgContextService,
  ) {}

  private async resolveScope(firebaseUser: DecodedIdToken): Promise<OrgScope> {
    try {
      return await this.orgContext.resolveForFirebaseUid(firebaseUser.uid);
    } catch {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
  }

  @Post(':id/analyze')
  @UseGuards(FeatureGateGuard)
  @RequireFeature('cv_analysis')
  async startAnalysis(
    @Param('id', ParseUUIDPipe) projectId: string,
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() body: StartAnalysisRequestDto = {},
  ): Promise<StartAnalysisResponseDto> {
    const scope = await this.resolveScope(firebaseUser);
    const job = await this.analysisService.startAnalysis(
      projectId,
      scope.organizationId,
      body.reference_object,
    );
    return {
      job_id: job.id,
      status: job.status,
    };
  }

  @Get(':id/analyze/:jobId/status')
  async getJobStatus(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
  ): Promise<AnalysisStatusDto> {
    const scope = await this.resolveScope(firebaseUser);
    return this.analysisService.getJobStatus(
      projectId,
      scope.organizationId,
      jobId,
    );
  }
}
