import {
  Controller,
  Get,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { FeatureGateGuard } from '../feature-gates/guards/feature-gate.guard';
import { RequireFeature } from '../feature-gates/decorators/require-feature.decorator';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { OrgContextService } from '../organizations/org-context.service';
import type { OrgScope } from '../organizations/org-context.service';
import { LogbookService } from './logbook.service';
import { RoomLogEntry } from './entities/room-log-entry.entity';

@Controller('logbook')
@UseGuards(FirebaseAuthGuard, FeatureGateGuard)
export class LogbookController {
  constructor(
    private readonly logbookService: LogbookService,
    private readonly orgContext: OrgContextService,
  ) {}

  private async resolveScope(firebaseUser: DecodedIdToken): Promise<OrgScope> {
    try {
      return await this.orgContext.resolveForFirebaseUid(firebaseUser.uid);
    } catch {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
  }

  @Get()
  @RequireFeature('logbook')
  async findAll(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
  ): Promise<RoomLogEntry[]> {
    const scope = await this.resolveScope(firebaseUser);
    return this.logbookService.findAllByUser(scope.organizationId);
  }
}
