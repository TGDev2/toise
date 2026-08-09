import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { UserContextService } from '../users/user-context.service';
import { RequireFeature } from '../feature-gates/decorators/require-feature.decorator';
import { FeatureGateGuard } from '../feature-gates/guards/feature-gate.guard';
import { CostBenchmarkService } from './cost-benchmark.service';
import { CostBenchmarkResponseDto } from './dto/cost-benchmark-response.dto';

/**
 * BACKLOG DATA-4 : « votre chantier coûte X % de moins que la médiane des
 * projets similaires ». La réponse ne contient que des agrégats déjà filtrés
 * par le k-anonymat au moment du calcul — aucune décision d'anonymat n'est
 * prise ici.
 */
@Controller('projects')
@UseGuards(FirebaseAuthGuard)
export class CostBenchmarkController {
  constructor(
    private readonly costBenchmarkService: CostBenchmarkService,
    private readonly userContext: UserContextService,
  ) {}

  @Get(':id/cost-benchmark')
  @UseGuards(FeatureGateGuard)
  @RequireFeature('cost_benchmark')
  async getForProject(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<CostBenchmarkResponseDto> {
    let scope;
    try {
      scope = await this.userContext.resolveForFirebaseUid(firebaseUser.uid);
    } catch {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }

    const benchmark = await this.costBenchmarkService.getForProject(
      projectId,
      scope.userId,
    );
    return CostBenchmarkResponseDto.fromBenchmark(benchmark);
  }
}
