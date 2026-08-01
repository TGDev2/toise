import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCommunityProjectDto {
  @IsUUID()
  project_id!: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsInt()
  @Min(1)
  duration_days!: number;

  @IsArray()
  @IsUUID('4', { each: true })
  before_photo_ids!: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  after_photo_ids!: string[];

  @IsBoolean()
  gdpr_consent!: boolean;
}
