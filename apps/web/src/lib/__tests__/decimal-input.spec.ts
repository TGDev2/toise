import { normalizeDecimalInput } from '../decimal-input';

describe('normalizeDecimalInput', () => {
  it('converts the French decimal comma to a dot', () => {
    expect(normalizeDecimalInput('3,5')).toBe('3.5');
  });

  it('keeps a dot separator untouched', () => {
    expect(normalizeDecimalInput('3.5')).toBe('3.5');
  });

  it('accepts an empty value so the field stays clearable', () => {
    expect(normalizeDecimalInput('')).toBe('');
  });

  it('accepts a trailing separator while typing', () => {
    expect(normalizeDecimalInput('12,')).toBe('12.');
    expect(normalizeDecimalInput(',5')).toBe('.5');
  });

  it('rejects a second separator instead of silently gluing digits together', () => {
    // « 3,5,2 » ne doit surtout pas devenir « 3.52 » : ce serait une mesure
    // fausse acceptée sans le moindre signal.
    expect(normalizeDecimalInput('3,5,2')).toBeNull();
    expect(normalizeDecimalInput('3.5.2')).toBeNull();
  });

  it('rejects letters, signs and spaces', () => {
    expect(normalizeDecimalInput('3m')).toBeNull();
    expect(normalizeDecimalInput('-2')).toBeNull();
    expect(normalizeDecimalInput('3 5')).toBeNull();
  });

  it('produces a value that parseFloat reads back exactly', () => {
    expect(Number.parseFloat(normalizeDecimalInput('2,75') as string)).toBe(2.75);
  });
});
