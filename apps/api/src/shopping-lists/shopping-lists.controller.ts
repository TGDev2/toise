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
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { ShoppingListsService } from './shopping-lists.service';
import { ShoppingListResponseDto } from './dto/shopping-list-response.dto';
import { BudgetSummaryResponseDto } from './dto/budget-summary-response.dto';
import { EcoSuggestionsResponseDto } from './dto/eco-suggestions-response.dto';
import { UpdateShoppingListDto } from './dto/update-shopping-list.dto';
import { RequireFeature } from '../feature-gates/decorators/require-feature.decorator';
import { FeatureGateGuard } from '../feature-gates/guards/feature-gate.guard';

@Controller('projects')
@UseGuards(FirebaseAuthGuard)
export class ShoppingListsController {
  constructor(
    private readonly shoppingListsService: ShoppingListsService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveUserId(firebaseUser: DecodedIdToken): Promise<string> {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
    return user.id;
  }

  @Get(':id/shopping-list')
  async getOrGenerate(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<ShoppingListResponseDto> {
    const userId = await this.resolveUserId(firebaseUser);
    const { shoppingList, latestEstimationId } =
      await this.shoppingListsService.getOrGenerate(projectId, userId);
    return ShoppingListResponseDto.fromEntity(shoppingList, latestEstimationId);
  }

  @Patch(':id/shopping-list')
  async update(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateShoppingListDto,
  ): Promise<ShoppingListResponseDto> {
    const userId = await this.resolveUserId(firebaseUser);
    const { shoppingList, latestEstimationId } =
      await this.shoppingListsService.update(projectId, userId, dto);
    return ShoppingListResponseDto.fromEntity(shoppingList, latestEstimationId);
  }

  @Post(':id/shopping-list/regenerate')
  async regenerate(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<ShoppingListResponseDto> {
    const userId = await this.resolveUserId(firebaseUser);
    const { shoppingList, latestEstimationId } =
      await this.shoppingListsService.regenerate(projectId, userId);
    return ShoppingListResponseDto.fromEntity(shoppingList, latestEstimationId);
  }

  @Get(':id/shopping-list/budget-summary')
  @UseGuards(FeatureGateGuard)
  @RequireFeature('budget_tracking')
  async getBudgetSummary(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<BudgetSummaryResponseDto> {
    const userId = await this.resolveUserId(firebaseUser);
    const { summary, isFinalized } =
      await this.shoppingListsService.getBudgetSummary(projectId, userId);
    return BudgetSummaryResponseDto.fromSummary(summary, isFinalized);
  }

  @Get(':id/shopping-list/eco-suggestions')
  @UseGuards(FeatureGateGuard)
  @RequireFeature('eco_materials')
  async getEcoSuggestions(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<EcoSuggestionsResponseDto> {
    const userId = await this.resolveUserId(firebaseUser);
    const result = await this.shoppingListsService.getEcoSuggestions(
      projectId,
      userId,
    );
    return EcoSuggestionsResponseDto.fromResult(result);
  }

  @Post(':id/shopping-list/budget-summary/finalize')
  @UseGuards(FeatureGateGuard)
  @RequireFeature('budget_tracking')
  async finalizeBudgetSummary(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<BudgetSummaryResponseDto> {
    const userId = await this.resolveUserId(firebaseUser);
    const summary = await this.shoppingListsService.finalizeBudgetSummary(
      projectId,
      userId,
    );
    return BudgetSummaryResponseDto.fromSummary(summary);
  }
}
