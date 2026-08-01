import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { OrganizationRole } from '../entities/organization-membership.entity';

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  /** `owner` est exclu : la propriété se transfère, elle ne s'invite pas. */
  @IsOptional()
  @IsEnum([OrganizationRole.ADMIN, OrganizationRole.MEMBER])
  role?: OrganizationRole.ADMIN | OrganizationRole.MEMBER;
}
