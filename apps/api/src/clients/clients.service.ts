import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly repo: Repository<Client>,
  ) {}

  async create(
    organizationId: string,
    userId: string,
    dto: CreateClientDto,
  ): Promise<Client> {
    const client = this.repo.create({
      organization_id: organizationId,
      user_id: userId,
      name: dto.name,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      address_line1: dto.address_line1 ?? null,
      address_line2: dto.address_line2 ?? null,
      postal_code: dto.postal_code ?? null,
      city: dto.city ?? null,
      is_company: dto.is_company ?? false,
      siret: dto.siret ?? null,
      vat_number: dto.vat_number ?? null,
      country: dto.country ?? 'FR',
    });

    return this.repo.save(client);
  }

  async findAllForOrg(organizationId: string): Promise<Client[]> {
    return this.repo.find({
      where: { organization_id: organizationId },
      order: { created_at: 'DESC' },
    });
  }

  async findOneForOrg(id: string, organizationId: string): Promise<Client> {
    const client = await this.repo.findOne({
      where: { id, organization_id: organizationId },
    });
    if (!client) {
      throw new NotFoundException('Client non trouve');
    }
    return client;
  }

  async countForOrg(organizationId: string): Promise<number> {
    return this.repo.count({ where: { organization_id: organizationId } });
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateClientDto,
  ): Promise<Client> {
    const client = await this.findOneForOrg(id, organizationId);
    Object.assign(client, dto);
    return this.repo.save(client);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const client = await this.findOneForOrg(id, organizationId);
    await this.repo.remove(client);
  }
}
