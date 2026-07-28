import {
  MAX_PACK_RATIO,
  MIN_PACK_RATIO,
  materialUnitDimension,
  parsePackSize,
  proratePrice,
} from './pack-size';

describe('materialUnitDimension', () => {
  it('maps the five catalog units', () => {
    expect(materialUnitDimension('m2')).toBe('m2');
    expect(materialUnitDimension('L')).toBe('L');
    expect(materialUnitDimension('kg')).toBe('kg');
    expect(materialUnitDimension('m')).toBe('m');
    expect(materialUnitDimension('unit')).toBe('unit');
  });

  it('rejects anything else rather than guessing', () => {
    expect(materialUnitDimension('rouleau')).toBeNull();
    expect(materialUnitDimension('')).toBeNull();
  });
});

describe('parsePackSize', () => {
  it('reads the catalog packaging labels', () => {
    expect(parsePackSize('Pot 2,5 L', 'L')).toEqual({ qty: 2.5, unit: 'L' });
    expect(parsePackSize('Sac 25 kg', 'kg')).toEqual({ qty: 25, unit: 'kg' });
    expect(parsePackSize('Boîte 1.08 m²', 'm2')).toEqual({
      qty: 1.08,
      unit: 'm2',
    });
    expect(parsePackSize('Barre 2.6 m', 'm')).toEqual({ qty: 2.6, unit: 'm' });
  });

  it('converts grams and millilitres to the canonical unit', () => {
    expect(parsePackSize('Colle 750 g', 'kg')).toEqual({
      qty: 0.75,
      unit: 'kg',
    });
    expect(parsePackSize('Peinture 500 ml', 'L')).toEqual({
      qty: 0.5,
      unit: 'L',
    });
  });

  it('picks the grandeur of the material, not the first number in the title', () => {
    const title = 'Peinture acrylique mate 2,5 L - rendement 12 m² par litre';
    expect(parsePackSize(title, 'L')).toEqual({ qty: 2.5, unit: 'L' });
    expect(parsePackSize(title, 'm2')).toEqual({ qty: 12, unit: 'm2' });
  });

  it('multiplies by an explicit lot', () => {
    expect(parsePackSize('Lambris PVC 2,6 m lot de 5', 'm')).toEqual({
      qty: 13,
      unit: 'm',
    });
  });

  it('does not treat a piece count inside the box as a lot multiplier', () => {
    // « boîte de 11 carreaux » décrit le contenu, pas 11 boîtes.
    expect(
      parsePackSize('Carrelage 30x30 boîte 1,08 m² 11 carreaux', 'm2'),
    ).toEqual({ qty: 1.08, unit: 'm2' });
  });

  it('counts pieces for a material sold by the unit', () => {
    expect(parsePackSize('Spots encastrables lot de 6', 'unit')).toEqual({
      qty: 6,
      unit: 'unit',
    });
    expect(parsePackSize('Plaque de plâtre BA13', 'unit')).toEqual({
      qty: 1,
      unit: 'unit',
    });
  });

  it('accepts "ml" as linear metres only at a plausible magnitude', () => {
    expect(parsePackSize('Plinthe chêne 2,6 ml', 'm')).toEqual({
      qty: 2.6,
      unit: 'm',
    });
    expect(parsePackSize('Peinture 500 ml', 'm')).toBeNull();
  });

  it('does not confuse m2 with m', () => {
    expect(parsePackSize('Boîte 1,08 m²', 'm')).toBeNull();
    expect(parsePackSize('Barre 2.6 m', 'm2')).toBeNull();
  });

  it('returns null when the grandeur is absent', () => {
    expect(parsePackSize('Peinture acrylique blanche', 'L')).toBeNull();
  });
});

describe('proratePrice', () => {
  it('scales the merchant price to the quote packaging', () => {
    // Bidon de 10 L à 89,90 EUR -> équivalent « Pot 2,5 L ».
    expect(proratePrice(89.9, 10, 2.5)).toBe(22.48);
  });

  it('is the identity when both packagings agree', () => {
    expect(proratePrice(34.5, 2.5, 2.5)).toBe(34.5);
  });

  it('refuses to extrapolate outside the ratio band', () => {
    expect(proratePrice(10, 25, 25 * MIN_PACK_RATIO * 0.99)).toBeNull();
    expect(proratePrice(10, 5, 5 * MAX_PACK_RATIO * 1.01)).toBeNull();
    // Un sac de 5 kg extrapolé depuis un sac de 25 kg : hors bande.
    expect(proratePrice(19.9, 25, 5)).toBeNull();
  });

  it('accepts the band edges', () => {
    expect(proratePrice(100, 10, 2.5)).toBe(25);
    expect(proratePrice(100, 2.5, 10)).toBe(400);
  });

  it('rejects degenerate inputs instead of returning NaN', () => {
    expect(proratePrice(10, 0, 2.5)).toBeNull();
    expect(proratePrice(10, 2.5, 0)).toBeNull();
    expect(proratePrice(Number.NaN, 2.5, 2.5)).toBeNull();
    expect(proratePrice(-5, 2.5, 2.5)).toBeNull();
  });
});
