import {
  floorArea,
  wallArea,
  totalSurfaceArea,
  totalOpeningsArea,
  netWallArea,
  totalExclusionsArea,
  compositeFloorArea,
  compositePerimeter,
  compositeWallArea,
  compositeNetWallArea,
  sectionsToSegments,
  segmentsToSections,
} from '../surface';
import type { Opening, ShapeSection, SurfaceExclusion } from '../surface';

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

  describe('totalExclusionsArea', () => {
    it('sums area_m2 (converted to cm²) for the matching surface_target', () => {
      const exclusions: SurfaceExclusion[] = [
        { surface_target: 'wall', type: 'credence', area_m2: 2 },
        { surface_target: 'wall', type: 'baseboard', area_m2: 1.5 },
        { surface_target: 'floor', type: 'other', area_m2: 3 },
      ];
      // (2 + 1.5) * 10_000 = 35_000
      expect(totalExclusionsArea(exclusions, 'wall')).toBe(35_000);
    });

    it('returns 0 when no exclusion matches the surface', () => {
      const exclusions: SurfaceExclusion[] = [
        { surface_target: 'floor', type: 'other', area_m2: 3 },
      ];
      expect(totalExclusionsArea(exclusions, 'wall')).toBe(0);
    });

    it('returns 0 for an empty array', () => {
      expect(totalExclusionsArea([], 'wall')).toBe(0);
    });
  });

  describe('netWallArea / compositeNetWallArea with exclusions', () => {
    it('deducts exclusions on top of openings (rectangular room)', () => {
      const openings: Opening[] = [
        { type: 'door', width_cm: 90, height_cm: 204, count: 1 },
      ];
      const gross = wallArea(500, 400, 250);
      const exclusionsCm2 = 20_000; // 2 m²
      expect(netWallArea(500, 400, 250, openings, exclusionsCm2)).toBe(
        gross - 18360 - exclusionsCm2,
      );
    });

    it('never goes negative when exclusions exceed the net wall area', () => {
      expect(netWallArea(500, 400, 250, [], 10_000_000)).toBe(0);
    });

    it('defaults to no exclusion deduction when omitted', () => {
      expect(netWallArea(500, 400, 250, [])).toBe(wallArea(500, 400, 250));
    });
  });

  // Pièce en L : 400×300 prolongée d'une extension 200×150 alignée en bas.
  const lSegments = [
    { x_cm: 0, y_cm: 0, length_cm: 400, width_cm: 300 },
    { x_cm: 400, y_cm: 0, length_cm: 200, width_cm: 150 },
  ];

  describe('compositeFloorArea', () => {
    it('sums the union of rectangles', () => {
      // 400*300 + 200*150 = 150000
      expect(compositeFloorArea(lSegments)).toBe(150_000);
    });

    it('returns 0 for an empty composition', () => {
      expect(compositeFloorArea([])).toBe(0);
    });
  });

  describe('compositePerimeter', () => {
    it('computes the union outline perimeter (not the sum of perimeters)', () => {
      expect(compositePerimeter(lSegments)).toBe(1_800);
    });
  });

  describe('compositeWallArea / compositeNetWallArea', () => {
    it('multiplies the outline perimeter by height', () => {
      // 1800 * 250 = 450000
      expect(compositeWallArea(lSegments, 250)).toBe(450_000);
    });

    it('deducts openings from the composite wall area', () => {
      const openings: Opening[] = [
        { type: 'door', width_cm: 90, height_cm: 204, count: 1 },
      ];
      // 450000 - 18360 = 431640
      expect(compositeNetWallArea(lSegments, 250, openings)).toBe(431_640);
    });

    it('never goes negative', () => {
      const openings: Opening[] = [
        { type: 'door', width_cm: 9000, height_cm: 9000, count: 5 },
      ];
      expect(compositeNetWallArea(lSegments, 250, openings)).toBe(0);
    });

    it('deducts exclusions on top of openings', () => {
      const openings: Opening[] = [
        { type: 'door', width_cm: 90, height_cm: 204, count: 1 },
      ];
      const exclusionsCm2 = 20_000; // 2 m²
      // 450000 - 18360 - 20000 = 411640
      expect(
        compositeNetWallArea(lSegments, 250, openings, exclusionsCm2),
      ).toBe(411_640);
    });
  });

  describe('sectionsToSegments', () => {
    it('builds the main rectangle plus a right décroché', () => {
      const sections: ShapeSection[] = [
        { side: 'right', offset_cm: 0, along_cm: 150, depth_cm: 200 },
      ];
      expect(sectionsToSegments(400, 300, sections)).toEqual([
        { x_cm: 0, y_cm: 0, length_cm: 400, width_cm: 300 },
        { x_cm: 400, y_cm: 0, length_cm: 200, width_cm: 150 },
      ]);
    });

    it('skips degenerate sections (zero size)', () => {
      const sections: ShapeSection[] = [
        { side: 'top', offset_cm: 10, along_cm: 0, depth_cm: 50 },
      ];
      // Seul le rectangle principal subsiste
      expect(sectionsToSegments(400, 300, sections)).toEqual([
        { x_cm: 0, y_cm: 0, length_cm: 400, width_cm: 300 },
      ]);
    });
  });

  describe('segmentsToSections (round-trip)', () => {
    it('reconstructs sections on all four sides', () => {
      const sections: ShapeSection[] = [
        { side: 'right', offset_cm: 0, along_cm: 150, depth_cm: 200 },
        { side: 'top', offset_cm: 50, along_cm: 100, depth_cm: 80 },
        { side: 'left', offset_cm: 20, along_cm: 60, depth_cm: 40 },
        { side: 'bottom', offset_cm: 10, along_cm: 70, depth_cm: 30 },
      ];
      const segments = sectionsToSegments(400, 300, sections);
      expect(segmentsToSections(400, 300, segments)).toEqual(sections);
    });

    it('returns no sections for a plain rectangle', () => {
      const segments = sectionsToSegments(400, 300, []);
      expect(segmentsToSections(400, 300, segments)).toEqual([]);
    });
  });
});
