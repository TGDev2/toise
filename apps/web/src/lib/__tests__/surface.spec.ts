import { floorArea, wallArea, totalSurfaceArea, totalOpeningsArea, netWallArea } from '../surface';
import type { Opening } from '../surface';

describe('surface', () => {
  describe('floorArea', () => {
    it('computes floor area in cm²', () => {
      expect(floorArea(500, 400)).toBe(200_000);
    });

    it('returns 0 when a dimension is 0', () => {
      expect(floorArea(0, 400)).toBe(0);
    });
  });

  describe('wallArea', () => {
    it('computes wall area (perimeter × height)', () => {
      // perimeter = 2*(500+400) = 1800, wall = 1800*250 = 450000
      expect(wallArea(500, 400, 250)).toBe(450_000);
    });

    it('returns 0 when height is 0', () => {
      expect(wallArea(500, 400, 0)).toBe(0);
    });
  });

  describe('totalSurfaceArea', () => {
    it('computes floor + ceiling + 4 walls', () => {
      const floor = 500 * 400;
      const ceiling = floor;
      const walls = 2 * (500 + 400) * 250;
      expect(totalSurfaceArea(500, 400, 250)).toBe(floor + ceiling + walls);
    });
  });

  describe('totalOpeningsArea', () => {
    it('sums width * height * count for all openings', () => {
      const openings: Opening[] = [
        { type: 'door', width_cm: 90, height_cm: 204, count: 1 },
        { type: 'window', width_cm: 120, height_cm: 100, count: 2 },
      ];
      // 90*204*1 + 120*100*2 = 18360 + 24000 = 42360
      expect(totalOpeningsArea(openings)).toBe(42360);
    });

    it('returns 0 for empty array', () => {
      expect(totalOpeningsArea([])).toBe(0);
    });

    it('handles single opening with count > 1', () => {
      const openings: Opening[] = [
        { type: 'door', width_cm: 90, height_cm: 204, count: 3 },
      ];
      expect(totalOpeningsArea(openings)).toBe(90 * 204 * 3);
    });
  });

  describe('netWallArea', () => {
    it('subtracts opening areas from gross wall area', () => {
      const openings: Opening[] = [
        { type: 'door', width_cm: 90, height_cm: 204, count: 1 },
      ];
      const gross = wallArea(500, 400, 250); // 450000
      expect(netWallArea(500, 400, 250, openings)).toBe(gross - 18360);
    });

    it('returns 0 when openings exceed wall area', () => {
      const openings: Opening[] = [
        { type: 'door', width_cm: 9000, height_cm: 20400, count: 10 },
      ];
      expect(netWallArea(500, 400, 250, openings)).toBe(0);
    });

    it('equals gross wall area when no openings', () => {
      expect(netWallArea(500, 400, 250, [])).toBe(wallArea(500, 400, 250));
    });

    it('handles multiple openings of different types', () => {
      const openings: Opening[] = [
        { type: 'door', width_cm: 90, height_cm: 204, count: 2 },
        { type: 'window', width_cm: 120, height_cm: 100, count: 3 },
      ];
      const gross = wallArea(500, 400, 250);
      const deductions = 90 * 204 * 2 + 120 * 100 * 3;
      expect(netWallArea(500, 400, 250, openings)).toBe(gross - deductions);
    });
  });
});
