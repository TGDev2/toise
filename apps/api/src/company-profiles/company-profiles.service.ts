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
    const existingForUser = await this.repo.findOne({
      where: { user_id: userId },
    });
    if (existingForUser) {
      throw new ConflictException(
        'Un profil entreprise existe deja pour ce compte',
      );
    }

    const existingBySiret = await this.repo.findOne({
      where: { siret: dto.siret },
    });
    if (existingBySiret) {
      throw new ConflictException('Ce numero SIRET est deja utilise');
    }

    // Le spread porte les mentions légales de facturation (PRO-4) sans avoir à
    // les recopier une à une ; le ValidationPipe global (`whitelist: true`) a
    // déjà écarté tout champ hors DTO. Les trois champs ci-dessous restent
    // explicites pour normaliser `undefined` en `null` / tableau vide.
    const profile = this.repo.create({
      ...dto,
      user_id: userId,
      address_line2: dto.address_line2 ?? null,
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
    const profile = await this.repo.findOne({
      where: { user_id: userId },
    });
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
