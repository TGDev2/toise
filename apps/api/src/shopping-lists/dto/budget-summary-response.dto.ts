import type { BudgetSummary } from '../entities/shopping-list.entity';

export class BudgetSummaryResponseDto {
  total_real_cost!: number;
  total_brute_cost!: number;
  savings_amount!: number;
  savings_percent!: number;
  items_priced!: number;
  items_total!: number;
  is_complete!: boolean;
  by_category!: {
    category: string;
    label: string;
    real_cost: number;
    brute_cost: number;
  }[];
  computed_at!: string;
  // COM-1 : distingue « resume calculable maintenant » (is_complete) de
  // « resume reellement persiste par finalize() ». regenerate() peut effacer
  // le budget_summary_json persiste sur un projet deja COMPLETED sans que
  // is_complete ne le signale — les appelants qui doivent s'assurer que le
  // budget reel est bien fige (ex. partage communaute) verifient ce champ.
  is_finalized!: boolean;

  static fromSummary(
    summary: BudgetSummary,
    isFinalized = true,
  ): BudgetSummaryResponseDto {
    const dto = new BudgetSummaryResponseDto();
    dto.total_real_cost = summary.total_real_cost;
    dto.total_brute_cost = summary.total_brute_cost;
    dto.savings_amount = summary.savings_amount;
    dto.savings_percent = summary.savings_percent;
    dto.items_priced = summary.items_priced;
    dto.items_total = summary.items_total;
    dto.is_complete = summary.is_complete;
    dto.by_category = summary.by_category;
    dto.computed_at = summary.computed_at;
    dto.is_finalized = isFinalized;
    return dto;
  }
}
