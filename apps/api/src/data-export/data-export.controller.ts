import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import type { Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { UsersService } from '../users/users.service';
import { DataExportService } from './data-export.service';
import { DataExportStatus } from './entities/data-export-request.entity';

/**
 * Sous `auth/me`, à côté de `DELETE /auth/me` (suppression de compte) :
 * même espace de route, module séparé (`AuthController` porte déjà
 * register/sync/forgot-password/merge-guest/delete, cf. `data-export.module.ts`).
 */
@Controller('auth/me/export')
@UseGuards(FirebaseAuthGuard)
export class DataExportController {
  constructor(
    private readonly usersService: UsersService,
    private readonly dataExportService: DataExportService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async requestExport(@CurrentFirebaseUser() firebaseUser: DecodedIdToken) {
    const user = await this.requireUser(firebaseUser);
    const request = await this.dataExportService.requestExport(user.id);
    return this.toStatusResponse(request);
  }

  @Get(':id')
  async getStatus(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id') id: string,
  ) {
    const user = await this.requireUser(firebaseUser);
    const request = await this.dataExportService.getForUser(user.id, id);
    // 404 et non 403 sur une demande d'un autre compte : ne pas confirmer
    // qu'un identifiant donné existe pour quelqu'un d'autre.
    if (!request) {
      throw new NotFoundException("Demande d'export introuvable");
    }
    return this.toStatusResponse(request);
  }

  @Get(':id/download')
  async download(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const user = await this.requireUser(firebaseUser);
    const request = await this.dataExportService.getForUser(user.id, id);

    if (
      !request ||
      request.status !== DataExportStatus.READY ||
      !request.file_path ||
      (request.expires_at && request.expires_at.getTime() < Date.now())
    ) {
      throw new NotFoundException("Archive d'export introuvable ou expirée");
    }

    const absolutePath = this.dataExportService.getAbsolutePath(
      request.file_path,
    );
    if (!existsSync(absolutePath)) {
      throw new NotFoundException("Archive d'export introuvable ou expirée");
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="chiffreo-export-${request.id}.zip"`,
    );
    createReadStream(absolutePath).pipe(res);
  }

  private async requireUser(firebaseUser: DecodedIdToken) {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  private toStatusResponse(request: {
    id: string;
    status: DataExportStatus;
    requested_at: Date;
    completed_at: Date | null;
    expires_at: Date | null;
    file_size_bytes: string | null;
    error_message: string | null;
  }) {
    return {
      id: request.id,
      status: request.status,
      requested_at: request.requested_at,
      completed_at: request.completed_at,
      expires_at: request.expires_at,
      file_size_bytes: request.file_size_bytes,
      error_message: request.error_message,
    };
  }
}
