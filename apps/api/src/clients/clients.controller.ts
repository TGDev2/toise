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
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { FeatureGateGuard } from '../feature-gates/guards/feature-gate.guard';
import { RequireFeature } from '../feature-gates/decorators/require-feature.decorator';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { UserContextService } from '../users/user-context.service';
import type { UserScope } from '../users/user-context.service';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
@UseGuards(FirebaseAuthGuard, FeatureGateGuard)
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly userContext: UserContextService,
  ) {}

  private resolveScope(firebaseUser: DecodedIdToken): Promise<UserScope> {
    return this.userContext.resolveForFirebaseUid(firebaseUser.uid);
  }

  @Post()
  @RequireFeature('client_management')
  async create(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: CreateClientDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.clientsService.create(scope.userId, dto);
  }

  @Get()
  @RequireFeature('client_management')
  async findAll(@CurrentFirebaseUser() firebaseUser: DecodedIdToken) {
    const scope = await this.resolveScope(firebaseUser);
    return this.clientsService.findAllForUser(scope.userId);
  }

  @Get(':id')
  @RequireFeature('client_management')
  async findOne(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.clientsService.findOneForUser(id, scope.userId);
  }

  @Patch(':id')
  @RequireFeature('client_management')
  async update(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.clientsService.update(id, scope.userId, dto);
  }

  @Delete(':id')
  @RequireFeature('client_management')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    await this.clientsService.remove(id, scope.userId);
  }
}
