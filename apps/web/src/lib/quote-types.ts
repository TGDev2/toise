export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'refused'
  | 'negotiation';

export type QuoteLaborKind = 'hourly' | 'flat';

export interface QuoteLineItem {
  material_name: string;
  material_category: string;
  work_type_label: string;
  packaging_label: string;
  units_needed: number;
  base_unit_price: number;
  margin_percent: number;
  unit_price_with_margin: number;
  line_total_ht: number;
}

/**
 * Une ligne de MO du devis (E2-3). `line_total_ht` est présent sur la ligne
 * lue (`Quote`, réponse de `/quotes/labor-proposal`) mais absent sur la ligne
 * envoyée (`QuoteLaborLineInput`) : le serveur le recalcule toujours, il ne
 * fait jamais confiance à celui du client.
 */
export interface QuoteLaborLine {
  work_item_id: string | null;
  work_type_code: string | null;
  label: string;
  room_name: string | null;
  kind: QuoteLaborKind;
  surface_m2: number | null;
  quantity: number;
  unit_price_ht: number;
  line_total_ht: number;
}

export type QuoteLaborLineInput = Omit<QuoteLaborLine, 'line_total_ht'>;

export interface Quote {
  id: string;
  user_id: string;
  project_id: string;
  client_id: string | null;
  estimation_id: string;
  quote_number: string;
  status: QuoteStatus;
  labor_items_json: QuoteLaborLine[];
  material_margin_percent: number;
  discount_percent: number;
  payment_terms: string | null;
  validity_days: number;
  notes: string | null;
  items_json: QuoteLineItem[];
  subtotal_materials_ht: number;
  subtotal_labor_ht: number;
  total_ht: number;
  tva_rate: number;
  total_ttc: number;
  sent_at: string | null;
  accepted_at: string | null;
  refused_at: string | null;
  reminder_7d_sent_at: string | null;
  reminder_14d_sent_at: string | null;
  created_at: string;
  updated_at: string;
  project?: { id: string; name: string; room_name: string };
  client?: Client | null;
}

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  is_company: boolean;
  siret: string | null;
  vat_number: string | null;
  country: string;
  created_at: string;
  updated_at: string;
}

export interface CreateQuotePayload {
  project_id: string;
  estimation_id: string;
  client_id?: string;
  labor_items?: QuoteLaborLineInput[];
  material_margin_percent: number;
  discount_percent?: number;
  payment_terms?: string;
  validity_days?: number;
  tva_rate?: number;
  notes?: string;
}

export interface CreateClientPayload {
  name: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  postal_code?: string;
  city?: string;
  is_company?: boolean;
  siret?: string;
  vat_number?: string;
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepte',
  refused: 'Refusé',
  negotiation: 'En négociation',
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: 'bg-stone-100 text-stone-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  refused: 'bg-red-100 text-red-700',
  negotiation: 'bg-amber-100 text-amber-700',
};
