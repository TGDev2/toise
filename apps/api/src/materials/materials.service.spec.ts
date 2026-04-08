import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MaterialsService } from './materials.service';
import {
  MaterialCatalog,
  MaterialCategory,
} from './entities/material-catalog.entity';
import { MaterialPackaging } from './entities/material-packaging.entity';
import { WasteFactor } from './entities/waste-factor.entity';

const mockMaterial: MaterialCatalog = {
  id: 'mat-uuid',
  name: 'Peinture acrylique mate',
  category: MaterialCategory.PAINTING,
  unit: 'L',
  yield_per_unit: 10,
  is_active: true,
  modified_by: null,
  modified_at: null,
  created_at: new Date('2026-03-28T00:00:00.000Z'),
  updated_at: new Date('2026-03-28T00:00:00.000Z'),
  packagings: [],
  waste_factors: [],
  modifier: null,
};

const mockPackaging: MaterialPackaging = {
  id: 'pkg-uuid',
  material_id: 'mat-uuid',
  label: 'Pot 2.5 L',
  quantity_per_unit: 2.5,
  unit: 'L',
  created_at: new Date('2026-03-28T00:00:00.000Z'),
  updated_at: new Date('2026-03-28T00:00:00.000Z'),
  material: null as never,
};

const materialRepoMock = {
  findOne: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const packagingRepoMock = {
  create: jest.fn(),
  save: jest.fn(),
};

const wasteFactorRepoMock = {
  create: jest.fn(),
  save: jest.fn(),
};

const mockManager = {
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findOne: jest.fn(),
};

const dataSourceMock = {
  transaction: jest.fn(
    (cb: (manager: typeof mockManager) => Promise<unknown>) => cb(mockManager),
  ),
};

describe('MaterialsService', () => {
  let service: MaterialsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaterialsService,
        {
          provide: getRepositoryToken(MaterialCatalog),
          useValue: materialRepoMock,
        },
        {
          provide: getRepositoryToken(MaterialPackaging),
          useValue: packagingRepoMock,
        },
        {
          provide: getRepositoryToken(WasteFactor),
          useValue: wasteFactorRepoMock,
        },
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
      ],
    }).compile();

    service = module.get<MaterialsService>(MaterialsService);
  });

  describe('create', () => {
    it('should create a material with packagings', async () => {
      const materialWithPkg = {
        ...mockMaterial,
        packagings: [mockPackaging],
      };

      mockManager.create.mockReturnValue(mockMaterial);
      mockManager.save.mockResolvedValue(mockMaterial);
      mockManager.findOne.mockResolvedValue(materialWithPkg);

      const result = await service.create(
        {
          name: 'Peinture acrylique mate',
          category: MaterialCategory.PAINTING,
          unit: 'L',
          yield_per_unit: 10,
          packagings: [
            { label: 'Pot 2.5 L', quantity_per_unit: 2.5, unit: 'L' },
          ],
        },
        'user-uuid',
      );

      expect(result).toEqual(materialWithPkg);
      expect(mockManager.save).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a material by id', async () => {
      materialRepoMock.findOne.mockResolvedValue(mockMaterial);

      const result = await service.findOne('mat-uuid');

      expect(result).toEqual(mockMaterial);
      expect(materialRepoMock.findOne).toHaveBeenCalledWith({
        where: { id: 'mat-uuid' },
        relations: ['packagings', 'waste_factors'],
      });
    });

    it('should throw NotFoundException if not found', async () => {
      materialRepoMock.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should filter by category', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockMaterial]),
      };
      materialRepoMock.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({
        category: MaterialCategory.PAINTING,
      });

      expect(result).toEqual([mockMaterial]);
      expect(qb.andWhere).toHaveBeenCalledWith(
        'material.category = :category',
        { category: MaterialCategory.PAINTING },
      );
    });

    it('should filter by is_active', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockMaterial]),
      };
      materialRepoMock.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ is_active: true });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'material.is_active = :is_active',
        { is_active: true },
      );
    });
  });

  describe('deactivate', () => {
    it('should set is_active to false and update audit fields', async () => {
      materialRepoMock.findOne.mockResolvedValue(mockMaterial);
      materialRepoMock.update.mockResolvedValue({ affected: 1 });

      const deactivated = { ...mockMaterial, is_active: false };
      materialRepoMock.findOne
        .mockResolvedValueOnce(mockMaterial)
        .mockResolvedValueOnce(deactivated);

      const result = await service.deactivate('mat-uuid', 'admin-uuid');

      expect(result.is_active).toBe(false);
      expect(materialRepoMock.update).toHaveBeenCalledWith('mat-uuid', {
        is_active: false,
        modified_by: 'admin-uuid',
        modified_at: expect.any(Date),
      });
    });
  });
});
