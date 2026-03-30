import {
  Controller,
  Post,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { AnalysisService } from './analysis.service';
import type {
  StartAnalysisResponseDto,
  AnalysisStatusDto,
} from './dto/analysis-status.dto';

@Controller('projects')
@UseGuards(FirebaseAuthGuard)
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveUserId(firebaseUser: DecodedIdToken): Promise<string> {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) {
      throw new Error('User not found');
    }
    return user.id;
  }

  @Post(':id/analyze')
  async startAnalysis(
    @Param('id', ParseUUIDPipe) projectId: string,
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
  ): Promise<StartAnalysisResponseDto> {
    const userId = await this.resolveUserId(firebaseUser);
    const job = await this.analysisService.startAnalysis(projectId, userId);
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
    const userId = await this.resolveUserId(firebaseUser);
    return this.analysisService.getJobStatus(projectId, userId, jobId);
  }
}
