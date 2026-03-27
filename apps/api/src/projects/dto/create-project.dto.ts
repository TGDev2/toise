import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { WorkType } from '../entities/project.entity';

export class CreateProjectDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  room_name?: string;

  @IsOptional()
  @IsEnum(WorkType)
  work_type?: WorkType;
}
