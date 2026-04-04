import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { CompanyProfile } from './entities/company-profile.entity';
import { CompanyProfilesService } from './company-profiles.service';
import { CompanyProfilesController } from './company-profiles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyProfile]), UsersModule],
  controllers: [CompanyProfilesController],
  providers: [CompanyProfilesService],
  exports: [CompanyProfilesService],
})
export class CompanyProfilesModule {}
