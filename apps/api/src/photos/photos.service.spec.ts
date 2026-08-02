import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PhotosService } from './photos.service';
import { ProjectPhoto, PhotoStatus } from './entities/project-photo.entity';
import {
  Project,
  ProjectStatus,
  WorkType,
} from '../projects/entities/project.entity';
import { STORAGE_PROVIDER } from './storage/storage.interface';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';
import sharp from 'sharp';

jest.mock('sharp', () => {
  const mockInstance = {
    metadata: jest
      .fn()
      .mockResolvedValue({ format: 'jpeg', width: 1000, height: 800 }),
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('thumb')),
    greyscale: jest.fn().mockReturnThis(),
    stats: jest.fn().mockResolvedValue({
      channels: [{ mean: 130 }],
      sharpness: 2.5,
    }),
  };
  const mockSharp = jest.fn(() => mockInstance);
  Object.assign(mockSharp, { default: mockSharp });
  return { __esModule: true, default: mockSharp };
});

const mockSharpInstance = (sharp as unknown as jest.Mock)() as {
  metadata: jest.Mock;
  stats: jest.Mock;
};

const mockProject: Project = {
  id: 'project-uuid',
  user_id: 'author-uuid',
  organization_id: 'org-uuid',
  name: 'Test Project',
  room_name: 'Salon',
  work_type: WorkType.PAINTING,
  status: ProjectStatus.DRAFT,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  user: null as never,
  dimensions: null,
  openings: [],
  workItems: [],
  photos: [],
};

const mockPhoto: ProjectPhoto = {
  id: 'photo-uuid',
  project_id: 'project-uuid',
  storage_url: 'project-uuid/abc.jpg',
  thumbnail_url: 'project-uuid/thumb_abc.jpg',
  original_filename: 'room.jpg',
  mime_type: 'image/jpeg',
  size_bytes: 1024000,
  status: PhotoStatus.READY,
  sort_order: 0,
  created_at: new Date(),
  updated_at: new Date(),
  project: null as never,
};

const photoRepoMock = {
  create: jest.fn().mockReturnValue(mockPhoto),
  save: jest.fn().mockResolvedValue(mockPhoto),
  find: jest.fn().mockResolvedValue([mockPhoto]),
  findOne: jest.fn().mockResolvedValue(mockPhoto),
  count: jest.fn().mockResolvedValue(0),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  remove: jest.fn().mockResolvedValue(mockPhoto),
};

const projectRepoMock = {
  findOne: jest.fn().mockResolvedValue(mockProject),
};

const storageMock = {
  save: jest.fn().mockResolvedValue('project-uuid/abc.jpg'),
  delete: jest.fn().mockResolvedValue(undefined),
  getAbsolutePath: jest.fn().mockReturnValue('/uploads/project-uuid/abc.jpg'),
};

const analyticsMock = {
  track: jest.fn(),
};

const configMock = {
  get: jest.fn((key: string, defaultValue?: unknown) => {
    const map: Record<string, unknown> = {
      'storage.allowedMimeTypes': [
        'image/jpeg',
        'image/png',
        'image/heic',
        'image/heif',
      ],
      'storage.thumbnailWidth': 400,
    };
    return map[key] ?? defaultValue;
  }),
};

