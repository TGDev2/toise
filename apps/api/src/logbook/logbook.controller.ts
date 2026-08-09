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
import { UserContextService } from '../users/user-context.service';
import type { UserScope } from '../users/user-context.service';
import { LogbookService } from './logbook.service';
import { RoomLogEntry } from './entities/room-log-entry.entity';

@Controller('logbook')
@UseGuards(FirebaseAuthGuard, FeatureGateGuard)
export class LogbookController {
  constructor(
    private readonly logbookService: LogbookService,
    private readonly userContext: UserContextService,
  ) {}

  private async resolveScope(firebaseUser: DecodedIdToken): Promise<UserScope> {
    try {
      return await this.userContext.resolveForFirebaseUid(firebaseUser.uid);
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
    // `room_log_entries.user_id` porte une clé étrangère vers `users` et est
    // écrit avec `scope.userId` par `recordChantierCompletion`. Passer
    // `scope.userId` ici comparait deux UUID de deux tables : le
    // carnet renvoyait `[]` à tout le monde depuis PLAT-1. Couvert par
    // `test/logbook.e2e-spec.ts` — le service, lui, n'a jamais eu tort.
    return this.logbookService.findAllByUser(scope.userId);
  }
}
