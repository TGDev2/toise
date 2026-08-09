import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { FeatureGateGuard } from '../feature-gates/guards/feature-gate.guard';
import { RequireFeature } from '../feature-gates/decorators/require-feature.decorator';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { UserContextService } from '../users/user-context.service';
import type { UserScope } from '../users/user-context.service';
import { QuantityValidationsService } from './quantity-validations.service';
import type { QuantityValidationState } from './quantity-validations.service';
import { ValidateQuantitiesDto } from './dto/validate-quantities.dto';

/**
 * E2-4 — la validation des quantités, à l'écran qui précède l'émission.
 *
 * Derrière `export_devis` comme le devis lui-même : valider des quantités n'a
 * de sens que pour qui va en émettre un. Un compte gratuit ne voit donc pas ce
 * geste, et n'en subit pas le coût.
 */
@Controller('projects')
@UseGuards(FirebaseAuthGuard, FeatureGateGuard)
export class QuantityValidationsController {
  constructor(
    private readonly service: QuantityValidationsService,
    private readonly userContext: UserContextService,
  ) {}

  private async resolveScope(firebaseUser: DecodedIdToken): Promise<UserScope> {
    try {
      return await this.userContext.resolveForFirebaseUid(firebaseUser.uid);
    } catch {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
  }

  @Get(':id/quantity-validation')
  @RequireFeature('export_devis')
  async getState(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
  ): Promise<QuantityValidationState> {
    const scope = await this.resolveScope(firebaseUser);
    return this.service.getState(projectId, scope.userId);
  }

  @Post(':id/quantity-validation')
  @RequireFeature('export_devis')
  async validate(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: ValidateQuantitiesDto,
  ): Promise<QuantityValidationState> {
    const scope = await this.resolveScope(firebaseUser);
    return this.service.validate(projectId, scope, dto);
  }
}
