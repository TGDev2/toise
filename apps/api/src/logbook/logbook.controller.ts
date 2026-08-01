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
import { UsersService } from '../users/users.service';
import { LogbookService } from './logbook.service';
import { RoomLogEntry } from './entities/room-log-entry.entity';

@Controller('logbook')
@UseGuards(FirebaseAuthGuard, FeatureGateGuard)
export class LogbookController {
  constructor(
    private readonly logbookService: LogbookService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveUserId(firebaseUser: DecodedIdToken): Promise<string> {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
    return user.id;
  }

  @Get()
  @RequireFeature('logbook')
  async findAll(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
  ): Promise<RoomLogEntry[]> {
    const userId = await this.resolveUserId(firebaseUser);
    return this.logbookService.findAllByUser(userId);
  }
}
