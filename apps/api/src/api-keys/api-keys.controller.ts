import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { ApiKeysService } from './api-keys.service';
import { ApiUsageService, monthlyQuotaFor } from './api-usage.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { PUBLIC_API_FEATURE_KEY } from './guards/api-key.guard';

/**
 * Gestion des clés d'API par les humains de l'organisation (BACKLOG PLAT-5).
 * Authentification Firebase classique — c'est la surface *administrative*, pas
 * l'API publique elle-même.
 *
 * Le `@Throttle` de classe est obligatoire, pas décoratif : le limiteur `auth`
 * déclaré globalement (`app.module.ts`) s'applique à toutes les routes et les
 * plafonnerait sinon à 5 requêtes/15 min par IP — un bureau derrière un seul
 * NAT partagerait ce compteur. Même précaution que `public-calculators.controller.ts`.
 */
@Controller('api-keys')
@UseGuards(FirebaseAuthGuard, FeatureGateGuard)
@Throttle({
  short: { ttl: 60000, limit: 30 },
  auth: { ttl: 60000, limit: 30 },
})
export class ApiKeysController {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly apiUsageService: ApiUsageService,
    private readonly orgContext: OrgContextService,
  ) {}

  private resolveScope(firebaseUser: DecodedIdToken): Promise<OrgScope> {
    return this.orgContext.resolveForFirebaseUid(firebaseUser.uid);
  }

  @Get()
  @RequireFeature(PUBLIC_API_FEATURE_KEY)
  async list(@CurrentFirebaseUser() firebaseUser: DecodedIdToken) {
    const scope = await this.resolveScope(firebaseUser);
    return this.apiKeysService.list(scope);
  }

  // Déclarée avant toute route paramétrée, pour qu'un futur `@Get(':id')` ne
  // capture pas « usage ». Même précaution que `GET /projects/work-types`.
  @Get('usage')
  @RequireFeature(PUBLIC_API_FEATURE_KEY)
  async usage(@CurrentFirebaseUser() firebaseUser: DecodedIdToken) {
    const scope = await this.resolveScope(firebaseUser);
    const usage = await this.apiUsageService.peek(scope.organizationId);
    return { ...usage, limit: monthlyQuotaFor(scope.effectiveTier) };
  }

  /** Le secret n'est renvoyé qu'ici, une seule fois : il n'est plus relisible. */
  @Post()
  @RequireFeature(PUBLIC_API_FEATURE_KEY)
  async create(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: CreateApiKeyDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.apiKeysService.create(scope, dto);
  }

  @Post(':id/rotate')
  @RequireFeature(PUBLIC_API_FEATURE_KEY)
  @HttpCode(HttpStatus.OK)
  async rotate(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.apiKeysService.rotate(scope, id);
  }

  @Delete(':id')
  @RequireFeature(PUBLIC_API_FEATURE_KEY)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    await this.apiKeysService.revoke(scope, id);
  }
}
