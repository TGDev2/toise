import { floorArea, wallArea, totalSurfaceArea } from '../surface';

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
});
