import {
  Body,
  Controller,
  Get,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { ReferralsService, ReferralStats } from './referrals.service';

@Controller('referrals')
@UseGuards(FirebaseAuthGuard)
export class ReferralsController {
  constructor(
    private readonly referralsService: ReferralsService,
    private readonly usersService: UsersService,
  ) {}

  @Get('me')
  async getMyReferrals(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
  ): Promise<ReferralStats> {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
    return this.referralsService.getStats(user.id);
  }

  @Post('redeem')
  async redeem(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() body: { code?: string },
  ): Promise<{ redeemed: boolean }> {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
    return this.referralsService.redeemCode(user, body?.code ?? '');
  }
}
