import { IsString, IsOptional, IsObject, MaxLength } from 'class-validator';

export class TrackEventDto {
  @IsString()
  @MaxLength(50)
  event_name!: string;

  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;
}
