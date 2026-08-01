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

  async create(userId: string, dto: CreateClientDto): Promise<Client> {
    const client = this.repo.create({
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

  async findAllByUser(userId: string): Promise<Client[]> {
    return this.repo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findOneByUser(id: string, userId: string): Promise<Client> {
    const client = await this.repo.findOne({
      where: { id, user_id: userId },
    });
    if (!client) {
      throw new NotFoundException('Client non trouve');
    }
    return client;
  }

  async countByUser(userId: string): Promise<number> {
    return this.repo.count({ where: { user_id: userId } });
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateClientDto,
  ): Promise<Client> {
    const client = await this.findOneByUser(id, userId);
    Object.assign(client, dto);
    return this.repo.save(client);
  }

  async remove(id: string, userId: string): Promise<void> {
    const client = await this.findOneByUser(id, userId);
    await this.repo.remove(client);
  }
}
