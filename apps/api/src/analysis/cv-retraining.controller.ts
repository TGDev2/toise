import {
  Controller,
  Get,
  NotFoundException,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PhotosService } from '../photos/photos.service';
import {
  CvRetrainingService,
  CvRetrainingExport,
} from './cv-retraining.service';
import {
  CvRetrainingExportQueryDto,
  CvRetrainingPhotoQueryDto,
} from './dto/cv-retraining-query.dto';

@Controller('admin/cv-retraining')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class CvRetrainingController {
  constructor(
    private readonly cvRetrainingService: CvRetrainingService,
    private readonly photosService: PhotosService,
  ) {}

  @Get('export')
  async export(
    @Query() query: CvRetrainingExportQueryDto,
  ): Promise<CvRetrainingExport> {
    return this.cvRetrainingService.buildExport(
      query.since ? new Date(query.since) : undefined,
      query.limit,
    );
  }

  // Sert une photo par storage_url pour le builder de dataset (admin,
  // cross-projet). Le chemin résolu vient TOUJOURS de la ligne DB retrouvée
  // par match exact — jamais du paramètre brut (anti path-traversal).
  @Get('photo')
  async servePhoto(
    @Query() query: CvRetrainingPhotoQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const photo = await this.photosService.findByStorageUrl(query.path);
    if (!photo) {
      throw new NotFoundException('Photo non trouvee');
    }

    const filePath = this.photosService.getFileAbsolutePath(photo.storage_url);
    if (!existsSync(filePath)) {
      res.status(404).json({ message: 'Fichier introuvable' });
      return;
    }

    res.setHeader('Content-Type', photo.mime_type);
    res.setHeader('Cache-Control', 'no-store');
    createReadStream(filePath).pipe(res);
  }
}
