import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { AnalyticsService } from './analytics.service';
import { TrackEventDto } from './dto/track-event.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly usersService: UsersService,
  ) {}

  @Post('events')
  @UseGuards(FirebaseAuthGuard)
  async trackEvent(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: TrackEventDto,
  ) {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    this.analyticsService.track(
      dto.event_name,
      user?.id ?? null,
      dto.properties ?? {},
    );
    return { ok: true };
  }
}
