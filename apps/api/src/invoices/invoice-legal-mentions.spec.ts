import { findMissingLegalMentions } from './invoice-legal-mentions';
import type { CompanyProfile } from '../company-profiles/entities/company-profile.entity';

function makeProfile(overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    raison_sociale: 'Dupont Renovation SARL',
    siret: '12345678901234',
    address_line1: '1 rue de Paris',
    address_line2: null,
    postal_code: '75001',
    city: 'Paris',
    country: 'FR',
    phone: '+33612345678',
    specialties: [],
    legal_form: 'SARL',
    capital_social: 10000,
    vat_number: 'FR12345678901',
    vat_exempt: false,
    rcs_city: 'Paris',
    rm_department: null,
    insurance_name: 'AXA',
    insurance_policy: 'POL-123',
    insurance_coverage: 'France metropolitaine',
    iban: null,
    bic: null,
    email: null,
    late_penalty_rate: null,
    default_payment_terms_days: null,
    ...overrides,
  } as CompanyProfile;
}

describe('findMissingLegalMentions', () => {
  it('accepts a complete profile', () => {
    expect(findMissingLegalMentions(makeProfile())).toEqual([]);
  });

  it('requires a VAT number', () => {
    expect(findMissingLegalMentions(makeProfile({ vat_number: null }))).toEqual(
      ['vat_number'],
    );
  });

  it('accepts the franchise en base instead of a VAT number', () => {
    const profile = makeProfile({ vat_number: null, vat_exempt: true });
    expect(findMissingLegalMentions(profile)).toEqual([]);
  });

  it('requires a registration entry', () => {
    const profile = makeProfile({ rcs_city: null, rm_department: null });
    expect(findMissingLegalMentions(profile)).toEqual(['registration']);
  });

  it('accepts the repertoire des metiers instead of the RCS', () => {
    const profile = makeProfile({ rcs_city: null, rm_department: 'Rhone' });
    expect(findMissingLegalMentions(profile)).toEqual([]);
  });

  it('requires both the insurer and its coverage', () => {
    expect(
      findMissingLegalMentions(makeProfile({ insurance_name: null })),
    ).toEqual(['insurance']);
    expect(
      findMissingLegalMentions(makeProfile({ insurance_coverage: null })),
    ).toEqual(['insurance']);
  });

  it('does not block on the optional company-only mentions', () => {
    const profile = makeProfile({ legal_form: null, capital_social: null });
    expect(findMissingLegalMentions(profile)).toEqual([]);
  });

  it('requires a SIRET and a full address', () => {
    const profile = makeProfile({ siret: '', postal_code: '' });
    expect(findMissingLegalMentions(profile)).toEqual(['siret', 'address']);
  });

  it('reports every missing mention at once', () => {
    const profile = makeProfile({
      vat_number: null,
      rcs_city: null,
      rm_department: null,
      insurance_name: null,
    });
    expect(findMissingLegalMentions(profile)).toEqual([
      'vat_number',
      'registration',
      'insurance',
    ]);
  });
});
