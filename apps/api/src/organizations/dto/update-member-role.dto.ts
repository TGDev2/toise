import { IsEnum } from 'class-validator';
import { OrganizationRole } from '../entities/organization-membership.entity';

export class UpdateMemberRoleDto {
  @IsEnum([OrganizationRole.ADMIN, OrganizationRole.MEMBER])
  role!: OrganizationRole.ADMIN | OrganizationRole.MEMBER;
}
