import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { AnalyticsService } from './analytics.service';
import { TrackPublicEventDto } from './dto/track-public-event.dto';

// Public endpoint (auth optionnelle) : permet de tracer des événements avant
// toute création de compte (ex. visite d'un calculateur /calculateurs/[type]),
// tout en attribuant l'événement à un user_id si l'appelant a déjà une session
// (y compris invitée) — voir community.controller.ts pour le même pattern.
@Controller('public/analytics')
export class PublicAnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveUserId(
    firebaseUser: DecodedIdToken | null,
  ): Promise<string | null> {
    if (!firebaseUser) return null;
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    return user?.id ?? null;
  }

  @Post('events')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OptionalAuthGuard)
  // Override both named throttlers: the global 'auth' default (5 req/15 min)
  // would otherwise cap this public endpoint. Mirrors public-calculators.controller.ts.
  @Throttle({
    short: { ttl: 60000, limit: 30 },
    auth: { ttl: 60000, limit: 30 },
  })
  async trackEvent(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken | null,
    @Body() dto: TrackPublicEventDto,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    this.analyticsService.track(dto.event_name, userId, dto.properties ?? {});
    return { ok: true };
  }
}
