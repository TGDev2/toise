import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { PUBLIC_API_FEATURE_KEY } from '../api-keys/guards/api-key.guard';
import { WidgetService } from './widget.service';
import { UpdateWidgetConfigDto } from './dto/update-widget-config.dto';

/**
 * Gestion de la configuration du widget par les humains de l'organisation
 * (BACKLOG PLAT-7). Authentification Firebase — c'est la surface
 * *administrative*, pas le widget lui-même. Pas d'écran de tableau de bord
 * dédié pour l'instant : même choix que les clés d'API (PLAT-5), qui n'en ont
 * pas non plus — cette surface s'utilise directement.
 *
 * Le `@Throttle` de classe est requis : le limiteur `auth` global (5 req/15
 * min par IP) s'appliquerait sinon à toute l'organisation derrière un même NAT.
 */
@Controller('widget-config')
@UseGuards(FirebaseAuthGuard, FeatureGateGuard)
@Throttle({
  short: { ttl: 60000, limit: 30 },
  auth: { ttl: 60000, limit: 30 },
})
export class WidgetConfigController {
  constructor(
    private readonly widgetService: WidgetService,
    private readonly orgContext: OrgContextService,
  ) {}

  private resolveScope(firebaseUser: DecodedIdToken): Promise<OrgScope> {
    return this.orgContext.resolveForFirebaseUid(firebaseUser.uid);
  }

  @Get()
  @RequireFeature(PUBLIC_API_FEATURE_KEY)
  async get(@CurrentFirebaseUser() firebaseUser: DecodedIdToken) {
    const scope = await this.resolveScope(firebaseUser);
    return this.widgetService.getOrCreate(scope);
  }

  @Patch()
  @RequireFeature(PUBLIC_API_FEATURE_KEY)
  async update(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: UpdateWidgetConfigDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.widgetService.update(scope, dto);
  }

  @Post('regenerate-key')
  @RequireFeature(PUBLIC_API_FEATURE_KEY)
  @HttpCode(HttpStatus.OK)
  async regenerateKey(@CurrentFirebaseUser() firebaseUser: DecodedIdToken) {
    const scope = await this.resolveScope(firebaseUser);
    return this.widgetService.regenerateKey(scope);
  }
}
