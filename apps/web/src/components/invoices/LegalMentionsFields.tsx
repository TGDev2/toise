'use client';

import { Input } from '@/components/ui';

/**
 * Mentions légales de facturation du profil entreprise (PRO-4).
 *
 * Bloc extrait dans son propre composant plutôt qu'ajouté en ligne à la page de
 * réglages : 14 champs supplémentaires y auraient doublé la longueur du fichier
 * et la liste doit rester alignée sur `invoice-legal-mentions.ts` côté API.
 */
export interface LegalMentions {
  legal_form: string;
  capital_social: string;
  vat_number: string;
  vat_exempt: boolean;
  rcs_city: string;
  rm_department: string;
  insurance_name: string;
  insurance_policy: string;
  insurance_coverage: string;
  iban: string;
  bic: string;
  email: string;
  late_penalty_rate: string;
  default_payment_terms_days: string;
}

export const EMPTY_LEGAL_MENTIONS: LegalMentions = {
  legal_form: '',
  capital_social: '',
  vat_number: '',
  vat_exempt: false,
  rcs_city: '',
  rm_department: '',
  insurance_name: '',
  insurance_policy: '',
  insurance_coverage: '',
  iban: '',
  bic: '',
  email: '',
  late_penalty_rate: '',
  default_payment_terms_days: '',
};

/** Les champs vides sont omis : l'API les valide seulement s'ils sont présents. */
export function toLegalMentionsPayload(
  values: LegalMentions,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { vat_exempt: values.vat_exempt };

  const text: (keyof LegalMentions)[] = [
    'legal_form',
    'vat_number',
    'rcs_city',
    'rm_department',
    'insurance_name',
    'insurance_policy',
    'insurance_coverage',
    'iban',
    'bic',
    'email',
  ];
  for (const key of text) {
    const value = String(values[key] ?? '').trim();
    if (value) payload[key] = value;
  }

  const numeric: (keyof LegalMentions)[] = [
    'capital_social',
    'late_penalty_rate',
    'default_payment_terms_days',
  ];
  for (const key of numeric) {
    const value = String(values[key] ?? '').trim();
    if (value !== '' && !Number.isNaN(Number(value))) {
      payload[key] = Number(value);
    }
  }

  return payload;
}

export function fromCompanyProfile(
  profile: Partial<LegalMentions>,
): LegalMentions {
  const next = { ...EMPTY_LEGAL_MENTIONS };
  for (const key of Object.keys(EMPTY_LEGAL_MENTIONS) as (keyof LegalMentions)[]) {
    const value = profile[key];
    if (key === 'vat_exempt') {
      next.vat_exempt = Boolean(value);
    } else if (value != null) {
      (next[key] as string) = String(value);
    }
  }
  return next;
}

interface LegalMentionsFieldsProps {
  values: LegalMentions;
  onChange: (values: LegalMentions) => void;
}

export function LegalMentionsFields({
  values,
  onChange,
}: LegalMentionsFieldsProps) {
  const set = <K extends keyof LegalMentions>(
    key: K,
    value: LegalMentions[K],
  ) => onChange({ ...values, [key]: value });

  return (
    <div className="space-y-4 rounded-3xl border border-stone-200 bg-white/60 p-5">
      <div>
        <h2 className="text-base font-semibold text-stone-950">
          Mentions légales et facturation
        </h2>
        <p className="mt-1 text-xs text-stone-500">
          Obligatoires pour émettre une facture conforme. Sans elles, la
          conversion d&apos;un devis en facture est refusée.
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm text-stone-700">
        <input
          type="checkbox"
          className="mt-1"
          checked={values.vat_exempt}
          onChange={(e) => set('vat_exempt', e.target.checked)}
        />
        <span>
          Franchise en base de TVA
          <span className="block text-xs text-stone-500">
            Mention « TVA non applicable, art. 293 B du CGI ». Les factures
            seront émises sans TVA.
          </span>
        </span>
      </label>

      {!values.vat_exempt && (
        <Input
          id="vatNumber"
          type="text"
          label="N° de TVA intracommunautaire"
          hint="Format FRxx999999999"
          value={values.vat_number}
          onChange={(e) => set('vat_number', e.target.value.toUpperCase())}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="rcsCity"
          type="text"
          label="Ville du RCS"
          hint="Sociétés — le n° RCS est votre SIREN"
          value={values.rcs_city}
          onChange={(e) => set('rcs_city', e.target.value)}
        />
        <Input
          id="rmDepartment"
          type="text"
          label="Département du répertoire des métiers"
          hint="Artisans — à défaut du RCS"
          value={values.rm_department}
          onChange={(e) => set('rm_department', e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="legalForm"
          type="text"
          label="Forme juridique"
          hint="SARL, SASU, EI... (facultatif)"
          value={values.legal_form}
          onChange={(e) => set('legal_form', e.target.value)}
        />
        <Input
          id="capitalSocial"
          type="number"
          min={0}
          step="0.01"
          label="Capital social (EUR)"
          hint="Sociétés uniquement (facultatif)"
          value={values.capital_social}
          onChange={(e) => set('capital_social', e.target.value)}
        />
      </div>

      <Input
        id="insuranceName"
        type="text"
        label="Assureur décennale"
        hint="Obligatoire pour le BTP (art. L243-2 du code des assurances)"
        value={values.insurance_name}
        onChange={(e) => set('insurance_name', e.target.value)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="insurancePolicy"
          type="text"
          label="N° de contrat"
          value={values.insurance_policy}
          onChange={(e) => set('insurance_policy', e.target.value)}
        />
        <Input
          id="insuranceCoverage"
          type="text"
          label="Couverture géographique"
          hint="Ex. France métropolitaine"
          value={values.insurance_coverage}
          onChange={(e) => set('insurance_coverage', e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="iban"
          type="text"
          label="IBAN"
          hint="Imprimé sur vos factures"
          value={values.iban}
          onChange={(e) =>
            set('iban', e.target.value.replace(/\s/g, '').toUpperCase())
          }
        />
        <Input
          id="bic"
          type="text"
          label="BIC"
          value={values.bic}
          onChange={(e) => set('bic', e.target.value.toUpperCase())}
        />
      </div>

      <Input
        id="companyEmail"
        type="email"
        label="E-mail de facturation"
        value={values.email}
        onChange={(e) => set('email', e.target.value)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="latePenaltyRate"
          type="number"
          min={0}
          max={100}
          step="0.01"
          label="Taux de pénalités de retard (%)"
          hint="À défaut : taux légal majoré de 10 points"
          value={values.late_penalty_rate}
          onChange={(e) => set('late_penalty_rate', e.target.value)}
        />
        <Input
          id="paymentTermsDays"
          type="number"
          min={0}
          max={90}
          label="Délai de paiement (jours)"
          hint="Maximum légal : 60 jours (90 fin de mois)"
          value={values.default_payment_terms_days}
          onChange={(e) => set('default_payment_terms_days', e.target.value)}
        />
      </div>
    </div>
  );
}
