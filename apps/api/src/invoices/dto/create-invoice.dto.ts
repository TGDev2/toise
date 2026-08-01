import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { OperationCategory } from '../entities/invoice.entity';

export class CreateInvoiceDto {
  @IsUUID()
  quote_id!: string;

  /** Par défaut : aujourd'hui, en Europe/Paris. */
  @IsOptional()
  @IsDateString()
  issued_on?: string;

  /** Date de la prestation (art. 242 nonies A du CGI). Par défaut : `issued_on`. */
  @IsOptional()
  @IsDateString()
  supply_date?: string;

  /** Par défaut : `issued_on` + délai de paiement du profil, ou 30 jours. */
  @IsOptional()
  @IsDateString()
  due_on?: string;

  @IsOptional()
  @IsString()
  payment_terms?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Mention 2026 : adresse de livraison si différente de l'adresse de facturation. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  delivery_address?: string;

  /** Mention 2026 : nature des opérations facturées. */
  @IsOptional()
  @IsEnum(OperationCategory)
  operation_category?: OperationCategory;

  /** Mention 2026 : option pour le paiement de la TVA d'après les débits. */
  @IsOptional()
  @IsBoolean()
  vat_on_debits?: boolean;
}
