import { getDimensionWarnings, getMissingFields } from '../dimension-validation';

describe('dimension-validation', () => {
  describe('getDimensionWarnings', () => {
    it('returns no warnings for normal dimensions', () => {
      expect(getDimensionWarnings(500, 400, 250)).toEqual([]);
    });

    it('warns when height is too low', () => {
      const warnings = getDimensionWarnings(500, 400, 120);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].field).toBe('height');
    });

    it('warns when height is too high', () => {
      const warnings = getDimensionWarnings(500, 400, 700);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].field).toBe('height');
    });

    it('warns when length is too small', () => {
      const warnings = getDimensionWarnings(30, 400, 250);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].field).toBe('length');
    });

    it('warns when length is too large', () => {
      const warnings = getDimensionWarnings(3500, 400, 250);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].field).toBe('length');
    });

    it('warns when width is too small', () => {
      const warnings = getDimensionWarnings(500, 30, 250);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].field).toBe('width');
    });

    it('warns when width is too large', () => {
      const warnings = getDimensionWarnings(500, 3500, 250);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].field).toBe('width');
    });

    it('returns multiple warnings', () => {
      const warnings = getDimensionWarnings(30, 3500, 120);
      expect(warnings).toHaveLength(3);
    });

    it('does not warn for zero values (considered empty, not unusual)', () => {
      expect(getDimensionWarnings(0, 0, 0)).toEqual([]);
    });
  });

  describe('getMissingFields', () => {
    it('returns empty array when all fields are filled', () => {
      expect(getMissingFields({ lengthCm: 500, widthCm: 400, heightCm: 250 })).toEqual([]);
    });

    it('returns missing field names for zero values', () => {
      const missing = getMissingFields({ lengthCm: 0, widthCm: 400, heightCm: 0 });
      expect(missing).toEqual(['Longueur', 'Hauteur']);
    });

    it('returns all fields when all are zero', () => {
      const missing = getMissingFields({ lengthCm: 0, widthCm: 0, heightCm: 0 });
      expect(missing).toHaveLength(3);
    });
  });
});
