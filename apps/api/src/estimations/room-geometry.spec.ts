import {
  RectSegment,
  unionAreaCm2,
  unionPerimeterCm,
  unionWallRunsCm,
} from './room-geometry';

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

  // ===========================================================================
  // unionWallRunsCm (E1-6)
  // ===========================================================================
  describe('unionWallRunsCm', () => {
    /**
     * Les pans sont rendus dans un ordre de balayage (colonnes puis lignes) qui
     * est un détail d'implémentation ; ce qui compte est **l'ensemble** des
     * longueurs. On compare donc des multiensembles triés — une assertion sur
     * l'ordre figerait le balayage et casserait au premier refactor sans qu'une
     * seule pièce soit mal découpée.
     */
    const runs = (segments: RectSegment[]): number[] =>
      [...unionWallRunsCm(segments)].sort((a, b) => a - b);

    it('returns no wall for an empty composition', () => {
      expect(unionWallRunsCm([])).toEqual([]);
    });

    it('gives a rectangle its four walls', () => {
      expect(runs(singleRect)).toEqual([300, 300, 400, 400]);
    });

    it('gives an L-shape its six walls, not its bounding box', () => {
      // 600 (bas) · 150 (droite du retour) · 200 (dessus du retour) ·
      // 150 (décroché) · 400 (haut) · 300 (gauche)
      expect(runs(lShape)).toEqual([150, 150, 200, 300, 400, 600]);
    });

    it('gives a T-shape its eight walls', () => {
      expect(runs(tShape)).toEqual([100, 100, 200, 200, 200, 200, 200, 600]);
    });

    it('gives a U-shape its eight walls, notch included', () => {
      expect(runs(uShape)).toEqual([100, 100, 200, 200, 200, 300, 300, 400]);
    });

    it('never merges two collinear walls separated by a notch', () => {
      // Les deux extrémités hautes du U sont à la même ordonnée (300) et du
      // même côté : les fusionner donnerait un pan de 200 au lieu de deux de
      // 100, et un lé de moins à découper.
      expect(unionWallRunsCm(uShape).filter((r) => r === 100)).toHaveLength(2);
    });

    /**
     * La propriété qui rend ce découpage vérifiable sans le relire : il ne perd
     * ni n'invente de mur. Rejouée sur les cinq géométries du fichier.
     */
    it.each([
      ['rectangle', singleRect],
      ['L', lShape],
      ['T', tShape],
      ['U', uShape],
      [
        'recouvrement partiel',
        [
          { x_cm: 0, y_cm: 0, length_cm: 200, width_cm: 200 },
          { x_cm: 100, y_cm: 100, length_cm: 200, width_cm: 200 },
        ] as RectSegment[],
      ],
    ])('sums back to the outline perimeter (%s)', (_name, segments) => {
      expect(unionWallRunsCm(segments).reduce((a, b) => a + b, 0)).toBe(
        unionPerimeterCm(segments),
      );
    });

    /**
     * Ce que le lot corrige, en une ligne : sur le séjour en L, compter les lés
     * sur le périmètre total en donne 34 ; les six pans réels en demandent 36.
     */
    it('exposes the under-count of a perimeter-wide strip count', () => {
      const LAIZE = 53;
      const onPerimeter = Math.ceil(unionPerimeterCm(lShape) / LAIZE);
      const wallByWall = unionWallRunsCm(lShape).reduce(
        (total, run) => total + Math.ceil(run / LAIZE),
        0,
      );
      expect({ onPerimeter, wallByWall }).toEqual({
        onPerimeter: 34,
        wallByWall: 36,
      });
    });
  });
});
