import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { UserContextService } from '../users/user-context.service';
import { CompanyProfilesService } from './company-profiles.service';
import { CreateCompanyProfileDto } from './dto/create-company-profile.dto';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Controller('company-profiles')
@UseGuards(FirebaseAuthGuard)
export class CompanyProfilesController {
  constructor(
    private readonly companyProfilesService: CompanyProfilesService,
    private readonly userContext: UserContextService,
  ) {}

  @Post()
  async create(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: CreateCompanyProfileDto,
  ) {
    const scope = await this.userContext.resolveForFirebaseUid(
      firebaseUser.uid,
    );
    return this.companyProfilesService.create(scope.userId, dto);
  }

  @Get('me')
  async getMyProfile(@CurrentFirebaseUser() firebaseUser: DecodedIdToken) {
    const scope = await this.userContext.resolveForFirebaseUid(
      firebaseUser.uid,
    );
    const profile = await this.companyProfilesService.findByUserId(
      scope.userId,
    );
    if (!profile) throw new NotFoundException('Aucun profil entreprise trouve');
    return profile;
  }

  @Put('me')
  async updateMyProfile(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: UpdateCompanyProfileDto,
  ) {
    const scope = await this.userContext.resolveForFirebaseUid(
      firebaseUser.uid,
    );
    return this.companyProfilesService.update(scope.userId, dto);
  }
}
