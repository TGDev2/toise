import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { EstimationsService } from './estimations.service';
import { EstimateRequestDto } from './dto/estimate-request.dto';
import { EstimationResponseDto } from './dto/estimation-response.dto';

@Controller('projects')
@UseGuards(FirebaseAuthGuard)
export class EstimationsController {
  constructor(
    private readonly estimationsService: EstimationsService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveUserId(firebaseUser: DecodedIdToken): Promise<string> {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) {
      throw new Error('User not found');
    }
    return user.id;
  }

  @Post(':id/estimate')
  async estimate(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: EstimateRequestDto,
  ): Promise<EstimationResponseDto> {
    const userId = await this.resolveUserId(firebaseUser);
    const result = await this.estimationsService.estimate(
      projectId,
      userId,
      dto.skill_level,
    );
    return EstimationResponseDto.fromEntity(result);
  }

  @Get(':id/estimates/latest')
  async getLatest(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<EstimationResponseDto> {
    const userId = await this.resolveUserId(firebaseUser);
    const result = await this.estimationsService.getLatest(projectId, userId);
    return EstimationResponseDto.fromEntity(result);
  }

  @Get(':id/estimates')
  async getHistory(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<EstimationResponseDto[]> {
    const userId = await this.resolveUserId(firebaseUser);
    const results = await this.estimationsService.getHistory(projectId, userId);
    return results.map(EstimationResponseDto.fromEntity);
  }
}
