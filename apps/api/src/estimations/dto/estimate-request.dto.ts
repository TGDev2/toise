import { IsEnum, IsOptional } from 'class-validator';
import { SkillLevel } from '../../projects/entities/project-work-item.entity';

export class EstimateRequestDto {
  @IsOptional()
  @IsEnum(SkillLevel)
  skill_level?: SkillLevel;
}
