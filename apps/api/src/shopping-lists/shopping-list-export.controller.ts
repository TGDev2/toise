import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { ProjectsService } from '../projects/projects.service';
import { ShoppingListsService } from './shopping-lists.service';
import { ShoppingListExportService } from './shopping-list-export.service';

@Controller('projects')
@UseGuards(FirebaseAuthGuard)
export class ShoppingListExportController {
  constructor(
    private readonly shoppingListsService: ShoppingListsService,
    private readonly exportService: ShoppingListExportService,
    private readonly projectsService: ProjectsService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  private async resolveUserId(firebaseUser: DecodedIdToken): Promise<string> {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) {
      throw new Error('User not found');
    }
    return user.id;
  }

  @Get(':id/shopping-list/export/pdf')
  async exportPdf(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Res() res: Response,
  ): Promise<void> {
    const userId = await this.resolveUserId(firebaseUser);
    const { shoppingList } = await this.shoppingListsService.getOrGenerate(
      projectId,
      userId,
    );
    const project = await this.projectsService.findOneByUser(projectId, userId);

    const buffer = await this.exportService.generatePdf(
      project,
      shoppingList.items_json,
    );

    const safeName =
      project.name.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').trim() || 'liste';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="liste-courses-${safeName}.pdf"`,
    );
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  @Post(':id/shopping-list/share')
  async createShareLink(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<{ share_url: string; share_token: string }> {
    const userId = await this.resolveUserId(firebaseUser);
    const { share_token } = await this.shoppingListsService.generateShareToken(
      projectId,
      userId,
    );
    const publicUrl = this.configService.get<string>('publicUrl');
    return {
      share_url: `${publicUrl}/shared/shopping-list/${share_token}`,
      share_token,
    };
  }

  @Delete(':id/shopping-list/share')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeShareLink(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<void> {
    const userId = await this.resolveUserId(firebaseUser);
    await this.shoppingListsService.revokeShareToken(projectId, userId);
  }
}
