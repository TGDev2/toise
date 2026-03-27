import { metersToCm, cmToMeters, feetInchesToCm, cmToFeetInches } from '../units';

describe('units', () => {
  describe('metersToCm', () => {
    it('converts meters to centimeters', () => {
      expect(metersToCm(1)).toBe(100);
      expect(metersToCm(2.5)).toBe(250);
      expect(metersToCm(0)).toBe(0);
    });
  });

  describe('cmToMeters', () => {
    it('converts centimeters to meters', () => {
      expect(cmToMeters(100)).toBe(1);
      expect(cmToMeters(250)).toBe(2.5);
      expect(cmToMeters(0)).toBe(0);
    });
  });

  describe('feetInchesToCm', () => {
    it('converts feet and inches to centimeters', () => {
      expect(feetInchesToCm(1, 0)).toBeCloseTo(30.48);
      expect(feetInchesToCm(0, 1)).toBeCloseTo(2.54);
      expect(feetInchesToCm(5, 10)).toBeCloseTo(177.8);
      expect(feetInchesToCm(0, 0)).toBe(0);
    });
  });

  describe('cmToFeetInches', () => {
    it('converts centimeters to feet and inches', () => {
      const result = cmToFeetInches(177.8);
      expect(result.feet).toBe(5);
      expect(result.inches).toBeCloseTo(10, 0);
    });

    it('handles exact foot values', () => {
      const result = cmToFeetInches(30.48);
      expect(result.feet).toBe(1);
      expect(result.inches).toBeCloseTo(0, 1);
    });

    it('handles zero', () => {
      const result = cmToFeetInches(0);
      expect(result.feet).toBe(0);
      expect(result.inches).toBe(0);
    });
  });

  describe('round-trip conversion', () => {
    it('metric round-trip preserves value', () => {
      expect(cmToMeters(metersToCm(3.75))).toBeCloseTo(3.75);
    });

    it('imperial round-trip preserves value', () => {
      const { feet, inches } = cmToFeetInches(feetInchesToCm(8, 6));
      expect(feet).toBe(8);
      expect(inches).toBeCloseTo(6, 0);
    });
  });
});
