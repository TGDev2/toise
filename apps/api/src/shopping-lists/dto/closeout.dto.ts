import { Type } from 'class-transformer';
import {
  IsArray,
  IsISO8601,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type { CloseoutSummary } from '../closeout';
import type { BudgetSummary } from '../entities/shopping-list.entity';

/**
 * Même plafond que `UpdateShoppingListDto` : au-delà, ce n'est plus une
 * déclaration d'achat mais une faute de frappe, et elle alimenterait DATA-3
 * avec une perte impliquée arbitrairement grande.
 */
const MAX_UNITS_PER_ITEM = 10_000;

export class MaterialPurchaseDeclarationDto {
  @IsUUID()
  material_id!: string;

  @IsInt()
  @Min(0)
  @Max(MAX_UNITS_PER_ITEM)
  purchased_units!: number;
}

export class ComplementaryPurchaseDeclarationDto {
  @IsUUID()
  complementary_material_id!: string;

  @IsInt()
  @Min(0)
  @Max(MAX_UNITS_PER_ITEM)
  purchased_quantity!: number;
}

/**
 * La seule correction demandée par ligne : « j'en ai acheté combien ».
 *
 * Ni prix ni enseigne ici — ils existent déjà sur la ligne et restent
 * facultatifs. Exiger un prix pour clôturer était précisément ce qui faisait
 * de la finalisation un formulaire sans contrepartie.
 */
export class CloseoutRequestDto {
  /** Date d'achat `yyyy-mm-dd`. Sans elle, aucune échéance n'est affichée. */
  @IsOptional()
  @IsISO8601()
  purchased_on?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialPurchaseDeclarationDto)
  material_items?: MaterialPurchaseDeclarationDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComplementaryPurchaseDeclarationDto)
  complementary_items?: ComplementaryPurchaseDeclarationDto[];
}

export class CloseoutResponseDto {
  closeout!: CloseoutSummary;
  /**
   * Résumé budgétaire calculable en l'état. `null` tant qu'aucun prix n'est
   * connu : la clôture n'en dépend pas.
   */
  budget_summary!: BudgetSummary | null;
  /** `true` une fois le chantier déclaré terminé (projet `completed`). */
  is_finalized!: boolean;

  static from(
    closeout: CloseoutSummary,
    budgetSummary: BudgetSummary | null,
    isFinalized: boolean,
  ): CloseoutResponseDto {
    const dto = new CloseoutResponseDto();
    dto.closeout = closeout;
    dto.budget_summary = budgetSummary;
    dto.is_finalized = isFinalized;
    return dto;
  }
}
