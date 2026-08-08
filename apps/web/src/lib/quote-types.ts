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
  /** E1-11 — déjà rendue côté API, réglage marques déjà tranché. */
  justification_fr?: string;
  justification_url?: string;
}

/**
 * Une ligne de MO du devis (E2-3). `line_total_ht` est présent sur la ligne
 * lue (`Quote`, réponse de `/quotes/labor-proposal`) mais absent sur la ligne
 * envoyée (`QuoteLaborLineInput`) : le serveur le recalcule toujours, il ne
 * fait jamais confiance à celui du client.
 */
/**
 * E2-2 — d'où sort le nombre d'heures proposé. Présent **uniquement** sur la
 * réponse de `/quotes/labor-proposal`, jamais sur une ligne lue d'un devis :
 * l'artisan corrige ses heures librement, et une source figée à côté d'une
 * quantité corrigée deviendrait une citation fausse. L'écran de création
 * l'affiche comme la base proposée, pas comme la justification du devis.
 */
export interface QuoteLaborBasis {
  hours_per_unit: number;
  unit_basis: string;
  skill_level: string | null;
  source_org: string;
  source_document: string;
  source_url: string;
}

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
  basis?: QuoteLaborBasis;
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
  /**
   * E1-11 — détail des fournitures ligne à ligne, optionnel et désactivé par
   * défaut : le détailler expose la marge de l'artisan sur les matériaux.
   */
  show_material_details: boolean;
  /** N'a de sens que si `show_material_details` est vrai. */
  show_material_justifications: boolean;
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
  /**
   * E2-5 — noms des pièces réellement couvertes par ce devis, dérivés
   * serveur de l'estimation d'origine (`GET /quotes/:id` seulement).
   */
  covered_rooms?: string[];
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
  show_material_details?: boolean;
  show_material_justifications?: boolean;
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

export interface UpdateClientPayload {
  name?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  postal_code?: string;
  city?: string;
  is_company?: boolean;
  siret?: string | null;
  vat_number?: string | null;
  country?: string;
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
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
