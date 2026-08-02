import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { FeatureGateGuard } from '../feature-gates/guards/feature-gate.guard';
import { RequireFeature } from '../feature-gates/decorators/require-feature.decorator';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { OrgContextService } from '../organizations/org-context.service';
import type { OrgScope } from '../organizations/org-context.service';
import { EnterpriseAgreementsService } from './enterprise-agreements.service';
import {
  ENTERPRISE_SSO_FEATURE_KEY,
  SsoConnectionsService,
} from './sso-connections.service';
import { UpdateSsoConnectionDto } from './dto/update-sso-connection.dto';
import { AddSsoDomainDto } from './dto/add-sso-domain.dto';

/**
 * Surface Enterprise de l'organisation cliente (BACKLOG PLAT-6).
 *
 * Elle expose la **politique** et la lecture du contrat, jamais les paramètres de
 * l'IdP : changer un certificat transporte des secrets et peut couper l'accès de
 * toute l'entreprise, cela reste un geste d'administrateur plateforme
 * (`AdminEnterpriseController`).
 *
 * `GET /enterprise/agreement` n'est volontairement derrière aucune gate : une
 * organisation dont le contrat vient d'expirer doit pouvoir constater pourquoi
 * elle a perdu ses capacités. L'absence de contrat rend un 404, pas un 403.
 *
 * Le `@Throttle` de classe resserre le plafond global (100/min) à 30/min :
 * surface d'administration, jamais appelée en rafale.
 */
@Controller('enterprise')
@UseGuards(FirebaseAuthGuard, FeatureGateGuard)
@Throttle({ default: { ttl: 60000, limit: 30 } })
export class EnterpriseController {
  constructor(
    private readonly agreementsService: EnterpriseAgreementsService,
    private readonly ssoConnectionsService: SsoConnectionsService,
    private readonly orgContext: OrgContextService,
  ) {}

  private resolveScope(firebaseUser: DecodedIdToken): Promise<OrgScope> {
    return this.orgContext.resolveForFirebaseUid(firebaseUser.uid);
  }

  @Get('agreement')
  async getAgreement(@CurrentFirebaseUser() firebaseUser: DecodedIdToken) {
    const scope = await this.resolveScope(firebaseUser);
    const agreement = await this.agreementsService.findCurrentForOrganization(
      scope.organizationId,
    );
    return this.agreementsService.toView(agreement);
  }

  @Get('sso/connection')
  @RequireFeature(ENTERPRISE_SSO_FEATURE_KEY)
  async getConnection(@CurrentFirebaseUser() firebaseUser: DecodedIdToken) {
    const scope = await this.resolveScope(firebaseUser);
    return this.ssoConnectionsService.findForOrganization(scope.organizationId);
  }

  @Patch('sso/connection')
  @RequireFeature(ENTERPRISE_SSO_FEATURE_KEY)
  async updateConnection(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: UpdateSsoConnectionDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.ssoConnectionsService.updateForOrganization(scope, dto);
  }

  @Post('sso/domains')
  @RequireFeature(ENTERPRISE_SSO_FEATURE_KEY)
  async addDomain(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: AddSsoDomainDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.ssoConnectionsService.addDomain(scope, dto);
  }

  /** Rejouable : la propagation DNS n'est pas instantanée. */
  @Post('sso/domains/:id/verify')
  @RequireFeature(ENTERPRISE_SSO_FEATURE_KEY)
  @HttpCode(HttpStatus.OK)
  async verifyDomain(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.ssoConnectionsService.verifyDomain(scope, id);
  }

  @Delete('sso/domains/:id')
  @RequireFeature(ENTERPRISE_SSO_FEATURE_KEY)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDomain(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    await this.ssoConnectionsService.removeDomain(scope, id);
  }
}
