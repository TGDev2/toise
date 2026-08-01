import {
  EMPTY_LEGAL_MENTIONS,
  fromCompanyProfile,
  toLegalMentionsPayload,
} from '../LegalMentionsFields';

describe('toLegalMentionsPayload', () => {
  it('omits blank fields so the API only validates what was filled in', () => {
    expect(toLegalMentionsPayload(EMPTY_LEGAL_MENTIONS)).toEqual({
      vat_exempt: false,
    });
  });

  it('trims text fields and keeps the filled ones', () => {
    const payload = toLegalMentionsPayload({
      ...EMPTY_LEGAL_MENTIONS,
      vat_number: '  FR12345678901  ',
      rcs_city: 'Paris',
    });

    expect(payload).toEqual({
      vat_exempt: false,
      vat_number: 'FR12345678901',
      rcs_city: 'Paris',
    });
  });

  it('converts numeric fields to numbers', () => {
    const payload = toLegalMentionsPayload({
      ...EMPTY_LEGAL_MENTIONS,
      capital_social: '10000',
      late_penalty_rate: '12.5',
      default_payment_terms_days: '45',
    });

    expect(payload).toMatchObject({
      capital_social: 10000,
      late_penalty_rate: 12.5,
      default_payment_terms_days: 45,
    });
  });

  it('drops numeric fields that are not numbers', () => {
    const payload = toLegalMentionsPayload({
      ...EMPTY_LEGAL_MENTIONS,
      capital_social: 'beaucoup',
    });

    expect(payload).not.toHaveProperty('capital_social');
  });

  it('always sends vat_exempt so it can be turned back off', () => {
    expect(
      toLegalMentionsPayload({ ...EMPTY_LEGAL_MENTIONS, vat_exempt: true }),
    ).toMatchObject({ vat_exempt: true });
  });
});

describe('fromCompanyProfile', () => {
  it('maps nulls to empty strings for controlled inputs', () => {
    const values = fromCompanyProfile({
      vat_number: null as unknown as string,
      rcs_city: 'Lyon',
    });

    expect(values.vat_number).toBe('');
    expect(values.rcs_city).toBe('Lyon');
  });

  it('stringifies numeric fields', () => {
    const values = fromCompanyProfile({
      capital_social: 10000 as unknown as string,
    });
    expect(values.capital_social).toBe('10000');
  });

  it('coerces vat_exempt to a boolean', () => {
    expect(fromCompanyProfile({}).vat_exempt).toBe(false);
    expect(fromCompanyProfile({ vat_exempt: true }).vat_exempt).toBe(true);
  });
});
