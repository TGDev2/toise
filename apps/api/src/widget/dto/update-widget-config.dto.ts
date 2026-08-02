import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

/** `scheme://host[:port]` strict — pas de chemin, pas de slash final. */
const ORIGIN_PATTERN = /^https?:\/\/[a-zA-Z0-9.-]+(:\d+)?$/;

export class UpdateWidgetConfigDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Matches(ORIGIN_PATTERN, { each: true })
  allowed_origins?: string[];

  @IsOptional()
  @IsString()
  @Length(1, 100)
  display_name?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  accent_color?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
