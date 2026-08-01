export interface EcoItemDto {
  material_id: string;
  material_name: string;
  eco_label_fr: string | null;
}

export interface EcoSuggestionDto {
  material_id: string;
  material_name: string;
  eco_material_id: string;
  eco_material_name: string;
  eco_label_fr: string | null;
}

export class EcoSuggestionsResponseDto {
  eco_items!: EcoItemDto[];
  suggestions!: EcoSuggestionDto[];

  static fromResult(result: {
    eco_items: EcoItemDto[];
    suggestions: EcoSuggestionDto[];
  }): EcoSuggestionsResponseDto {
    const dto = new EcoSuggestionsResponseDto();
    dto.eco_items = result.eco_items;
    dto.suggestions = result.suggestions;
    return dto;
  }
}
