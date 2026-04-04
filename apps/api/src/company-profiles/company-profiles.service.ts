import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyProfile } from './entities/company-profile.entity';
import { CreateCompanyProfileDto } from './dto/create-company-profile.dto';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';

@Injectable()
export class CompanyProfilesService {
  constructor(
    @InjectRepository(CompanyProfile)
    private readonly repo: Repository<CompanyProfile>,
  ) {}

  async create(
    userId: string,
    dto: CreateCompanyProfileDto,
  ): Promise<CompanyProfile> {
    const existingByUser = await this.repo.findOne({
      where: { user_id: userId },
    });
    if (existingByUser) {
      throw new ConflictException('Un profil entreprise existe deja pour cet utilisateur');
    }

    const existingBySiret = await this.repo.findOne({
      where: { siret: dto.siret },
    });
    if (existingBySiret) {
      throw new ConflictException('Ce numero SIRET est deja utilise');
    }

    const profile = this.repo.create({
      user_id: userId,
      raison_sociale: dto.raison_sociale,
      siret: dto.siret,
      address_line1: dto.address_line1,
      address_line2: dto.address_line2 ?? null,
      postal_code: dto.postal_code,
      city: dto.city,
      phone: dto.phone ?? null,
      specialties: dto.specialties ?? [],
    });

    return this.repo.save(profile);
  }

  async findByUserId(userId: string): Promise<CompanyProfile | null> {
    return this.repo.findOne({ where: { user_id: userId } });
  }

  async update(
    userId: string,
    dto: UpdateCompanyProfileDto,
  ): Promise<CompanyProfile> {
    const profile = await this.repo.findOne({ where: { user_id: userId } });
    if (!profile) {
      throw new ConflictException('Aucun profil entreprise trouve');
    }

    if (dto.siret && dto.siret !== profile.siret) {
      const existingBySiret = await this.repo.findOne({
        where: { siret: dto.siret },
      });
      if (existingBySiret) {
        throw new ConflictException('Ce numero SIRET est deja utilise');
      }
    }

    Object.assign(profile, dto);
    return this.repo.save(profile);
  }
}
