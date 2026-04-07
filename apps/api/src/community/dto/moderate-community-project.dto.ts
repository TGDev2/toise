import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ModerationAction {
  APPROVE = 'approve',
  REJECT = 'reject',
}

export class ModerateCommunityProjectDto {
  @IsEnum(ModerationAction)
  action!: ModerationAction;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rejection_reason?: string;
}
