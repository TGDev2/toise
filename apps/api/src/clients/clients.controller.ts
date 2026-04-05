import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { FeatureGateGuard } from '../feature-gates/guards/feature-gate.guard';
import { RequireFeature } from '../feature-gates/decorators/require-feature.decorator';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
@UseGuards(FirebaseAuthGuard, FeatureGateGuard)
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveUserId(firebaseUser: DecodedIdToken): Promise<string> {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) throw new NotFoundException('User not found');
    return user.id;
  }

  @Post()
  @RequireFeature('client_management')
  async create(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: CreateClientDto,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    return this.clientsService.create(userId, dto);
  }

  @Get()
  @RequireFeature('client_management')
  async findAll(@CurrentFirebaseUser() firebaseUser: DecodedIdToken) {
    const userId = await this.resolveUserId(firebaseUser);
    return this.clientsService.findAllByUser(userId);
  }

  @Get(':id')
  @RequireFeature('client_management')
  async findOne(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    return this.clientsService.findOneByUser(id, userId);
  }

  @Patch(':id')
  @RequireFeature('client_management')
  async update(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    return this.clientsService.update(id, userId, dto);
  }

  @Delete(':id')
  @RequireFeature('client_management')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    await this.clientsService.remove(id, userId);
  }
}
