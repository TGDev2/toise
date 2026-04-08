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
import { UsersService } from '../users/users.service';
import { CompanyProfilesService } from './company-profiles.service';
import { CreateCompanyProfileDto } from './dto/create-company-profile.dto';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Controller('company-profiles')
@UseGuards(FirebaseAuthGuard)
export class CompanyProfilesController {
  constructor(
    private readonly companyProfilesService: CompanyProfilesService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  async create(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: CreateCompanyProfileDto,
  ) {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) throw new NotFoundException('User not found');
    return this.companyProfilesService.create(user.id, dto);
  }

  @Get('me')
  async getMyProfile(@CurrentFirebaseUser() firebaseUser: DecodedIdToken) {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) throw new NotFoundException('User not found');
    const profile = await this.companyProfilesService.findByUserId(user.id);
    if (!profile) throw new NotFoundException('Aucun profil entreprise trouve');
    return profile;
  }

  @Put('me')
  async updateMyProfile(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: UpdateCompanyProfileDto,
  ) {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) throw new NotFoundException('User not found');
    return this.companyProfilesService.update(user.id, dto);
  }
}
