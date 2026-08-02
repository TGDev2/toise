import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { OrgContextService } from '../organizations/org-context.service';
import type { OrgScope } from '../organizations/org-context.service';
import { PhotosService } from './photos.service';
import { PhotoResponseDto } from './dto/photo-response.dto';
import { ProjectPhoto } from './entities/project-photo.entity';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];

function mimeFilter(
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestException(
        'Format non supporte. Formats acceptes : JPEG, PNG, HEIC',
      ),
      false,
    );
  }
}

@Controller('projects')
@UseGuards(FirebaseAuthGuard)
export class PhotosController {
  constructor(
    private readonly photosService: PhotosService,
    private readonly orgContext: OrgContextService,
  ) {}

  private async resolveScope(firebaseUser: DecodedIdToken): Promise<OrgScope> {
    try {
      return await this.orgContext.resolveForFirebaseUid(firebaseUser.uid);
    } catch {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
  }

  private toDto(photo: ProjectPhoto): PhotoResponseDto {
    return {
      id: photo.id,
      original_filename: photo.original_filename,
      mime_type: photo.mime_type,
      size_bytes: photo.size_bytes,
      status: photo.status,
      sort_order: photo.sort_order,
      url: `/photos/file/${photo.project_id}/${photo.id}`,
      thumbnail_url: photo.thumbnail_url
        ? `/photos/file/${photo.project_id}/${photo.id}/thumbnail`
        : null,
      created_at: photo.created_at,
    };
  }

  @Post(':id/photos')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: mimeFilter,
    }),
  )
  async upload(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<PhotoResponseDto> {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }
    const scope = await this.resolveScope(firebaseUser);
    const photo = await this.photosService.uploadPhoto(
      projectId,
      scope.organizationId,
      file,
      scope.userId,
    );
    return this.toDto(photo);
  }

  @Get(':id/photos')
  async list(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<PhotoResponseDto[]> {
    const scope = await this.resolveScope(firebaseUser);
    const photos = await this.photosService.getProjectPhotos(
      projectId,
      scope.organizationId,
    );
    return photos.map((p) => this.toDto(p));
  }

  @Delete(':id/photos/:photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ): Promise<void> {
    const scope = await this.resolveScope(firebaseUser);
    await this.photosService.deletePhoto(
      projectId,
      scope.organizationId,
      photoId,
    );
  }

  @Get(':projectId/photos/:photoId/file')
  async servePhoto(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Res() res: Response,
  ): Promise<void> {
    const scope = await this.resolveScope(firebaseUser);
    const photo = await this.photosService.findPhotoForServing(
      projectId,
      scope.organizationId,
      photoId,
    );

    const filePath = this.photosService.getFileAbsolutePath(photo.storage_url);
    if (!existsSync(filePath)) {
      res.status(404).json({ message: 'Fichier introuvable' });
      return;
    }

    res.setHeader('Content-Type', photo.mime_type);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    createReadStream(filePath).pipe(res);
  }

  @Get(':projectId/photos/:photoId/thumbnail')
  async serveThumbnail(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Res() res: Response,
  ): Promise<void> {
    const scope = await this.resolveScope(firebaseUser);
    const photo = await this.photosService.findPhotoForServing(
      projectId,
      scope.organizationId,
      photoId,
    );

    if (!photo.thumbnail_url) {
      res.status(404).json({ message: 'Miniature non disponible' });
      return;
    }

    const filePath = this.photosService.getFileAbsolutePath(
      photo.thumbnail_url,
    );
    if (!existsSync(filePath)) {
      res.status(404).json({ message: 'Fichier introuvable' });
      return;
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    createReadStream(filePath).pipe(res);
  }
}
