import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MaterialCatalog } from './entities/material-catalog.entity';
import { MaterialPackaging } from './entities/material-packaging.entity';
import { WasteFactor } from './entities/waste-factor.entity';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { QueryMaterialsDto } from './dto/query-materials.dto';

@Injectable()
export class MaterialsService {
  constructor(
    @InjectRepository(MaterialCatalog)
    private readonly materialRepo: Repository<MaterialCatalog>,
    @InjectRepository(MaterialPackaging)
    private readonly packagingRepo: Repository<MaterialPackaging>,
    @InjectRepository(WasteFactor)
    private readonly wasteFactorRepo: Repository<WasteFactor>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreateMaterialDto,
    userId: string,
  ): Promise<MaterialCatalog> {
    return this.dataSource.transaction(async (manager) => {
      const material = manager.create(MaterialCatalog, {
        name: dto.name,
        category: dto.category,
        unit: dto.unit,
        yield_per_unit: dto.yield_per_unit,
        modified_by: userId,
        modified_at: new Date(),
      });
      const savedMaterial = await manager.save(MaterialCatalog, material);

      const packagings = dto.packagings.map((p) =>
        manager.create(MaterialPackaging, {
          material_id: savedMaterial.id,
          label: p.label,
          quantity_per_unit: p.quantity_per_unit,
          unit: p.unit,
        }),
      );
      await manager.save(MaterialPackaging, packagings);

      if (dto.waste_factors?.length) {
        const wasteFactors = dto.waste_factors.map((wf) =>
          manager.create(WasteFactor, {
            material_id: savedMaterial.id,
            pose_type: wf.pose_type,
            skill_level: wf.skill_level,
            factor_percent: wf.factor_percent,
          }),
        );
        await manager.save(WasteFactor, wasteFactors);
      }

      return this.findOneWithManager(savedMaterial.id, manager);
    });
  }

  async findAll(query: QueryMaterialsDto): Promise<MaterialCatalog[]> {
    const qb = this.materialRepo
      .createQueryBuilder('material')
      .leftJoinAndSelect('material.packagings', 'packaging')
      .leftJoinAndSelect('material.waste_factors', 'waste_factor')
      .orderBy('material.category', 'ASC')
      .addOrderBy('material.name', 'ASC');

    if (query.category) {
      qb.andWhere('material.category = :category', {
        category: query.category,
      });
    }

    if (query.is_active !== undefined) {
      qb.andWhere('material.is_active = :is_active', {
        is_active: query.is_active,
      });
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<MaterialCatalog> {
    const material = await this.materialRepo.findOne({
      where: { id },
      relations: ['packagings', 'waste_factors'],
    });

    if (!material) {
      throw new NotFoundException(`Material with id ${id} not found`);
    }

    return material;
  }

  async update(
    id: string,
    dto: UpdateMaterialDto,
    userId: string,
  ): Promise<MaterialCatalog> {
    const material = await this.findOne(id);

    return this.dataSource.transaction(async (manager) => {
      const { packagings, waste_factors, ...materialFields } = dto;

      if (Object.keys(materialFields).length > 0) {
        await manager.update(MaterialCatalog, id, {
          ...materialFields,
          modified_by: userId,
          modified_at: new Date(),
        });
      } else {
        await manager.update(MaterialCatalog, id, {
          modified_by: userId,
          modified_at: new Date(),
        });
      }

      if (packagings) {
        await manager.delete(MaterialPackaging, { material_id: id });
        const newPackagings = packagings.map((p) =>
          manager.create(MaterialPackaging, {
            material_id: id,
            label: p.label,
            quantity_per_unit: p.quantity_per_unit,
            unit: p.unit,
          }),
        );
        await manager.save(MaterialPackaging, newPackagings);
      }

      if (waste_factors) {
        await manager.delete(WasteFactor, { material_id: id });
        const newFactors = waste_factors.map((wf) =>
          manager.create(WasteFactor, {
            material_id: id,
            pose_type: wf.pose_type,
            skill_level: wf.skill_level,
            factor_percent: wf.factor_percent,
          }),
        );
        await manager.save(WasteFactor, newFactors);
      }

      return this.findOneWithManager(id, manager);
    });
  }

  async deactivate(id: string, userId: string): Promise<MaterialCatalog> {
    await this.findOne(id);

    await this.materialRepo.update(id, {
      is_active: false,
      modified_by: userId,
      modified_at: new Date(),
    });

    return this.findOne(id);
  }

  private async findOneWithManager(
    id: string,
    manager: any,
  ): Promise<MaterialCatalog> {
    const material = await manager.findOne(MaterialCatalog, {
      where: { id },
      relations: ['packagings', 'waste_factors'],
    });

    if (!material) {
      throw new NotFoundException(`Material with id ${id} not found`);
    }

    return material;
  }
}
