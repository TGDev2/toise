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
  UnauthorizedException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { OrgContextService } from '../organizations/org-context.service';
import type { OrgScope } from '../organizations/org-context.service';
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
    private readonly orgContext: OrgContextService,
    private readonly configService: ConfigService,
  ) {}

  private async resolveScope(firebaseUser: DecodedIdToken): Promise<OrgScope> {
    try {
      return await this.orgContext.resolveForFirebaseUid(firebaseUser.uid);
    } catch {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
  }

  @Get(':id/shopping-list/export/pdf')
  async exportPdf(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Res() res: Response,
  ): Promise<void> {
    const scope = await this.resolveScope(firebaseUser);
    const { shoppingList } = await this.shoppingListsService.getOrGenerate(
      projectId,
      scope.organizationId,
      scope.userId,
    );
    const project = await this.projectsService.findOneForOrg(
      projectId,
      scope.organizationId,
    );

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
  ): Promise<{ share_url: string; share_token: string; expires_at: string }> {
    const scope = await this.resolveScope(firebaseUser);
    // `expires_at` remonte jusqu'à l'interface : un lien qui expire sans que son
    // émetteur sache quand est un lien qu'on croit fermé ou qu'on croit ouvert,
    // au hasard.
    const { share_token, expires_at } =
      await this.shoppingListsService.generateShareToken(
        projectId,
        scope.organizationId,
      );
    const publicUrl = this.configService.get<string>('publicUrl');
    return {
      share_url: `${publicUrl}/shared/shopping-list/${share_token}`,
      share_token,
      expires_at,
    };
  }

  @Delete(':id/shopping-list/share')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeShareLink(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<void> {
    const scope = await this.resolveScope(firebaseUser);
    await this.shoppingListsService.revokeShareToken(
      projectId,
      scope.organizationId,
    );
  }
}
