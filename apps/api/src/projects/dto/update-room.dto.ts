import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}
