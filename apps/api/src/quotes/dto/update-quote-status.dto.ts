import { IsEnum } from 'class-validator';
import { QuoteStatus } from '../entities/quote.entity';

export class UpdateQuoteStatusDto {
  @IsEnum(QuoteStatus)
  status!: QuoteStatus;
}
