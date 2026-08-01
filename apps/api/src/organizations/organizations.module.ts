import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';
import { EmailModule } from '../email/email.module';
import { Organization } from './entities/organization.entity';
import { OrganizationMembership } from './entities/organization-membership.entity';
import { OrganizationInvitation } from './entities/organization-invitation.entity';
import { OrgContextModule } from './org-context.module';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Organization,
      OrganizationMembership,
      OrganizationInvitation,
    ]),
    OrgContextModule,
    FeatureGatesModule,
    EmailModule,
  ],
  providers: [OrganizationsService],
  controllers: [OrganizationsController],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
