import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { Project } from '../projects/entities/project.entity';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';
import { ProjectPhoto, PhotoStatus } from './entities/project-photo.entity';
import type { StorageProvider } from './storage/storage.interface';
import { STORAGE_PROVIDER } from './storage/storage.interface';
import { detectImageFormat } from './image-signature';

const MAX_PHOTOS_PER_PROJECT = 5;

// Causes de rejet qualité (CV-4). Tracées pour mesurer le plafond réel de la
// capture web : c'est le seul argument « caméra » recevable pour arbitrer MOB-2,
// ces quatre causes étant précisément ce qu'une capture native guidée corrigerait.
type PhotoRejectionReason =
  | 'too_small'
  | 'too_dark'
  | 'overexposed'
  | 'too_blurry';

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);
  private readonly allowedMimeTypes: string[];
  private readonly thumbnailWidth: number;
  private readonly minDimensionPx: number;
  private readonly minBrightness: number;
  private readonly maxBrightness: number;
  private readonly minSharpness: number;

  constructor(
    @InjectRepository(ProjectPhoto)
    private readonly photoRepo: Repository<ProjectPhoto>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @Inject(STORAGE_PROVIDER)
    private readonly storage: StorageProvider,
    private readonly configService: ConfigService,
    private readonly analytics: AnalyticsService,
  ) {
    this.allowedMimeTypes = this.configService.get<string[]>(
      'storage.allowedMimeTypes',
      ['image/jpeg', 'image/png', 'image/heic', 'image/heif'],
    );
    this.thumbnailWidth = this.configService.get<number>(
      'storage.thumbnailWidth',
      400,
    );
    this.minDimensionPx = this.configService.get<number>(
      'storage.minPhotoDimensionPx',
      480,
    );
    this.minBrightness = this.configService.get<number>(
      'storage.minPhotoBrightness',
      40,
    );
    this.maxBrightness = this.configService.get<number>(
      'storage.maxPhotoBrightness',
      235,
    );
    this.minSharpness = this.configService.get<number>(
      'storage.minPhotoSharpness',
      0.15,
    );
  }

  async uploadPhoto(
    projectId: string,
    userId: string,
    file: Express.Multer.File,
  ): Promise<ProjectPhoto> {
    await this.assertProjectOwnedByUser(projectId, userId);

    const count = await this.photoRepo.count({
      where: { project_id: projectId },
    });
    if (count >= MAX_PHOTOS_PER_PROJECT) {
      throw new BadRequestException(
        `Maximum ${MAX_PHOTOS_PER_PROJECT} photos par projet`,
      );
    }

    // Avant `sharp` : le filtre multer amont ne lit que l'en-tête Content-Type
    // déclaré par le client. Décoder d'abord reviendrait à laisser une suite
    // d'octets quelconque atteindre libjpeg/libpng/libheif. Cf. image-signature.ts.
    if (!detectImageFormat(file.buffer)) {
      throw new BadRequestException(
        'Fichier image invalide. Formats acceptes : JPEG, PNG, HEIC',
      );
    }

    const metadata = await this.readImageMetadata(file.buffer);
    const detectedMime = this.resolveMimeType(metadata.format);
    if (!this.allowedMimeTypes.includes(detectedMime)) {
      throw new BadRequestException(
        'Format non supporte. Formats acceptes : JPEG, PNG, HEIC',
      );
    }

    await this.assessImageQuality(file.buffer, metadata, userId);

    const fileId = randomUUID();
    const ext = this.resolveExtension(detectedMime);
    const storagePath = `${projectId}/${fileId}${ext}`;

    const storageUrl = await this.storage.save(
      file.buffer,
      storagePath,
      detectedMime,
    );

    const photo = this.photoRepo.create({
      project_id: projectId,
      storage_url: storageUrl,
      original_filename: file.originalname,
      mime_type: detectedMime,
      size_bytes: file.size,
      status: PhotoStatus.READY,
      sort_order: count,
    });

    const saved = await this.photoRepo.save(photo);

    this.generateThumbnail(saved.id, file.buffer, projectId, fileId).catch(
      (err: Error) =>
        this.logger.error(`Thumbnail generation failed: ${err.message}`),
    );

    return saved;
  }

  async getProjectPhotos(
    projectId: string,
    userId: string,
  ): Promise<ProjectPhoto[]> {
    await this.assertProjectOwnedByUser(projectId, userId);
    return this.photoRepo.find({
      where: { project_id: projectId },
      order: { sort_order: 'ASC', created_at: 'ASC' },
    });
  }

  async deletePhoto(
    projectId: string,
    userId: string,
    photoId: string,
  ): Promise<void> {
    await this.assertProjectOwnedByUser(projectId, userId);

    const photo = await this.photoRepo.findOne({
      where: { id: photoId, project_id: projectId },
    });
    if (!photo) {
      throw new NotFoundException('Photo non trouvee');
    }

    await this.storage.delete(photo.storage_url);
    if (photo.thumbnail_url) {
      await this.storage.delete(photo.thumbnail_url);
    }
    await this.photoRepo.remove(photo);
  }

  getFileAbsolutePath(storedPath: string): string {
    return this.storage.getAbsolutePath(storedPath);
  }

  async findPhotoForServing(
    projectId: string,
    userId: string,
    photoId: string,
  ): Promise<ProjectPhoto> {
    await this.assertProjectOwnedByUser(projectId, userId);

    const photo = await this.photoRepo.findOne({
      where: { id: photoId, project_id: projectId },
    });
    if (!photo) {
      throw new NotFoundException('Photo non trouvee');
    }
    return photo;
  }

  async findPhotoById(photoId: string): Promise<ProjectPhoto | null> {
    return this.photoRepo.findOne({ where: { id: photoId } });
  }

  private async assertProjectOwnedByUser(
    projectId: string,
    userId: string,
  ): Promise<void> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      select: ['id', 'user_id'],
    });
    if (!project) {
      throw new NotFoundException('Projet non trouve');
    }
    if (project.user_id !== userId) {
      throw new ForbiddenException('Acces interdit');
    }
  }

  private async readImageMetadata(buffer: Buffer): Promise<sharp.Metadata> {
    try {
      return await sharp(buffer).metadata();
    } catch {
      throw new BadRequestException(
        'Fichier image invalide. Formats acceptes : JPEG, PNG, HEIC',
      );
    }
  }

  private resolveMimeType(format?: string): string {
    const formatMap: Record<string, string> = {
      jpeg: 'image/jpeg',
      png: 'image/png',
      heif: 'image/heic',
    };
    return formatMap[format ?? ''] ?? `image/${format}`;
  }

  // Trace la cause puis lève : le message FR rendu à l'utilisateur est inchangé,
  // seule la mesure est ajoutée.
  private rejectPhoto(
    reason: PhotoRejectionReason,
    message: string,
    userId: string | null,
  ): never {
    this.analytics.track(AnalyticsEventName.PHOTO_QUALITY_REJECTED, userId, {
      reason,
    });
    throw new BadRequestException(message);
  }

  private async assessImageQuality(
    buffer: Buffer,
    metadata: sharp.Metadata,
    userId: string | null,
  ): Promise<void> {
    const { width = 0, height = 0 } = metadata;
    if (Math.min(width, height) < this.minDimensionPx) {
      this.rejectPhoto(
        'too_small',
        'Photo trop petite ou trop eloignee. Rapprochez-vous ou reprenez la photo en pleine resolution.',
        userId,
      );
    }

    let stats: sharp.Stats;
    try {
      stats = await sharp(buffer).greyscale().stats();
    } catch (err) {
      this.logger.warn(
        `Analyse qualite photo impossible, upload autorise par defaut: ${(err as Error).message}`,
      );
      return;
    }

    const brightness = stats.channels[0].mean;
    if (brightness < this.minBrightness) {
      this.rejectPhoto(
        'too_dark',
        'Photo trop sombre. Ajoutez de la lumiere ou evitez le contre-jour.',
        userId,
      );
    }
    if (brightness > this.maxBrightness) {
      this.rejectPhoto(
        'overexposed',
        'Photo surexposee. Evitez le flash direct et la lumiere trop forte.',
        userId,
      );
    }

    // stats.sharpness = metrique de nettete de libvips (Laplacien), documentee comme
    // "experimentale" par sharp -- reetalonner le seuil en cas de montee de version.
    if (stats.sharpness < this.minSharpness) {
      this.rejectPhoto(
        'too_blurry',
        "Photo trop floue. Stabilisez l'appareil et verifiez la mise au point avant de reprendre la photo.",
        userId,
      );
    }
  }

  private resolveExtension(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/heic': '.heic',
      'image/heif': '.heic',
    };
    return map[mime] ?? '.jpg';
  }

  private async generateThumbnail(
    photoId: string,
    buffer: Buffer,
    projectId: string,
    fileId: string,
  ): Promise<void> {
    try {
      const thumbBuffer = await sharp(buffer)
        .resize(this.thumbnailWidth)
        .jpeg({ quality: 80 })
        .toBuffer();

      const thumbPath = `${projectId}/thumb_${fileId}.jpg`;
      const thumbUrl = await this.storage.save(
        thumbBuffer,
        thumbPath,
        'image/jpeg',
      );

      await this.photoRepo.update(photoId, { thumbnail_url: thumbUrl });
    } catch (err) {
      this.logger.error(
        `Failed to generate thumbnail for photo ${photoId}: ${(err as Error).message}`,
      );
    }
  }
}
