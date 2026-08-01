export type InvoiceStatus = 'issued' | 'paid';

export type InvoiceType = 'solde' | 'acompte' | 'avoir';

export type OperationCategory = 'biens' | 'services' | 'mixte';

export type InvoiceLineKind = 'material' | 'labor' | 'discount';

export interface InvoiceLineItem {
  kind: InvoiceLineKind;
  label: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unit_price_ht: number;
  line_total_ht: number;
  tva_rate: number;
}

export interface InvoicePartySnapshot {
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
  email: string | null;
  phone: string | null;
  siret: string | null;
  siren: string | null;
  vat_number: string | null;
  vat_exempt?: boolean;
  legal_form?: string | null;
  capital_social?: number | null;
  rcs_city?: string | null;
  rm_department?: string | null;
  insurance_name?: string | null;
  insurance_policy?: string | null;
  insurance_coverage?: string | null;
  iban?: string | null;
  bic?: string | null;
  is_company?: boolean;
}

export interface VatBreakdownEntry {
  rate: number;
  base_ht: number;
  tva_amount: number;
  exemption_reason?: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  quote_id: string | null;
  project_id: string | null;
  client_id: string | null;
  invoice_number: string;
  invoice_type: InvoiceType;
  status: InvoiceStatus;
  source_quote_number: string | null;
  issued_on: string;
  supply_date: string | null;
  due_on: string;
  currency: string;
  seller_snapshot: InvoicePartySnapshot;
  buyer_snapshot: InvoicePartySnapshot;
  buyer_siren: string | null;
  delivery_address: string | null;
  operation_category: OperationCategory;
  vat_on_debits: boolean;
  items_json: InvoiceLineItem[];
  vat_breakdown: VatBreakdownEntry[];
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  payment_terms: string | null;
  late_penalty_rate: number | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  project?: { id: string; name: string; room_name: string } | null;
  client?: { id: string; name: string } | null;
}

export interface CreateInvoicePayload {
  quote_id: string;
  issued_on?: string;
  supply_date?: string;
  due_on?: string;
  payment_terms?: string;
  notes?: string;
  delivery_address?: string;
  operation_category?: OperationCategory;
  vat_on_debits?: boolean;
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  issued: 'Émise',
  paid: 'Payée',
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  issued: 'bg-blue-100 text-blue-700',
  paid: 'bg-emerald-100 text-emerald-700',
};

export const INVOICE_LINE_KIND_LABELS: Record<InvoiceLineKind, string> = {
  material: 'Matériaux',
  labor: "Main d'œuvre",
  discount: 'Remise',
};

/**
 * Libellés des clés renvoyées dans `missing_fields` du 400
 * `MISSING_LEGAL_MENTIONS` (cf. `invoice-legal-mentions.ts` côté API).
 */
export const MISSING_LEGAL_MENTION_LABELS: Record<string, string> = {
  company_profile: 'Profil entreprise à créer',
  siret: 'Numéro SIRET',
  address: 'Adresse complète de l’entreprise',
  vat_number:
    'Numéro de TVA intracommunautaire (ou cocher « franchise en base de TVA »)',
  registration:
    'Ville d’immatriculation au RCS, ou département du répertoire des métiers',
  insurance: 'Assurance décennale : assureur et couverture géographique',
};
