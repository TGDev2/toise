export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'refused'
  | 'negotiation';

export type LaborType = 'hourly' | 'flat';

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

export interface Quote {
  id: string;
  user_id: string;
  project_id: string;
  client_id: string | null;
  estimation_id: string;
  quote_number: string;
  status: QuoteStatus;
  labor_type: LaborType;
  labor_hourly_rate: number | null;
  labor_estimated_hours: number | null;
  labor_flat_amount: number | null;
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
  created_at: string;
  updated_at: string;
}

export interface CreateQuotePayload {
  project_id: string;
  estimation_id: string;
  client_id?: string;
  labor_type: LaborType;
  labor_hourly_rate?: number;
  labor_estimated_hours?: number;
  labor_flat_amount?: number;
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
