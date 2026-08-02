import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentAppUser } from '../auth/decorators/current-app-user.decorator';
import type { User } from '../users/entities/user.entity';
import { EnterpriseAgreementsService } from './enterprise-agreements.service';
import { SsoConnectionsService } from './sso-connections.service';
import { CreateEnterpriseAgreementDto } from './dto/create-enterprise-agreement.dto';
import { UpdateEnterpriseAgreementDto } from './dto/update-enterprise-agreement.dto';
import { CreateSsoConnectionDto } from './dto/create-sso-connection.dto';

/**
 * Administration plateforme de l'offre Enterprise (BACKLOG PLAT-6).
 *
 * Les deux leviers réservés ici sont ceux qui engagent l'argent et l'identité :
 * ouvrir une habilitation à 10 k€/an, et créer un fournisseur d'identité auquel
 * nous accepterons de faire confiance. Le backlog fixe d'ailleurs l'offre comme
 * vendue « uniquement sur demande entrante avérée » — il n'y a pas de parcours
 * self-serve à ouvrir.
 *
 * `POST /admin/enterprise/sso/connections` transporte le certificat X.509 ou le
 * `client_secret` du client. Ces valeurs partent chez GCIP et ne sont **jamais**
 * persistées (PLAT-6 D5).
 */
@Controller('admin/enterprise')
@UseGuards(FirebaseAuthGuard, AdminGuard)
@Throttle({ default: { ttl: 60000, limit: 30 } })
export class AdminEnterpriseController {
  constructor(
    private readonly agreementsService: EnterpriseAgreementsService,
    private readonly ssoConnectionsService: SsoConnectionsService,
  ) {}

  /**
   * `expiring_within_days` donne la file de renouvellement : c'est ce qui tient
   * lieu, pour l'instant, de sweep de relance (cf. tasks/todo.md §PLAT-6 §7).
   */
  @Get('agreements')
  async listAgreements(
    @Query('expiring_within_days', new ParseIntPipe({ optional: true }))
    expiringWithinDays?: number,
  ) {
    const agreements =
      await this.agreementsService.listForAdmin(expiringWithinDays);
    return agreements.map((agreement) => ({
      ...this.agreementsService.toView(agreement),
      organization_id: agreement.organization_id,
      notes: agreement.notes,
    }));
  }

  /** Créé en `draft` : un contrat en cours de rédaction n'habilite rien. */
  @Post('agreements')
  async createAgreement(
    @CurrentAppUser() appUser: User,
    @Body() dto: CreateEnterpriseAgreementDto,
  ) {
    const agreement = await this.agreementsService.create(dto, appUser.id);
    return {
      ...this.agreementsService.toView(agreement),
      organization_id: agreement.organization_id,
    };
  }

  @Patch('agreements/:id')
  async updateAgreement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEnterpriseAgreementDto,
  ) {
    const agreement = await this.agreementsService.update(id, dto);
    return {
      ...this.agreementsService.toView(agreement),
      organization_id: agreement.organization_id,
    };
  }

  /** La ligne est conservée : l'historique contractuel ne se supprime pas. */
  @Post('agreements/:id/terminate')
  @HttpCode(HttpStatus.OK)
  async terminateAgreement(@Param('id', ParseUUIDPipe) id: string) {
    const agreement = await this.agreementsService.terminate(id);
    return {
      ...this.agreementsService.toView(agreement),
      organization_id: agreement.organization_id,
    };
  }

  @Get('sso/connections')
  listConnections() {
    return this.ssoConnectionsService.listConnections();
  }

  @Post('sso/connections')
  async createConnection(
    @CurrentAppUser() appUser: User,
    @Body() dto: CreateSsoConnectionDto,
  ) {
    return this.ssoConnectionsService.createConnection(dto, appUser.id);
  }

  @Delete('sso/connections/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConnection(@Param('id', ParseUUIDPipe) id: string) {
    await this.ssoConnectionsService.deleteConnection(id);
  }
}
