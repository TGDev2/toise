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
import { Throttle } from '@nestjs/throttler';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { isGuestToken } from '../auth/guest-token';
import { UserContextService } from '../users/user-context.service';
import type { UserScope } from '../users/user-context.service';
import { EstimationsService } from './estimations.service';
import { EstimateRequestDto } from './dto/estimate-request.dto';
import { EstimationResponseDto } from './dto/estimation-response.dto';

@Controller('projects')
@UseGuards(FirebaseAuthGuard)
export class EstimationsController {
  constructor(
    private readonly estimationsService: EstimationsService,
    private readonly userContext: UserContextService,
  ) {}

  private async resolveScope(firebaseUser: DecodedIdToken): Promise<UserScope> {
    try {
      return await this.userContext.resolveForFirebaseUid(firebaseUser.uid);
    } catch {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
  }

  /**
   * Le calcul le moins cher à déclencher et le plus cher à servir : lecture de
   * toutes les pièces, du catalogue matériaux et des conditionnements, puis une
   * ligne persistée. Rien sous `/projects/**` ne portait de plafond propre —
   * tout héritait des 100 req/min globaux (E2-1).
   *
   * 30/min laisse passer un utilisateur qui compare les trois niveaux de
   * compétence et corrige ses dimensions dans la foulée ; le plafond par compte
   * (`GUEST_ESTIMATION_LIMIT`) prend le relais là où l'IP ne dit plus rien.
   */
  @Post(':id/estimate')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async estimate(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: EstimateRequestDto,
  ): Promise<EstimationResponseDto> {
    const scope = await this.resolveScope(firebaseUser);
    const result = await this.estimationsService.estimate(
      projectId,
      scope.userId,
      dto.skill_level,
      isGuestToken(firebaseUser),
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
      scope.userId,
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
      scope.userId,
    );
    return results.map((result) => EstimationResponseDto.fromEntity(result));
  }
}
