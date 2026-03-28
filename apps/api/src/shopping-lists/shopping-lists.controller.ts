import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { ShoppingListsService } from './shopping-lists.service';
import { ShoppingListResponseDto } from './dto/shopping-list-response.dto';
import { UpdateShoppingListDto } from './dto/update-shopping-list.dto';

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
      throw new Error('User not found');
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
}
