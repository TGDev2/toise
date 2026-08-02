import {
  Controller,
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CompanyProfilesService } from '../company-profiles/company-profiles.service';
import { OrgContextService } from '../organizations/org-context.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { MergeGuestDto } from './dto/merge-guest.dto';
import { RegisterDto } from './dto/register.dto';
import { CurrentFirebaseUser } from './decorators/current-user.decorator';
import { SsoExempt } from './decorators/sso-exempt.decorator';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly companyProfilesService: CompanyProfilesService,
    private readonly orgContext: OrgContextService,
  ) {}

  @Post('register')
  @Throttle({ default: { ttl: 900000, limit: 5 } })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return {
      user_id: result.user.id,
      message: result.message,
    };
  }

  /**
   * Dispensée d'enforcement SSO (PLAT-6 D10) : c'est la route qui *matérialise*
   * le rattachement JIT — l'exiger déjà rattaché serait circulaire — et la seule
   * par laquelle un membre bloqué peut apprendre pourquoi.
   */
  @Post('sync')
  @SsoExempt()
  @UseGuards(FirebaseAuthGuard)
  async sync(@CurrentFirebaseUser() firebaseUser: DecodedIdToken) {
    const user = await this.authService.syncUser(firebaseUser);
    const scope = await this.orgContext.resolveForUser(user);
    const companyProfile =
      await this.companyProfilesService.findByOrganizationId(
        scope.organizationId,
      );
    return {
      id: user.id,
      email: user.email,
      auth_provider: user.auth_provider,
      subscription_tier: user.subscription_tier,
      role: user.role,
      email_verified: user.email_verified,
      created_at: user.created_at,
      has_company_profile: !!companyProfile,
    };
  }

  @Post('forgot-password')
  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Get('me')
  @SsoExempt()
  @UseGuards(FirebaseAuthGuard)
  async getProfile(@CurrentFirebaseUser() firebaseUser: DecodedIdToken) {
    const user = await this.authService.getProfile(firebaseUser.uid);
    const scope = await this.orgContext.resolveForUser(user);
    const companyProfile =
      await this.companyProfilesService.findByOrganizationId(
        scope.organizationId,
      );
    return {
      id: user.id,
      email: user.email,
      auth_provider: user.auth_provider,
      subscription_tier: user.subscription_tier,
      role: user.role,
      email_verified: user.email_verified,
      created_at: user.created_at,
      has_company_profile: !!companyProfile,
    };
  }

  @Delete('me')
  @UseGuards(FirebaseAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentFirebaseUser() firebaseUser: DecodedIdToken) {
    await this.authService.deleteAccount(firebaseUser.uid);
  }

  @Post('merge-guest')
  @UseGuards(FirebaseAuthGuard)
  async mergeGuest(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: MergeGuestDto,
  ) {
    const user = await this.authService.mergeGuestAccount(
      firebaseUser.uid,
      dto.anonymous_firebase_uid,
    );
    return {
      id: user.id,
      email: user.email,
      auth_provider: user.auth_provider,
      message: 'Guest account merged successfully',
    };
  }
}
