import { RectSegment, unionAreaCm2, unionPerimeterCm } from './room-geometry';

describe('room-geometry', () => {
  // ---------------------------------------------------------------------------
  // Fixtures — toutes les valeurs attendues sont calculées à la main.
  // Repère vu de dessus : x_cm vers la droite, y_cm vers le haut.
  // ---------------------------------------------------------------------------

  /** Rectangle simple 400 × 300. */
  const singleRect: RectSegment[] = [
    { x_cm: 0, y_cm: 0, length_cm: 400, width_cm: 300 },
  ];

  /**
   * Forme en L : pièce 400×300 prolongée à droite par une extension 200×150
   * alignée en bas.
   *
   *   +--------------+
   *   |              |
   *   |      A       |----+
   *   |              | B  |
   *   +--------------+----+
   */
  const lShape: RectSegment[] = [
    { x_cm: 0, y_cm: 0, length_cm: 400, width_cm: 300 },
    { x_cm: 400, y_cm: 0, length_cm: 200, width_cm: 150 },
  ];

  /**
   * Forme en T : barre horizontale 600×100 en haut + pied central 200×200.
   *
   *   +--------------------+
   *   |         C          |
   *   +----+---------+-----+
   *        |    D    |
   *        +---------+
   */
  const tShape: RectSegment[] = [
    { x_cm: 0, y_cm: 200, length_cm: 600, width_cm: 100 },
    { x_cm: 200, y_cm: 0, length_cm: 200, width_cm: 200 },
  ];

  /**
   * Forme en U : fond 400×100 + deux montants 100×200, décroché ouvert en
   * haut au milieu.
   */
  const uShape: RectSegment[] = [
    { x_cm: 0, y_cm: 0, length_cm: 400, width_cm: 100 },
    { x_cm: 0, y_cm: 100, length_cm: 100, width_cm: 200 },
    { x_cm: 300, y_cm: 100, length_cm: 100, width_cm: 200 },
  ];

  // ===========================================================================
  // unionAreaCm2
  // ===========================================================================
  describe('unionAreaCm2', () => {
    it('returns 0 for an empty composition', () => {
      expect(unionAreaCm2([])).toBe(0);
    });

    it('ignores degenerate segments (zero extent)', () => {
      expect(
        unionAreaCm2([{ x_cm: 0, y_cm: 0, length_cm: 0, width_cm: 300 }]),
      ).toBe(0);
    });

    it('computes the area of a single rectangle', () => {
      // 400 * 300 = 120000
      expect(unionAreaCm2(singleRect)).toBe(120_000);
    });

    it('sums abutting rectangles without double counting', () => {
      // 400x300 + 200x150 = 120000 + 30000
      expect(unionAreaCm2(lShape)).toBe(150_000);
    });

    it('computes the area of a T-shape', () => {
      // barre 600x100 + pied 200x200 = 60000 + 40000
      expect(unionAreaCm2(tShape)).toBe(100_000);
    });

    it('computes the area of a U-shape', () => {
      // fond 400x100 + 2 montants 100x200 = 40000 + 20000 + 20000
      expect(unionAreaCm2(uShape)).toBe(80_000);
    });

    it('counts overlapping rectangles once (union, not sum)', () => {
      // Doublon parfait : aire de l'union = aire d'un seul rectangle.
      const dup: RectSegment[] = [
        { x_cm: 0, y_cm: 0, length_cm: 200, width_cm: 200 },
        { x_cm: 0, y_cm: 0, length_cm: 200, width_cm: 200 },
      ];
      expect(unionAreaCm2(dup)).toBe(40_000);
    });

    it('handles partial overlap via inclusion-exclusion', () => {
      // 200x200 + 200x200 décalé de (100,100) : 40000 + 40000 - 10000
      const overlap: RectSegment[] = [
        { x_cm: 0, y_cm: 0, length_cm: 200, width_cm: 200 },
        { x_cm: 100, y_cm: 100, length_cm: 200, width_cm: 200 },
      ];
      expect(unionAreaCm2(overlap)).toBe(70_000);
    });
  });

  // ===========================================================================
  // unionPerimeterCm
  // ===========================================================================
  describe('unionPerimeterCm', () => {
    it('returns 0 for an empty composition', () => {
      expect(unionPerimeterCm([])).toBe(0);
    });

    it('computes the perimeter of a single rectangle', () => {
      // 2 * (400 + 300) = 1400
      expect(unionPerimeterCm(singleRect)).toBe(1_400);
    });

    it('merges two abutting rectangles into one outline', () => {
      // 200x200 + 200x200 côte à côte = rectangle 400x200 : 2*(400+200)
      const abutting: RectSegment[] = [
        { x_cm: 0, y_cm: 0, length_cm: 200, width_cm: 200 },
        { x_cm: 200, y_cm: 0, length_cm: 200, width_cm: 200 },
      ];
      expect(unionPerimeterCm(abutting)).toBe(1_200);
    });

    it('computes the outline perimeter of an L-shape', () => {
      // Contour : 600 + 150 + 200 + 150 + 400 + 300 = 1800
      // (et non 2*(400+300) + 2*(200+150) = 2100 qu'on obtiendrait en sommant
      //  les périmètres — l'arête interne partagée ne compte pas)
      expect(unionPerimeterCm(lShape)).toBe(1_800);
    });

    it('computes the outline perimeter of a T-shape', () => {
      // T = boîte 600x300 amputée de deux coins → périmètre conservé = 1800
      expect(unionPerimeterCm(tShape)).toBe(1_800);
    });

    it('computes the outline perimeter of a U-shape (interior notch counted)', () => {
      expect(unionPerimeterCm(uShape)).toBe(1_800);
    });

    it('does not count the shared edge of a perfect overlap twice', () => {
      const dup: RectSegment[] = [
        { x_cm: 0, y_cm: 0, length_cm: 200, width_cm: 200 },
        { x_cm: 0, y_cm: 0, length_cm: 200, width_cm: 200 },
      ];
      // Contour d'un seul carré 200x200
      expect(unionPerimeterCm(dup)).toBe(800);
    });
  });
});
