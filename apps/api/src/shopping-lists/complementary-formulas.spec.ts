import {
  parseTileFormat,
  computeComplementaryQuantity,
  ComplementaryContext,
} from './complementary-formulas';

describe('parseTileFormat', () => {
  it.each([
    ['20x20', { length_cm: 20, width_cm: 20 }],
    ['30x30', { length_cm: 30, width_cm: 30 }],
    ['45x45', { length_cm: 45, width_cm: 45 }],
    ['60x60', { length_cm: 60, width_cm: 60 }],
    ['30x60', { length_cm: 30, width_cm: 60 }],
  ])('parses "%s" correctly', (format, expected) => {
    expect(parseTileFormat(format)).toEqual(expected);
  });

  it('returns null for invalid formats', () => {
    expect(parseTileFormat('')).toBeNull();
    expect(parseTileFormat('abc')).toBeNull();
    expect(parseTileFormat('30')).toBeNull();
    expect(parseTileFormat('30x')).toBeNull();
    expect(parseTileFormat('x30')).toBeNull();
  });
});

describe('computeComplementaryQuantity', () => {
  describe('tiling_adhesive', () => {
    it('uses 3 kg/m2 for small tiles (<=30cm)', () => {
      const ctx: ComplementaryContext = {
        total_surface_m2: 10,
        tile_length_cm: 30,
        tile_width_cm: 30,
      };
      // 10 * 3 / 25 = 1.2 → ceil = 2 bags
      expect(computeComplementaryQuantity('tiling_adhesive', ctx)).toBe(2);
    });

    it('uses 5 kg/m2 for large tiles (>30cm)', () => {
      const ctx: ComplementaryContext = {
        total_surface_m2: 10,
        tile_length_cm: 60,
        tile_width_cm: 60,
      };
      // 10 * 5 / 25 = 2.0 → ceil = 2 bags
      expect(computeComplementaryQuantity('tiling_adhesive', ctx)).toBe(2);
    });

    it('uses 5 kg/m2 for rectangular tiles with one side > 30cm', () => {
      const ctx: ComplementaryContext = {
        total_surface_m2: 10,
        tile_length_cm: 30,
        tile_width_cm: 60,
      };
      // max side = 60 > 30 → 5 kg/m2
      // 10 * 5 / 25 = 2.0 → ceil = 2 bags
      expect(computeComplementaryQuantity('tiling_adhesive', ctx)).toBe(2);
    });

    it('rounds up to next bag', () => {
      const ctx: ComplementaryContext = {
        total_surface_m2: 15,
        tile_length_cm: 20,
        tile_width_cm: 20,
      };
      // 15 * 3 / 25 = 1.8 → ceil = 2 bags
      expect(computeComplementaryQuantity('tiling_adhesive', ctx)).toBe(2);
    });

    it('handles large surface', () => {
      const ctx: ComplementaryContext = {
        total_surface_m2: 50,
        tile_length_cm: 45,
        tile_width_cm: 45,
      };
      // 50 * 5 / 25 = 10 bags
      expect(computeComplementaryQuantity('tiling_adhesive', ctx)).toBe(10);
    });
  });

  describe('tiling_grout', () => {
    it('calculates grout bags at 0.5 kg/m2', () => {
      const ctx: ComplementaryContext = {
        total_surface_m2: 10,
        tile_length_cm: 30,
        tile_width_cm: 30,
      };
      // 10 * 0.5 / 5 = 1.0 → ceil = 1 bag
      expect(computeComplementaryQuantity('tiling_grout', ctx)).toBe(1);
    });

    it('rounds up for larger surfaces', () => {
      const ctx: ComplementaryContext = {
        total_surface_m2: 25,
        tile_length_cm: 30,
        tile_width_cm: 30,
      };
      // 25 * 0.5 / 5 = 2.5 → ceil = 3 bags
      expect(computeComplementaryQuantity('tiling_grout', ctx)).toBe(3);
    });
  });

  describe('tiling_spacers', () => {
    it('calculates spacer sachets for 30x30 tiles', () => {
      const ctx: ComplementaryContext = {
        total_surface_m2: 10,
        tile_length_cm: 30,
        tile_width_cm: 30,
      };
      // tile area = 0.09 m2, tile count = 10/0.09 ≈ 111.1
      // spacers = 111.1 * 4 = 444.4, sachets = ceil(444.4/200) = 3
      expect(computeComplementaryQuantity('tiling_spacers', ctx)).toBe(3);
    });

    it('calculates spacer sachets for 20x20 tiles', () => {
      const ctx: ComplementaryContext = {
        total_surface_m2: 10,
        tile_length_cm: 20,
        tile_width_cm: 20,
      };
      // tile area = 0.04 m2, tile count = 250
      // spacers = 250 * 4 = 1000, sachets = ceil(1000/200) = 5
      expect(computeComplementaryQuantity('tiling_spacers', ctx)).toBe(5);
    });

    it('calculates spacer sachets for 60x60 tiles', () => {
      const ctx: ComplementaryContext = {
        total_surface_m2: 10,
        tile_length_cm: 60,
        tile_width_cm: 60,
      };
      // tile area = 0.36 m2, tile count = 27.78
      // spacers = 27.78 * 4 = 111.1, sachets = ceil(111.1/200) = 1
      expect(computeComplementaryQuantity('tiling_spacers', ctx)).toBe(1);
    });

    it('returns minimum 1 sachet for zero surface', () => {
      const ctx: ComplementaryContext = {
        total_surface_m2: 0,
        tile_length_cm: 30,
        tile_width_cm: 30,
      };
      expect(computeComplementaryQuantity('tiling_spacers', ctx)).toBe(1);
    });
  });

  describe('unknown formula', () => {
    it('returns null for unknown formula codes', () => {
      const ctx: ComplementaryContext = {
        total_surface_m2: 10,
        tile_length_cm: 30,
        tile_width_cm: 30,
      };
      expect(computeComplementaryQuantity('unknown_formula', ctx)).toBeNull();
    });
  });
});
