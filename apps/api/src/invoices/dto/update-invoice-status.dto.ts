import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { InvoiceStatus } from '../entities/invoice.entity';

export class UpdateInvoiceStatusDto {
  @IsEnum(InvoiceStatus)
  status!: InvoiceStatus;

  /** Date réelle du règlement ; par défaut l'instant du passage à `paid`. */
  @IsOptional()
  @IsDateString()
  paid_at?: string;
}
