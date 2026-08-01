import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MaterialsService } from './materials.service';
import {
  MaterialCatalog,
  MaterialCategory,
} from './entities/material-catalog.entity';
import { MaterialPackaging } from './entities/material-packaging.entity';
import { WasteFactor } from './entities/waste-factor.entity';
import { MaterialEcoEquivalence } from './entities/material-eco-equivalence.entity';

const MATERIAL_RELATIONS = [
  'packagings',
  'waste_factors',
  'eco_equivalents',
  'eco_equivalents.ecoMaterial',
];

const mockMaterial: MaterialCatalog = {
  id: 'mat-uuid',
  name: 'Peinture acrylique mate',
  category: MaterialCategory.PAINTING,
  unit: 'L',
  yield_per_unit: 10,
  is_active: true,
  is_eco: false,
  eco_label_fr: null,
  modified_by: null,
  modified_at: null,
  created_at: new Date('2026-03-28T00:00:00.000Z'),
  updated_at: new Date('2026-03-28T00:00:00.000Z'),
  packagings: [],
  waste_factors: [],
  eco_equivalents: [],
  modifier: null,
};

const mockEcoMaterial: MaterialCatalog = {
  ...mockMaterial,
  id: 'eco-mat-uuid',
  name: 'Peinture acrylique mate sans COV',
  is_eco: true,
  eco_label_fr: 'Sans COV, écolabel NF Environnement',
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

const ecoEquivalenceRepoMock = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
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
          provide: getRepositoryToken(MaterialEcoEquivalence),
          useValue: ecoEquivalenceRepoMock,
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

    it('should reject is_eco: true without eco_label_fr', async () => {
      await expect(
        service.create(
          {
            name: 'Peinture éco',
            category: MaterialCategory.PAINTING,
            unit: 'L',
            yield_per_unit: 10,
            is_eco: true,
            packagings: [
              { label: 'Pot 2.5 L', quantity_per_unit: 2.5, unit: 'L' },
            ],
          },
          'user-uuid',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockManager.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should reject setting is_eco: true without an eco_label_fr (new or existing)', async () => {
      materialRepoMock.findOne.mockResolvedValue(mockMaterial);

      await expect(
        service.update('mat-uuid', { is_eco: true }, 'user-uuid'),
      ).rejects.toThrow(BadRequestException);
      expect(mockManager.update).not.toHaveBeenCalled();
    });

    it('should accept is_eco: true when the existing material already has an eco_label_fr', async () => {
      materialRepoMock.findOne.mockResolvedValue(mockEcoMaterial);
      mockManager.findOne.mockResolvedValue(mockEcoMaterial);

      await service.update('eco-mat-uuid', { is_eco: true }, 'user-uuid');

      expect(mockManager.update).toHaveBeenCalledWith(
        MaterialCatalog,
        'eco-mat-uuid',
        expect.objectContaining({ is_eco: true }) as object,
      );
    });
  });

  describe('findOne', () => {
    it('should return a material by id', async () => {
      materialRepoMock.findOne.mockResolvedValue(mockMaterial);

      const result = await service.findOne('mat-uuid');

      expect(result).toEqual(mockMaterial);
      expect(materialRepoMock.findOne).toHaveBeenCalledWith({
        where: { id: 'mat-uuid' },
        relations: MATERIAL_RELATIONS,
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
        modified_at: expect.any(Date) as Date,
      });
    });
  });

  describe('linkEcoEquivalent', () => {
    it('should link a standard material to an eco material of the same category', async () => {
      materialRepoMock.findOne
        .mockResolvedValueOnce(mockMaterial) // source
        .mockResolvedValueOnce(mockEcoMaterial) // target
        .mockResolvedValueOnce(mockMaterial); // final findOne(materialId)
      ecoEquivalenceRepoMock.findOne.mockResolvedValue(null);
      ecoEquivalenceRepoMock.create.mockReturnValue({
        standard_material_id: 'mat-uuid',
        eco_material_id: 'eco-mat-uuid',
      });

      const result = await service.linkEcoEquivalent(
        'mat-uuid',
        'eco-mat-uuid',
      );

      expect(ecoEquivalenceRepoMock.save).toHaveBeenCalled();
      expect(result).toEqual(mockMaterial);
    });

    it('should reject linking a material to itself', async () => {
      await expect(
        service.linkEcoEquivalent('mat-uuid', 'mat-uuid'),
      ).rejects.toThrow(BadRequestException);
      expect(ecoEquivalenceRepoMock.save).not.toHaveBeenCalled();
    });

    it('should reject when the source material is itself eco', async () => {
      materialRepoMock.findOne.mockResolvedValueOnce(mockEcoMaterial);

      await expect(
        service.linkEcoEquivalent('eco-mat-uuid', 'other-uuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when the target material is not eco', async () => {
      materialRepoMock.findOne
        .mockResolvedValueOnce(mockMaterial)
        .mockResolvedValueOnce({ ...mockMaterial, id: 'other-uuid' });

      await expect(
        service.linkEcoEquivalent('mat-uuid', 'other-uuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when categories differ', async () => {
      materialRepoMock.findOne
        .mockResolvedValueOnce(mockMaterial)
        .mockResolvedValueOnce({
          ...mockEcoMaterial,
          category: MaterialCategory.TILING,
        });

      await expect(
        service.linkEcoEquivalent('mat-uuid', 'eco-mat-uuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a duplicate equivalence', async () => {
      materialRepoMock.findOne
        .mockResolvedValueOnce(mockMaterial)
        .mockResolvedValueOnce(mockEcoMaterial);
      ecoEquivalenceRepoMock.findOne.mockResolvedValue({
        id: 'existing-eq',
        standard_material_id: 'mat-uuid',
        eco_material_id: 'eco-mat-uuid',
      });

      await expect(
        service.linkEcoEquivalent('mat-uuid', 'eco-mat-uuid'),
      ).rejects.toThrow(BadRequestException);
      expect(ecoEquivalenceRepoMock.save).not.toHaveBeenCalled();
    });
  });

  describe('unlinkEcoEquivalent', () => {
    it('should delete the equivalence row', async () => {
      materialRepoMock.findOne.mockResolvedValue(mockMaterial);

      await service.unlinkEcoEquivalent('mat-uuid', 'eco-mat-uuid');

      expect(ecoEquivalenceRepoMock.delete).toHaveBeenCalledWith({
        standard_material_id: 'mat-uuid',
        eco_material_id: 'eco-mat-uuid',
      });
    });
  });
});
