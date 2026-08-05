import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Throttle } from '@nestjs/throttler';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { OrgContextService } from '../organizations/org-context.service';
import type { OrgScope } from '../organizations/org-context.service';
import { ShoppingListsService } from './shopping-lists.service';
import { ShoppingListResponseDto } from './dto/shopping-list-response.dto';
import { BudgetSummaryResponseDto } from './dto/budget-summary-response.dto';
import { EcoSuggestionsResponseDto } from './dto/eco-suggestions-response.dto';
import { KnownPricesResponseDto } from './dto/known-prices-response.dto';
import { UpdateShoppingListDto } from './dto/update-shopping-list.dto';
import { CloseoutRequestDto, CloseoutResponseDto } from './dto/closeout.dto';
import { RequireFeature } from '../feature-gates/decorators/require-feature.decorator';
import { FeatureGateGuard } from '../feature-gates/guards/feature-gate.guard';

@Controller('projects')
@UseGuards(FirebaseAuthGuard)
export class ShoppingListsController {
  constructor(
    private readonly shoppingListsService: ShoppingListsService,
    private readonly orgContext: OrgContextService,
  ) {}

  private async resolveScope(firebaseUser: DecodedIdToken): Promise<OrgScope> {
    try {
      return await this.orgContext.resolveForFirebaseUid(firebaseUser.uid);
    } catch {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
  }

  @Get(':id/shopping-list')
  async getOrGenerate(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<ShoppingListResponseDto> {
    const scope = await this.resolveScope(firebaseUser);
    const { shoppingList, latestEstimationId } =
      await this.shoppingListsService.getOrGenerate(
        projectId,
        scope.organizationId,
        scope.userId,
      );
    return ShoppingListResponseDto.fromEntity(shoppingList, latestEstimationId);
  }

  @Patch(':id/shopping-list')
  async update(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateShoppingListDto,
  ): Promise<ShoppingListResponseDto> {
    const scope = await this.resolveScope(firebaseUser);
    const { shoppingList, latestEstimationId } =
      await this.shoppingListsService.update(
        projectId,
        scope.organizationId,
        dto,
      );
    return ShoppingListResponseDto.fromEntity(shoppingList, latestEstimationId);
  }

  /**
   * Rejoue la liste depuis la dernière estimation : plus léger que le moteur,
   * mais réécrit intégralement la liste et ses lignes à chaque appel. 15/min
   * couvre largement l'usage réel — on ne régénère qu'après avoir changé
   * quelque chose en amont (E2-1).
   */
  @Post(':id/shopping-list/regenerate')
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  async regenerate(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<ShoppingListResponseDto> {
    const scope = await this.resolveScope(firebaseUser);
    const { shoppingList, latestEstimationId } =
      await this.shoppingListsService.regenerate(
        projectId,
        scope.organizationId,
        scope.userId,
      );
    return ShoppingListResponseDto.fromEntity(shoppingList, latestEstimationId);
  }

  @Get(':id/shopping-list/budget-summary')
  @UseGuards(FeatureGateGuard)
  @RequireFeature('budget_tracking')
  async getBudgetSummary(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<BudgetSummaryResponseDto> {
    const scope = await this.resolveScope(firebaseUser);
    const { summary, isFinalized } =
      await this.shoppingListsService.getBudgetSummary(
        projectId,
        scope.organizationId,
      );
    return BudgetSummaryResponseDto.fromSummary(summary, isFinalized);
  }

  /**
   * E4-4 — dernier prix relevé par l'organisation pour chaque article.
   *
   * Même gate que la saisie qu'elle alimente (`budget_tracking`) : proposer un
   * rappel de prix à qui ne peut pas saisir de prix n'aurait pas de sens.
   */
  @Get(':id/shopping-list/known-prices')
  @UseGuards(FeatureGateGuard)
  @RequireFeature('budget_tracking')
  async getKnownPrices(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<KnownPricesResponseDto> {
    const scope = await this.resolveScope(firebaseUser);
    const result = await this.shoppingListsService.findKnownPrices(
      projectId,
      scope.organizationId,
    );
    return KnownPricesResponseDto.fromResult(result);
  }

  @Get(':id/shopping-list/eco-suggestions')
  @UseGuards(FeatureGateGuard)
  @RequireFeature('eco_materials')
  async getEcoSuggestions(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<EcoSuggestionsResponseDto> {
    const scope = await this.resolveScope(firebaseUser);
    const result = await this.shoppingListsService.getEcoSuggestions(
      projectId,
      scope.organizationId,
    );
    return EcoSuggestionsResponseDto.fromResult(result);
  }

  /**
   * DATA-5 — gate `project_closeout`, palier **free** et non `budget_tracking`.
   * La clôture est l'unique source de DATA-3, DATA-4, COM-1 et PLAT-1 :
   * derrière un palier payant, le volant de données ne tourne que sur les
   * abonnés, c'est-à-dire à peu près jamais.
   */
  @Get(':id/shopping-list/closeout')
  @UseGuards(FeatureGateGuard)
  @RequireFeature('project_closeout')
  async getCloseout(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<CloseoutResponseDto> {
    const scope = await this.resolveScope(firebaseUser);
    const { closeout, budgetSummary, isFinalized } =
      await this.shoppingListsService.getCloseout(
        projectId,
        scope.organizationId,
      );
    return CloseoutResponseDto.from(closeout, budgetSummary, isFinalized);
  }

  @Post(':id/shopping-list/closeout')
  @UseGuards(FeatureGateGuard)
  @RequireFeature('project_closeout')
  async recordCloseout(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: CloseoutRequestDto,
  ): Promise<CloseoutResponseDto> {
    const scope = await this.resolveScope(firebaseUser);
    const { closeout, budgetSummary, isFinalized } =
      await this.shoppingListsService.recordCloseout(
        projectId,
        scope.organizationId,
        scope.userId,
        dto,
      );
    return CloseoutResponseDto.from(closeout, budgetSummary, isFinalized);
  }

  @Post(':id/shopping-list/budget-summary/finalize')
  @UseGuards(FeatureGateGuard)
  @RequireFeature('budget_tracking')
  async finalizeBudgetSummary(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<BudgetSummaryResponseDto> {
    const scope = await this.resolveScope(firebaseUser);
    const summary = await this.shoppingListsService.finalizeBudgetSummary(
      projectId,
      scope.organizationId,
      scope.userId,
    );
    return BudgetSummaryResponseDto.fromSummary(summary);
  }
}
