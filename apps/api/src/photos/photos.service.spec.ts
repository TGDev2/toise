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
  user_id: 'user-uuid',
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
      ],
    }).compile();

    service = module.get<PhotosService>(PhotosService);
  });

  describe('uploadPhoto', () => {
    const mockFile = {
      buffer: Buffer.from('fake-image'),
      originalname: 'room.jpg',
      mimetype: 'image/jpeg',
      size: 1024000,
    } as Express.Multer.File;

    it('should upload a photo successfully', async () => {
      const result = await service.uploadPhoto(
        'project-uuid',
        'user-uuid',
        mockFile,
      );

      expect(projectRepoMock.findOne).toHaveBeenCalledWith({
        where: { id: 'project-uuid' },
        select: ['id', 'user_id'],
      });
      expect(photoRepoMock.count).toHaveBeenCalled();
      expect(storageMock.save).toHaveBeenCalled();
      expect(photoRepoMock.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException for wrong user', async () => {
      await expect(
        service.uploadPhoto('project-uuid', 'other-user-uuid', mockFile),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for missing project', async () => {
      projectRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(
        service.uploadPhoto('nonexistent', 'user-uuid', mockFile),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when photo limit reached', async () => {
      photoRepoMock.count.mockResolvedValueOnce(5);

      await expect(
        service.uploadPhoto('project-uuid', 'user-uuid', mockFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a photo that is too small/too far (low resolution)', async () => {
      mockSharpInstance.metadata.mockResolvedValueOnce({
        format: 'jpeg',
        width: 300,
        height: 200,
      });

      await expect(
        service.uploadPhoto('project-uuid', 'user-uuid', mockFile),
      ).rejects.toThrow(/trop petite ou trop eloignee/);
    });

    it('should reject a photo that is too dark', async () => {
      mockSharpInstance.stats.mockResolvedValueOnce({
        channels: [{ mean: 10 }],
        sharpness: 2.5,
      });

      await expect(
        service.uploadPhoto('project-uuid', 'user-uuid', mockFile),
      ).rejects.toThrow(/trop sombre/);
    });

    it('should reject an overexposed photo', async () => {
      mockSharpInstance.stats.mockResolvedValueOnce({
        channels: [{ mean: 250 }],
        sharpness: 2.5,
      });

      await expect(
        service.uploadPhoto('project-uuid', 'user-uuid', mockFile),
      ).rejects.toThrow(/surexposee/);
    });

    it('should reject a blurry photo', async () => {
      mockSharpInstance.stats.mockResolvedValueOnce({
        channels: [{ mean: 130 }],
        sharpness: 0.05,
      });

      await expect(
        service.uploadPhoto('project-uuid', 'user-uuid', mockFile),
      ).rejects.toThrow(/trop floue/);
    });

    it('should fail open (allow upload) when quality analysis throws unexpectedly', async () => {
      mockSharpInstance.stats.mockRejectedValueOnce(new Error('decode error'));

      const result = await service.uploadPhoto(
        'project-uuid',
        'user-uuid',
        mockFile,
      );

      expect(result).toBeDefined();
      expect(storageMock.save).toHaveBeenCalled();
    });
  });

  describe('getProjectPhotos', () => {
    it('should return photos ordered by sort_order', async () => {
      const result = await service.getProjectPhotos(
        'project-uuid',
        'user-uuid',
      );

      expect(photoRepoMock.find).toHaveBeenCalledWith({
        where: { project_id: 'project-uuid' },
        order: { sort_order: 'ASC', created_at: 'ASC' },
      });
      expect(result).toEqual([mockPhoto]);
    });

    it('should throw ForbiddenException for wrong user', async () => {
      await expect(
        service.getProjectPhotos('project-uuid', 'other-user-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deletePhoto', () => {
    it('should delete photo from storage and database', async () => {
      await service.deletePhoto('project-uuid', 'user-uuid', 'photo-uuid');

      expect(storageMock.delete).toHaveBeenCalledWith(mockPhoto.storage_url);
      expect(storageMock.delete).toHaveBeenCalledWith(mockPhoto.thumbnail_url);
      expect(photoRepoMock.remove).toHaveBeenCalledWith(mockPhoto);
    });

    it('should throw NotFoundException for missing photo', async () => {
      photoRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(
        service.deletePhoto('project-uuid', 'user-uuid', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for wrong user', async () => {
      await expect(
        service.deletePhoto('project-uuid', 'other-user-uuid', 'photo-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findPhotoForServing', () => {
    it('should return the photo', async () => {
      const result = await service.findPhotoForServing(
        'project-uuid',
        'user-uuid',
        'photo-uuid',
      );
      expect(result).toBeDefined();
      expect(result.id).toBe('photo-uuid');
    });

    it('should throw NotFoundException for missing photo', async () => {
      photoRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(
        service.findPhotoForServing('project-uuid', 'user-uuid', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
