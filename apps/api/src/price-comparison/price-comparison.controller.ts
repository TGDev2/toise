import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { FeatureGateGuard } from '../feature-gates/guards/feature-gate.guard';
import { RequireFeature } from '../feature-gates/decorators/require-feature.decorator';
import { UsersService } from '../users/users.service';
import { PriceComparisonService } from './price-comparison.service';
import { ComparePricesRequestDto } from './dto/compare-prices-request.dto';
import { ApplySelectionsRequestDto } from './dto/apply-selections-request.dto';
import type { PriceComparisonResponseDto } from './dto/compare-prices-response.dto';

@Controller('projects')
@UseGuards(FirebaseAuthGuard)
export class PriceComparisonController {
  constructor(
    private readonly priceComparisonService: PriceComparisonService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveUserId(firebaseUser: DecodedIdToken): Promise<string> {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
    return user.id;
  }

  @Post(':id/shopping-list/compare-prices')
  @UseGuards(FeatureGateGuard)
  @RequireFeature('price_comparison')
  async comparePrices(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: ComparePricesRequestDto,
  ): Promise<PriceComparisonResponseDto> {
    const userId = await this.resolveUserId(firebaseUser);
    return this.priceComparisonService.comparePrices(
      projectId,
      userId,
      dto.postal_code,
    );
  }

  @Post(':id/shopping-list/compare-prices/apply')
  @UseGuards(FeatureGateGuard)
  @RequireFeature('price_comparison')
  async applySelections(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: ApplySelectionsRequestDto,
  ): Promise<{ applied: boolean }> {
    const userId = await this.resolveUserId(firebaseUser);
    await this.priceComparisonService.applySelections(
      projectId,
      userId,
      dto.selections,
    );
    return { applied: true };
  }
}
