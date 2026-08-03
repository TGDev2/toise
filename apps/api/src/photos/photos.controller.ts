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
import { RegisteredAccountGuard } from '../auth/guards/registered-account.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { RequiresRegisteredAccount } from '../auth/decorators/requires-registered-account.decorator';
import { OrgContextService } from '../organizations/org-context.service';
import type { OrgScope } from '../organizations/org-context.service';
import { PhotosService } from './photos.service';
import { PhotoResponseDto } from './dto/photo-response.dto';
import { ProjectPhoto } from './entities/project-photo.entity';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];

/**
 * Motifs de route, partagés entre les décorateurs et la sérialisation du DTO.
 *
 * Le DTO annonçait `/photos/file/<projet>/<photo>`, un chemin qui n'a jamais
 * existé côté serveur : les routes vivent sous le préfixe `projects`. Recopier
 * l'URL à la main dans le DTO, c'est accepter qu'elle diverge au premier
 * renommage — et personne ne le voit, puisque rien ne relie les deux chaînes.
 * Ici, un renommage de route change l'URL sérialisée par construction.
 */
const PHOTOS_ROUTE_PREFIX = 'projects';
const PHOTO_FILE_ROUTE = ':projectId/photos/:photoId/file';
const PHOTO_THUMBNAIL_ROUTE = ':projectId/photos/:photoId/thumbnail';

function buildPhotoUrl(
  route: string,
  projectId: string,
  photoId: string,
): string {
  return `/${PHOTOS_ROUTE_PREFIX}/${route}`
    .replace(':projectId', projectId)
    .replace(':photoId', photoId);
}

/**
 * Premier tri, sur le `Content-Type` **déclaré** par le client dans la partie
 * multipart. Il ne dit rien du contenu et n'est pas la validation : celle-ci se
 * fait dans `PhotosService.uploadPhoto`, d'abord par les octets d'en-tête
 * (`detectImageFormat`), puis par le décodage `sharp` dont le `format` constaté
 * est ce qui finit en base. Ce filtre ne sert qu'à écarter tôt, et à moindre
 * coût, ce qui ne prétend même pas être une image.
 */
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

@Controller(PHOTOS_ROUTE_PREFIX)
@UseGuards(FirebaseAuthGuard, RegisteredAccountGuard)
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
      url: buildPhotoUrl(PHOTO_FILE_ROUTE, photo.project_id, photo.id),
      thumbnail_url: photo.thumbnail_url
        ? buildPhotoUrl(PHOTO_THUMBNAIL_ROUTE, photo.project_id, photo.id)
        : null,
      created_at: photo.created_at,
    };
  }

  /**
   * Seule route de ce contrôleur réservée aux comptes inscrits : elle est la
   * seule à consommer du stockage durable, et l'analyse photo qu'elle alimente
   * (`cv_analysis`) est de toute façon hors de portée d'un compte gratuit.
   * Le parcours invité passe déjà à côté de l'étape photo
   * (`photos/page.tsx` redirige vers `dimensions`) : la borne serveur ne fait
   * qu'écrire ce que l'interface tenait seule.
   */
  @Post(':id/photos')
  @RequiresRegisteredAccount()
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

  @Get(PHOTO_FILE_ROUTE)
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

  @Get(PHOTO_THUMBNAIL_ROUTE)
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
