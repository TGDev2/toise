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
import { FeatureGateGuard } from '../feature-gates/guards/feature-gate.guard';
import { RequireFeature } from '../feature-gates/decorators/require-feature.decorator';
import { OrgContextService } from '../organizations/org-context.service';
import type { OrgScope } from '../organizations/org-context.service';
import { PriceComparisonService } from './price-comparison.service';
import { ComparePricesRequestDto } from './dto/compare-prices-request.dto';
import { ApplySelectionsRequestDto } from './dto/apply-selections-request.dto';
import type { PriceComparisonResponseDto } from './dto/compare-prices-response.dto';
import type { BuyLinksResponseDto } from './dto/buy-links-response.dto';

@Controller('projects')
@UseGuards(FirebaseAuthGuard)
export class PriceComparisonController {
  constructor(
    private readonly priceComparisonService: PriceComparisonService,
    private readonly orgContext: OrgContextService,
  ) {}

  private async resolveScope(firebaseUser: DecodedIdToken): Promise<OrgScope> {
    try {
      return await this.orgContext.resolveForFirebaseUid(firebaseUser.uid);
    } catch {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
  }

  @Get(':id/shopping-list/buy-links')
  async getBuyLinks(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<BuyLinksResponseDto> {
    const scope = await this.resolveScope(firebaseUser);
    const links = await this.priceComparisonService.getBuyLinks(
      projectId,
      scope.organizationId,
      scope.userId,
    );
    return { links };
  }

  @Post(':id/shopping-list/compare-prices')
  @UseGuards(FeatureGateGuard)
  @RequireFeature('price_comparison')
  async comparePrices(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: ComparePricesRequestDto,
  ): Promise<PriceComparisonResponseDto> {
    const scope = await this.resolveScope(firebaseUser);
    return this.priceComparisonService.comparePrices(
      projectId,
      scope.organizationId,
      scope.userId,
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
    const scope = await this.resolveScope(firebaseUser);
    await this.priceComparisonService.applySelections(
      projectId,
      scope.organizationId,
      scope.userId,
      dto.selections,
    );
    return { applied: true };
  }
}