describe('PhotosService', () => {
  let service: PhotosService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhotosService,
        {
          provide: getRepositoryToken(ProjectPhoto),
          useValue: photoRepoMock,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: projectRepoMock,
        },
        {
          provide: STORAGE_PROVIDER,
          useValue: storageMock,
        },
        {
          provide: ConfigService,
          useValue: configMock,
        },
        {
          provide: AnalyticsService,
          useValue: analyticsMock,
        },
      ],
    }).compile();

    service = module.get<PhotosService>(PhotosService);
  });

  describe('uploadPhoto', () => {
    // En-tete JPEG reelle : depuis R8, `uploadPhoto` verifie les octets de
    // signature avant de confier quoi que ce soit a sharp/libvips.
    const jpegBuffer = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(1020),
    ]);

    const mockFile = {
      buffer: jpegBuffer,
      originalname: 'room.jpg',
      mimetype: 'image/jpeg',
      size: 1024000,
    } as Express.Multer.File;

    // R8 : le filtre multer amont ne lit que le Content-Type declare par le
    // client. Sans cette garde, une suite d'octets quelconque atteignait le
    // decodeur natif (libjpeg/libpng/libheif) avant toute verification.
    it('refuse un fichier qui n’est pas une image, sans invoquer sharp', async () => {
      (sharp as unknown as jest.Mock).mockClear();

      await expect(
        service.uploadPhoto('project-uuid', 'org-uuid', {
          ...mockFile,
          buffer: Buffer.from('MZ' + 'A'.repeat(1000), 'latin1'),
        } as Express.Multer.File),
      ).rejects.toThrow(BadRequestException);

      expect(sharp).not.toHaveBeenCalled();
      expect(photoRepoMock.save).not.toHaveBeenCalled();
    });

    it('should upload a photo successfully', async () => {
      const result = await service.uploadPhoto(
        'project-uuid',
        'org-uuid',
        mockFile,
      );

      expect(projectRepoMock.findOne).toHaveBeenCalledWith({
        where: { id: 'project-uuid' },
        select: ['id', 'organization_id'],
      });
      expect(photoRepoMock.count).toHaveBeenCalled();
      expect(storageMock.save).toHaveBeenCalled();
      expect(photoRepoMock.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException for wrong user', async () => {
      await expect(
        service.uploadPhoto('project-uuid', 'other-org-uuid', mockFile),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for missing project', async () => {
      projectRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(
        service.uploadPhoto('nonexistent', 'org-uuid', mockFile),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when photo limit reached', async () => {
      photoRepoMock.count.mockResolvedValueOnce(5);

      await expect(
        service.uploadPhoto('project-uuid', 'org-uuid', mockFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a photo that is too small/too far (low resolution)', async () => {
      mockSharpInstance.metadata.mockResolvedValueOnce({
        format: 'jpeg',
        width: 300,
        height: 200,
      });

      await expect(
        service.uploadPhoto('project-uuid', 'org-uuid', mockFile),
      ).rejects.toThrow(/trop petite ou trop eloignee/);
    });

    it('should reject a photo that is too dark', async () => {
      mockSharpInstance.stats.mockResolvedValueOnce({
        channels: [{ mean: 10 }],
        sharpness: 2.5,
      });

      await expect(
        service.uploadPhoto('project-uuid', 'org-uuid', mockFile),
      ).rejects.toThrow(/trop sombre/);
    });

    it('should reject an overexposed photo', async () => {
      mockSharpInstance.stats.mockResolvedValueOnce({
        channels: [{ mean: 250 }],
        sharpness: 2.5,
      });

      await expect(
        service.uploadPhoto('project-uuid', 'org-uuid', mockFile),
      ).rejects.toThrow(/surexposee/);
    });

    it('should reject a blurry photo', async () => {
      mockSharpInstance.stats.mockResolvedValueOnce({
        channels: [{ mean: 130 }],
        sharpness: 0.05,
      });

      await expect(
        service.uploadPhoto('project-uuid', 'org-uuid', mockFile),
      ).rejects.toThrow(/trop floue/);
    });

    // MOB-1 : chaque cause de rejet doit être tracée avec son motif. C'est la
    // mesure qui arbitrera l'argument « caméra » de MOB-2 ; un motif manquant
    // rendrait le taux de rejet ininterprétable.
    it.each([
      [
        'too_small',
        () =>
          mockSharpInstance.metadata.mockResolvedValueOnce({
            format: 'jpeg',
            width: 300,
            height: 200,
          }),
      ],
      [
        'too_dark',
        () =>
          mockSharpInstance.stats.mockResolvedValueOnce({
            channels: [{ mean: 10 }],
            sharpness: 2.5,
          }),
      ],
      [
        'overexposed',
        () =>
          mockSharpInstance.stats.mockResolvedValueOnce({
            channels: [{ mean: 250 }],
            sharpness: 2.5,
          }),
      ],
      [
        'too_blurry',
        () =>
          mockSharpInstance.stats.mockResolvedValueOnce({
            channels: [{ mean: 130 }],
            sharpness: 0.05,
          }),
      ],
    ])(
      'trace le rejet qualité « %s » avec son motif',
      async (reason, arrange) => {
        arrange();

        await expect(
          service.uploadPhoto(
            'project-uuid',
            'org-uuid',
            mockFile,
            'user-uuid',
          ),
        ).rejects.toThrow(BadRequestException);

        expect(analyticsMock.track).toHaveBeenCalledWith(
          AnalyticsEventName.PHOTO_QUALITY_REJECTED,
          'user-uuid',
          { reason },
        );
      },
    );

    it('ne trace aucun rejet quand la photo passe le contrôle qualité', async () => {
      await service.uploadPhoto(
        'project-uuid',
        'org-uuid',
        mockFile,
        'user-uuid',
      );

      expect(analyticsMock.track).not.toHaveBeenCalled();
    });

    it('should fail open (allow upload) when quality analysis throws unexpectedly', async () => {
      mockSharpInstance.stats.mockRejectedValueOnce(new Error('decode error'));

      const result = await service.uploadPhoto(
        'project-uuid',
        'org-uuid',
        mockFile,
      );

      expect(result).toBeDefined();
      expect(storageMock.save).toHaveBeenCalled();
    });
  });

  describe('getProjectPhotos', () => {
    it('should return photos ordered by sort_order', async () => {
      const result = await service.getProjectPhotos('project-uuid', 'org-uuid');

      expect(photoRepoMock.find).toHaveBeenCalledWith({
        where: { project_id: 'project-uuid' },
        order: { sort_order: 'ASC', created_at: 'ASC' },
      });
      expect(result).toEqual([mockPhoto]);
    });

    it('should throw ForbiddenException for wrong user', async () => {
      await expect(
        service.getProjectPhotos('project-uuid', 'other-org-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deletePhoto', () => {
    it('should delete photo from storage and database', async () => {
      await service.deletePhoto('project-uuid', 'org-uuid', 'photo-uuid');

      expect(storageMock.delete).toHaveBeenCalledWith(mockPhoto.storage_url);
      expect(storageMock.delete).toHaveBeenCalledWith(mockPhoto.thumbnail_url);
      expect(photoRepoMock.remove).toHaveBeenCalledWith(mockPhoto);
    });

    it('should throw NotFoundException for missing photo', async () => {
      photoRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(
        service.deletePhoto('project-uuid', 'org-uuid', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for wrong user', async () => {
      await expect(
        service.deletePhoto('project-uuid', 'other-org-uuid', 'photo-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findPhotoForServing', () => {
    it('should return the photo', async () => {
      const result = await service.findPhotoForServing(
        'project-uuid',
        'org-uuid',
        'photo-uuid',
      );
      expect(result).toBeDefined();
      expect(result.id).toBe('photo-uuid');
    });

    it('should throw NotFoundException for missing photo', async () => {
      photoRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(
        service.findPhotoForServing('project-uuid', 'org-uuid', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByStorageUrl', () => {
    it('looks the photo up by exact storage_url', async () => {
      const result = await service.findByStorageUrl('project-uuid/abc.jpg');

      expect(photoRepoMock.findOne).toHaveBeenCalledWith({
        where: { storage_url: 'project-uuid/abc.jpg' },
      });
      expect(result).toBeDefined();
    });

    it('returns null when no photo matches', async () => {
      photoRepoMock.findOne.mockResolvedValueOnce(null);

      const result = await service.findByStorageUrl('nope/../etc/passwd');
      expect(result).toBeNull();
    });
  });
});
