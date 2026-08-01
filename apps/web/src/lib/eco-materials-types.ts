export interface EcoItem {
  material_id: string;
  material_name: string;
  eco_label_fr: string | null;
}

export interface EcoSuggestion {
  material_id: string;
  material_name: string;
  eco_material_id: string;
  eco_material_name: string;
  eco_label_fr: string | null;
}

export interface EcoSuggestionsResponse {
  eco_items: EcoItem[];
  suggestions: EcoSuggestion[];
}

export interface EcoRowData {
  is_eco: boolean;
  eco_label_fr: string | null;
  suggestion?: {
    eco_material_id: string;
    eco_material_name: string;
    eco_label_fr: string | null;
  };
}
