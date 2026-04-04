import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ComparePricesRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  postal_code?: string;
}
