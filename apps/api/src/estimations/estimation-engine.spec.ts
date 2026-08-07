import {
  EstimationEngine,
  FrameSpec,
  RoomData,
  WorkItemInput,
  MaterialInput,
  PackagingInput,
  WasteFactorInput,
  MissingWasteFactorError,
} from './estimation-engine';
import { EstimationLineItem } from './entities/estimation-result.entity';

describe('EstimationEngine', () => {
  let engine: EstimationEngine;

  beforeEach(() => {
    engine = new EstimationEngine();
  });

  // -------------------------------------------------------------------------
  // Helper factories
  // -------------------------------------------------------------------------
  const makeRoom = (overrides?: Partial<RoomData>): RoomData => ({
    length_cm: 400,
    width_cm: 300,
    height_cm: 250,
    openings: [],
    ...overrides,
  });

  const makePaintWasteFactors = (): WasteFactorInput[] => [
    { pose_type: 'standard', skill_level: 'beginner', factor_percent: 15 },
    { pose_type: 'standard', skill_level: 'intermediate', factor_percent: 10 },
    { pose_type: 'standard', skill_level: 'expert', factor_percent: 5 },
  ];

  const makeTileWasteFactors = (): WasteFactorInput[] => [
    { pose_type: 'straight', skill_level: 'beginner', factor_percent: 15 },
    { pose_type: 'straight', skill_level: 'intermediate', factor_percent: 10 },
    { pose_type: 'straight', skill_level: 'expert', factor_percent: 5 },
    { pose_type: 'diagonal', skill_level: 'beginner', factor_percent: 20 },
    { pose_type: 'diagonal', skill_level: 'intermediate', factor_percent: 15 },
    { pose_type: 'diagonal', skill_level: 'expert', factor_percent: 10 },
  ];

  const makePaintPackagings = (): PackagingInput[] => [
    { label: 'Pot 0.5 L', quantity_per_unit: 0.5, unit: 'L' },
    { label: 'Pot 2.5 L', quantity_per_unit: 2.5, unit: 'L' },
    { label: 'Pot 5 L', quantity_per_unit: 5, unit: 'L' },
    { label: 'Pot 10 L', quantity_per_unit: 10, unit: 'L' },
  ];

  const makeTilePackagings = (): PackagingInput[] => [
    { label: 'Carton 1.08 m²', quantity_per_unit: 1.08, unit: 'm2' },
    { label: 'Carton 1.44 m²', quantity_per_unit: 1.44, unit: 'm2' },
  ];

  const makePaintMaterial = (
    overrides?: Partial<MaterialInput>,
  ): MaterialInput => ({
    id: 'paint-uuid',
    name: 'Peinture acrylique mate',
    unit: 'L',
    yield_per_unit: 11,
    applies_coats: true,
    waste_factors: makePaintWasteFactors(),
    packagings: makePaintPackagings(),
    ...overrides,
  });

  /**
   * Accessoire d'un ouvrage de peinture (E1-4) : même catégorie que la
   * peinture, mais `applies_coats` faux — un pinceau ne se rachète pas à
   * chaque couche.
   */
  const makeAccessoryMaterial = (
    overrides?: Partial<MaterialInput>,
  ): MaterialInput => ({
    id: 'brush-uuid',
    name: 'Pinceau à rechampir 25mm',
    unit: 'unit',
    yield_per_unit: 1,
    role: 'accessoire',
    waste_factors: [
      { pose_type: 'standard', skill_level: 'beginner', factor_percent: 10 },
      {
        pose_type: 'standard',
        skill_level: 'intermediate',
        factor_percent: 5,
      },
      { pose_type: 'standard', skill_level: 'expert', factor_percent: 2 },
    ],
    packagings: [{ label: 'Unité', quantity_per_unit: 1, unit: 'unit' }],
    ...overrides,
  });

  const makeTileMaterial = (
    overrides?: Partial<MaterialInput>,
  ): MaterialInput => ({
    id: 'tile-uuid',
    name: 'Carrelage grès cérame 30x30',
    unit: 'm2',
    yield_per_unit: 1,
    waste_factors: makeTileWasteFactors(),
    packagings: makeTilePackagings(),
    ...overrides,
  });

  // =========================================================================
  // computeSurface
  // =========================================================================
  describe('computeSurface', () => {
    it('should calculate wall surface for a 4x3m room at 2.5m height', () => {
      const room = makeRoom();
      const surface = engine.computeSurface(room, 'wall');
      // 2*(400+300)*250 = 350000 cm² = 35 m²
      expect(surface).toBe(35);
    });

    it('should deduct openings from wall surface', () => {
      const room = makeRoom({
        openings: [
          { width_cm: 90, height_cm: 204, count: 1 }, // door
          { width_cm: 120, height_cm: 100, count: 1 }, // window
        ],
      });
      const surface = engine.computeSurface(room, 'wall');
      // 35 - (90*204 + 120*100)/10000 = 35 - (18360+12000)/10000 = 35 - 3.036 = 31.964
      expect(surface).toBeCloseTo(31.964, 3);
    });

    it('should handle multiple openings with count > 1', () => {
      const room = makeRoom({
        openings: [
          { width_cm: 90, height_cm: 204, count: 2 }, // 2 doors
        ],
      });
      const surface = engine.computeSurface(room, 'wall');
      // 35 - (90*204*2)/10000 = 35 - 3.672 = 31.328
      expect(surface).toBeCloseTo(31.328, 3);
    });

    it('should not go negative when openings exceed wall area', () => {
      const room = makeRoom({
        openings: [{ width_cm: 10000, height_cm: 10000, count: 1 }],
      });
      expect(engine.computeSurface(room, 'wall')).toBe(0);
    });

    it('should calculate floor surface without opening deduction', () => {
      const room = makeRoom({
        openings: [{ width_cm: 90, height_cm: 204, count: 1 }],
      });
      const surface = engine.computeSurface(room, 'floor');
      // 400*300 / 10000 = 12 m²
      expect(surface).toBe(12);
    });

    it('should calculate ceiling surface equal to floor', () => {
      const room = makeRoom();
      expect(engine.computeSurface(room, 'ceiling')).toBe(12);
    });

    // ENG-3: surfaces à exclure (déduction manuelle simple)
    it('should deduct a wall exclusion from the net wall surface', () => {
      const room = makeRoom({
        exclusions: [{ surface_target: 'wall', area_m2: 2 }],
      });
      // 35 - 2 = 33
      expect(engine.computeSurface(room, 'wall')).toBe(33);
    });

    it('should cumulate opening and exclusion deductions on wall surface', () => {
      const room = makeRoom({
        openings: [{ width_cm: 90, height_cm: 204, count: 1 }],
        exclusions: [{ surface_target: 'wall', area_m2: 2 }],
      });
      // 35 - 1.836 - 2 = 31.164
      expect(engine.computeSurface(room, 'wall')).toBeCloseTo(31.164, 3);
    });

    it('should not go negative when exclusions exceed the net wall surface', () => {
      const room = makeRoom({
        exclusions: [{ surface_target: 'wall', area_m2: 1000 }],
      });
      expect(engine.computeSurface(room, 'wall')).toBe(0);
    });

    it('should ignore exclusions targeting a different surface', () => {
      const room = makeRoom({
        exclusions: [{ surface_target: 'floor', area_m2: 2 }],
      });
      expect(engine.computeSurface(room, 'wall')).toBe(35);
      expect(engine.computeSurface(room, 'floor')).toBe(10);
    });

    it('should deduct a floor exclusion from floor surface', () => {
      const room = makeRoom({
        exclusions: [{ surface_target: 'floor', area_m2: 2 }],
      });
      // 12 - 2 = 10
      expect(engine.computeSurface(room, 'floor')).toBe(10);
    });
  });

  // =========================================================================
  // resolveWasteFactor
  // =========================================================================
  describe('resolveWasteFactor', () => {
    it('should find exact match for pose_type and skill_level', () => {
      const result = engine.resolveWasteFactor(
        makeTileWasteFactors(),
        'diagonal',
        'beginner',
      );
      expect(result).toEqual({ percent: 20, source: 'catalog' });
    });

    it('should find exact match for standard pose', () => {
      const result = engine.resolveWasteFactor(
        makePaintWasteFactors(),
        'standard',
        'intermediate',
      );
      expect(result).toEqual({ percent: 10, source: 'catalog' });
    });

    /**
     * E1-7 — un matériau **sans variante de pose** est chiffré sur sa pose
     * unique, quelle que soit la pose de l'ouvrage. C'est le cas du mortier-colle
     * sous un carreau posé en diagonale : le calepinage ne change pas ce que la
     * colle couvre. Ce n'est plus un repli, c'est la règle de vocabulaire que
     * `waste-factor-coverage.spec.ts` (W1) rend vraie sur tout le catalogue.
     */
    it('sert la pose unique d’un matériau qui n’a pas de variante', () => {
      const result = engine.resolveWasteFactor(
        makePaintWasteFactors(),
        'diagonal',
        'beginner',
      );
      expect(result).toEqual({ percent: 15, source: 'catalog' });
    });

    /**
     * E1-7 — le cœur du lot. Avant, ces deux appels rendaient `10 %` avec
     * `source: 'default'`, et ce chiffre était impossible à distinguer d'un
     * chiffrage normal : c'est ce qui a permis au carrelage mural et au
     * revêtement mural d'ignorer le niveau de compétence pendant toute la V1.
     */
    it('lève quand aucune ligne ne couvre le matériau', () => {
      expect(() =>
        engine.resolveWasteFactor([], 'standard', 'beginner', 'Carrelage X'),
      ).toThrow(MissingWasteFactorError);
    });

    it('lève quand le niveau manque, en nommant matériau, pose et niveau', () => {
      const factors: WasteFactorInput[] = [
        { pose_type: 'standard', skill_level: 'expert', factor_percent: 5 },
      ];
      expect(() =>
        engine.resolveWasteFactor(
          factors,
          'standard',
          'beginner',
          'Faïence murale 25x40 cm',
        ),
      ).toThrow(
        'Aucun facteur de perte au catalogue pour « Faïence murale 25x40 cm » ' +
          'en pose standard, niveau beginner',
      );
    });

    it('should handle numeric strings from TypeORM', () => {
      const factors: WasteFactorInput[] = [
        {
          pose_type: 'standard',
          skill_level: 'beginner',
          factor_percent: '15' as unknown as number,
        },
      ];
      const result = engine.resolveWasteFactor(factors, 'standard', 'beginner');
      expect(result.percent).toBe(15);
      expect(typeof result.percent).toBe('number');
    });
  });

  // =========================================================================
  // computeTheoreticalQty
  // =========================================================================
  describe('computeTheoreticalQty', () => {
    it('should compute base quantity for a material that does not apply coats', () => {
      const { qty } = engine.computeTheoreticalQty(12, 1, {}, false);
      expect(qty).toBe(12);
    });

    it('should multiply by number of coats for a coat-applied material', () => {
      const { qty, coats } = engine.computeTheoreticalQty(
        31.964,
        11,
        { number_of_coats: 2 },
        true,
      );
      // 31.964 / 11 * 2 = 5.812
      expect(qty).toBeCloseTo(5.812, 2);
      expect(coats).toBe(2);
    });

    it('should default to 2 coats when not specified', () => {
      const { qty, coats } = engine.computeTheoreticalQty(31.964, 11, {}, true);
      expect(qty).toBeCloseTo(5.812, 2);
      expect(coats).toBe(2);
    });

    it('should support 1 coat', () => {
      const { qty, coats } = engine.computeTheoreticalQty(
        31.964,
        11,
        { number_of_coats: 1 },
        true,
      );
      // 31.964 / 11 * 1 = 2.906
      expect(qty).toBeCloseTo(2.906, 2);
      expect(coats).toBe(1);
    });

    it('should handle yield as string from TypeORM', () => {
      const { qty } = engine.computeTheoreticalQty(
        12,
        '1' as unknown as number,
        {},
        false,
      );
      expect(qty).toBe(12);
    });

    // E1-4 : le cœur du défaut corrigé — un accessoire d'un ouvrage de
    // peinture, à rendement 1, ne suit pas le nombre de couches saisi.
    it('does not multiply an accessory by the number of coats', () => {
      const surfaceM2 = 33.3068;

      const accessory = engine.computeTheoreticalQty(
        surfaceM2,
        1,
        { number_of_coats: 2 },
        false,
      );
      const paint = engine.computeTheoreticalQty(
        surfaceM2,
        1,
        { number_of_coats: 2 },
        true,
      );

      expect(accessory.qty).toBeCloseTo(surfaceM2, 4);
      expect(accessory.coats).toBeUndefined();
      // Le même matériau marqué « applique les couches » double, lui.
      expect(paint.qty).toBeCloseTo(surfaceM2 * 2, 4);
    });
  });

  // =========================================================================
  // selectBestPackaging
  // =========================================================================
  describe('selectBestPackaging', () => {
    /**
     * E1-5 — le critère est le coût, approché par
     *
     *     S = q_min × (nombre de contenants) + (volume acheté)
     *
     * où `q_min` est le plus petit format offert : un contenant de plus doit
     * faire économiser au moins la plus petite quantité que le magasin vend.
     * Le détail de l'argument est porté par `selectBestPackaging`.
     *
     * Peinture : q_min = 0,5 L → S = 0,5 × U + V.
     * Carrelage : q_min = 1,08 m² → S = 1,08 × U + V.
     */
    const purchase = (qty: number, packagings: PackagingInput[]): string =>
      engine
        .selectBestPackaging(qty, packagings)
        .breakdown.map((b) => `${b.units} × ${b.label}`)
        .join(' + ');

    // Table de cas du backlog (E1-5) : chaque ligne porte l'achat attendu et la
    // raison pour laquelle c'est celui-là, comparée aux candidats écartés.
    it.each([
      {
        besoin: 0.4,
        formats: makePaintPackagings(),
        attendu: '1 × Pot 0.5 L',
        raison:
          'le plus petit pot couvre seul : il minimise à la fois les ' +
          'contenants et le volume (S = 1,0) ; un pot de 2,5 L vaut 3,0',
      },
      {
        besoin: 6.661,
        formats: makePaintPackagings(),
        attendu: '1 × Pot 5 L + 1 × Pot 2.5 L',
        raison:
          'S = 8,5, contre 9,0 pour 3 pots de 2,5 L, 9,5 pour 1 × 5 L + ' +
          '4 × 0,5 L, 10,5 pour un pot de 10 L et 14,0 pour 14 pots de 0,5 L',
      },
      {
        besoin: 27,
        formats: makePaintPackagings(),
        attendu: '2 × Pot 10 L + 1 × Pot 5 L + 1 × Pot 2.5 L',
        raison:
          'S = 29,5 contre 31,5 pour 3 pots de 10 L : le quatrième contenant ' +
          "économise 2,5 L, largement plus que le demi-litre qu'il coûte",
      },
      {
        besoin: 3,
        formats: makeTilePackagings(),
        attendu: '3 × Carton 1.08 m²',
        raison:
          'deux cartons plafonnent à 2,88 m² ; à trois cartons, 1,08 est le ' +
          'format le plus serré (S = 6,48 contre 6,84 et 7,56)',
      },
      {
        besoin: 48,
        formats: makeTilePackagings(),
        attendu: '32 × Carton 1.44 m² + 2 × Carton 1.08 m²',
        raison:
          '34 cartons est le plancher (33 × 1,44 = 47,52 < 48) et 48,24 m² le ' +
          'volume minimal à 34 cartons : le panachage domine, quel que soit le ' +
          'prix relatif du contenant',
      },
    ])('$besoin → $attendu — $raison', ({ besoin, formats, attendu }) => {
      expect(purchase(besoin, formats)).toBe(attendu);
    });

    // Le défaut que corrige E1-5, énoncé à l'endroit exact où il était
    // verrouillé : minimiser le seul surplus en volume achetait 14 pots de
    // 0,5 L (7,0 L, surplus 0,34) plutôt que 5 L + 2,5 L (7,5 L, surplus 0,84).
    // Le surplus n'est pas le coût : les 14 pots valent trois à cinq fois le
    // couple en magasin.
    it('renonce à 0,5 L de surplus pour ne pas acheter 12 pots de plus', () => {
      const result = engine.selectBestPackaging(6.68, makePaintPackagings());

      expect(result.breakdown).toEqual([
        { label: 'Pot 5 L', units: 1 },
        { label: 'Pot 2.5 L', units: 1 },
      ]);
      expect(result.units_needed).toBe(2);
      expect(result.label).toBe('Pot 5 L + Pot 2.5 L');
    });

    it('panache pour tomber pile quand un format seul ne le permet pas', () => {
      // 7,5 L : 5 + 2,5 tombe juste en 2 contenants. Trois pots de 2,5 L
      // tombent juste aussi, mais coûtent un contenant de plus.
      const result = engine.selectBestPackaging(7.5, makePaintPackagings());
      expect(result.breakdown).toEqual([
        { label: 'Pot 5 L', units: 1 },
        { label: 'Pot 2.5 L', units: 1 },
      ]);
      expect(result.units_needed * result.qty_per_unit).toBeCloseTo(7.5, 10);
    });

    it('garde un format unique quand il est le meilleur achat', () => {
      const result = engine.selectBestPackaging(10, makePaintPackagings());
      // Un pot de 10 L : S = 10,5, contre 11,0 pour deux pots de 5 L.
      expect(result.breakdown).toEqual([{ label: 'Pot 10 L', units: 1 }]);
      expect(result.label).toBe('Pot 10 L');
      expect(result.qty_per_unit).toBe(10);
      expect(result.units_needed).toBe(1);
    });

    it('should handle empty packagings with fallback', () => {
      const result = engine.selectBestPackaging(5.5, []);
      expect(result.units_needed).toBe(6);
      expect(result.label).toBe('-');
      expect(result.breakdown).toEqual([{ label: '-', units: 6 }]);
    });

    it('achète le même volume de carrelage en 3 cartons de moins', () => {
      const result = engine.selectBestPackaging(13.8, makeTilePackagings());
      // 9 × 1,44 + 1 × 1,08 = 14,04 m² en 10 cartons. L'ancien critère prenait
      // 13 cartons de 1,08 pour exactement le même volume : même surplus, trois
      // cartons de plus à porter et à payer.
      expect(result.breakdown).toEqual([
        { label: 'Carton 1.44 m²', units: 9 },
        { label: 'Carton 1.08 m²', units: 1 },
      ]);
      expect(result.units_needed).toBe(10);
      expect(result.units_needed * result.qty_per_unit).toBeCloseTo(14.04, 10);
    });

    it('ne fait rien acheter quand il n’y a rien à couvrir', () => {
      // Surface nulle (ouvertures plus grandes que le mur) : zéro contenant,
      // mais on nomme quand même le format qu'on aurait pris.
      const result = engine.selectBestPackaging(0, makePaintPackagings());
      expect(result.units_needed).toBe(0);
      expect(result.breakdown).toEqual([]);
      expect(result.label).toBe('Pot 0.5 L');
    });

    it('retombe sur le plafond quand un seul format existe', () => {
      const single: PackagingInput[] = [
        { label: 'Sac 25 kg', quantity_per_unit: 25, unit: 'kg' },
      ];
      expect(engine.selectBestPackaging(30, single).units_needed).toBe(2);
      expect(engine.selectBestPackaging(25, single).units_needed).toBe(1);
      expect(engine.selectBestPackaging(0.1, single).units_needed).toBe(1);
    });

    it('ignore les conditionnements de quantité nulle ou absurde', () => {
      const result = engine.selectBestPackaging(3, [
        { label: 'Pot vide', quantity_per_unit: 0, unit: 'L' },
        { label: 'Pot 2.5 L', quantity_per_unit: 2.5, unit: 'L' },
      ]);
      expect(result.breakdown).toEqual([{ label: 'Pot 2.5 L', units: 2 }]);
    });

    it('reste exact sur un besoin qui dépasse la table de calcul', () => {
      // Au-delà du plafond de la table, le gros de l'achat part sur le plus
      // grand format et seul le reliquat est optimisé — ici 1 000 000 L
      // tombent juste en pots de 10 L.
      const result = engine.selectBestPackaging(
        1_000_000,
        makePaintPackagings(),
      );
      expect(result.breakdown).toEqual([{ label: 'Pot 10 L', units: 100_000 }]);
    });
  });

  // =========================================================================
  // computeGrossSurface
  // =========================================================================
  describe('computeGrossSurface', () => {
    it('should return gross wall surface without opening deduction', () => {
      const room = makeRoom({
        openings: [{ width_cm: 90, height_cm: 204, count: 1 }],
      });
      // 2*(400+300)*250 = 350000 cm² = 35 m² (ignores openings)
      expect(engine.computeGrossSurface(room, 'wall')).toBe(35);
    });

    it('should return floor area for floor target', () => {
      const room = makeRoom();
      expect(engine.computeGrossSurface(room, 'floor')).toBe(12);
    });

    it('should return same value as net for ceiling (no deductions)', () => {
      const room = makeRoom();
      expect(engine.computeGrossSurface(room, 'ceiling')).toBe(
        engine.computeSurface(room, 'ceiling'),
      );
    });
  });

  // =========================================================================
  // computeSurfaceBounds (CV-5)
  // =========================================================================
  describe('computeSurfaceBounds', () => {
    it('returns null when the room has no known uncertainty', () => {
      const room = makeRoom();
      expect(engine.computeSurfaceBounds(room, 'wall')).toBeNull();
      expect(engine.computeSurfaceBounds(room, 'floor')).toBeNull();
    });

    it('bounds the floor surface using length/width uncertainty in both directions', () => {
      const room = makeRoom({
        length_cm_uncertainty: 10,
        width_cm_uncertainty: 5,
      });
      const bounds = engine.computeSurfaceBounds(room, 'floor')!;
      // low: (400-10)*(300-5)/10000 = 390*295/10000 = 11.505
      expect(bounds.low).toBeCloseTo(11.505, 3);
      // high: (400+10)*(300+5)/10000 = 410*305/10000 = 12.505
      expect(bounds.high).toBeCloseTo(12.505, 3);
      // Sanity: point estimate lands strictly inside the bounds.
      const point = engine.computeSurface(room, 'floor');
      expect(bounds.low).toBeLessThan(point);
      expect(bounds.high).toBeGreaterThan(point);
    });

    it('also factors height uncertainty into the wall surface bounds', () => {
      const room = makeRoom({
        length_cm_uncertainty: 10,
        width_cm_uncertainty: 5,
        height_cm_uncertainty: 20,
      });
      const bounds = engine.computeSurfaceBounds(room, 'wall')!;
      // low: perimeter(390,295)*230 = 2*(390+295)*230 = 315100 cm² = 31.51 m²
      expect(bounds.low).toBeCloseTo(31.51, 2);
      // high: perimeter(410,305)*270 = 2*(410+305)*270 = 386100 cm² = 38.61 m²
      expect(bounds.high).toBeCloseTo(38.61, 2);
    });

    it('clamps the low bound to 0 instead of going negative', () => {
      const room = makeRoom({
        length_cm: 5,
        width_cm: 5,
        length_cm_uncertainty: 50,
        width_cm_uncertainty: 50,
      });
      const bounds = engine.computeSurfaceBounds(room, 'floor')!;
      expect(bounds.low).toBe(0);
    });

    it('is null-safe when only one of the three fields has uncertainty', () => {
      const room = makeRoom({ height_cm_uncertainty: 15 });
      // Le sol ne dépend pas de la hauteur : fourchette non nulle mais de
      // largeur nulle (low === high), pas d'absence de fourchette.
      const floorBounds = engine.computeSurfaceBounds(room, 'floor')!;
      expect(floorBounds.low).toBe(floorBounds.high);
      const wallBounds = engine.computeSurfaceBounds(room, 'wall')!;
      expect(wallBounds.low).toBeLessThan(engine.computeSurface(room, 'wall'));
      expect(wallBounds.high).toBeGreaterThan(
        engine.computeSurface(room, 'wall'),
      );
    });
  });

  // =========================================================================
  // computeEstimation — Full integration scenarios
  // =========================================================================
  describe('computeEstimation', () => {
    // AC1: Wall painting 4×3m, h=2.5m, 1 door + 1 window, 2 coats, beginner
    it('should compute wall painting estimation correctly', () => {
      const room = makeRoom({
        openings: [
          { width_cm: 90, height_cm: 204, count: 1 },
          { width_cm: 120, height_cm: 100, count: 1 },
        ],
      });

      const workItems: WorkItemInput[] = [
        {
          id: 'wi-1',
          work_type_code: 'wall_painting',
          work_type_label: 'Peinture murale',
          category: 'painting',
          surface_target: 'wall',
          skill_level: 'beginner',
          custom_params: { number_of_coats: 2 },
          materials: [makePaintMaterial()],
        },
      ];

      const items = engine.computeEstimation(room, workItems);
      expect(items).toHaveLength(1);

      const item = items[0];
      // Gross wall: 35 m² (no opening deduction)
      expect(item.gross_surface_m2).toBe(35);
      // Net wall: 35 - 3.036 = 31.964 m²
      expect(item.surface_m2).toBeCloseTo(31.964, 2);
      // Theoretical: 31.964 / 11 * 2 = 5.812 L
      expect(item.theoretical_qty).toBeCloseTo(5.812, 2);
      // Waste: 15% beginner
      expect(item.waste_factor_percent).toBe(15);
      expect(item.waste_factor_source).toBe('catalog');
      // Adjusted: 5.812 * 1.15 = 6.684 L
      expect(item.adjusted_qty).toBeCloseTo(6.684, 2);
      expect(item.number_of_coats).toBe(2);
      // E1-5 : 6,684 L s'achètent en 1 pot de 5 L + 1 pot de 2,5 L, et la
      // ligne porte le détail. `units_needed` compte les contenants, tous
      // formats confondus, et le contenu moyen garde l'invariant de volume.
      expect(item.packaging_breakdown).toEqual([
        { label: 'Pot 5 L', units: 1 },
        { label: 'Pot 2.5 L', units: 1 },
      ]);
      expect(item.units_needed).toBe(2);
      expect(item.packaging_label).toBe('Pot 5 L + Pot 2.5 L');
      expect(item.units_needed * item.packaging_qty_per_unit).toBeCloseTo(
        7.5,
        10,
      );
      // Aucune exclusion déclarée sur cette pièce.
      expect(item.excluded_surface_m2).toBeUndefined();
      // Aucune incertitude connue sur cette pièce (CV-5) : pas de fourchette.
      expect(item.surface_m2_low).toBeUndefined();
      expect(item.adjusted_qty_low).toBeUndefined();
      expect(item.units_needed_low).toBeUndefined();
    });

    // E1-4 : dans un MÊME ouvrage de peinture, la peinture suit les couches et
    // l'accessoire non. C'est le matériau qui décide, plus la catégorie de
    // l'ouvrage — le défaut corrigé était exactement l'inverse.
    it('applies the coat count to the paint but not to the accessory of the same work item', () => {
      const room = makeRoom(); // mur brut 35 m², aucune ouverture
      const workItems: WorkItemInput[] = [
        {
          id: 'wi-1',
          work_type_code: 'wall_painting',
          work_type_label: 'Peinture murale',
          category: 'painting',
          surface_target: 'wall',
          skill_level: 'expert', // 2 % de perte sur l'accessoire
          custom_params: { number_of_coats: 2 },
          materials: [makePaintMaterial(), makeAccessoryMaterial()],
        },
      ];

      const [paint, accessory] = engine.computeEstimation(room, workItems);

      // 35 / 11 × 2 couches = 6,364 L
      expect(paint.theoretical_qty).toBeCloseTo(6.364, 3);
      expect(paint.number_of_coats).toBe(2);

      // 35 / 1 = 35 unités — surtout PAS 70. La ligne ne porte aucune couche,
      // parce que sa quantité n'en dépend pas.
      expect(accessory.theoretical_qty).toBeCloseTo(35, 3);
      expect(accessory.number_of_coats).toBeUndefined();
      expect(accessory.adjusted_qty).toBeCloseTo(35.7, 3);

      // Le passage à 3 couches ne bouge que la peinture.
      const [paint3, accessory3] = engine.computeEstimation(room, [
        { ...workItems[0], custom_params: { number_of_coats: 3 } },
      ]);
      expect(paint3.theoretical_qty).toBeCloseTo(9.545, 3);
      expect(accessory3.theoretical_qty).toBe(accessory.theoretical_qty);
      expect(accessory3.units_needed).toBe(accessory.units_needed);
    });

    // CV-5 : une pièce mesurée par CV porte une fourchette basse/haute
    // propagée jusqu'à units_needed, cohérente avec le point estimate.
    it('propagates dimension uncertainty into a surface/quantity/units range', () => {
      const room = makeRoom({
        length_cm_uncertainty: 10,
        width_cm_uncertainty: 5,
      });

      const workItems: WorkItemInput[] = [
        {
          id: 'wi-1',
          work_type_code: 'floor_tiling',
          work_type_label: 'Carrelage sol',
          category: 'tiling',
          surface_target: 'floor',
          skill_level: 'beginner',
          custom_params: { laying_pattern: 'straight' },
          materials: [makeTileMaterial()],
        },
      ];

      const item = engine.computeEstimation(room, workItems)[0];

      // Bornes de surface identiques à computeSurfaceBounds (floor : 11.505 / 12.505 m²).
      expect(item.surface_m2_low).toBeCloseTo(11.505, 3);
      expect(item.surface_m2_high).toBeCloseTo(12.505, 3);
      // La fourchette encadre le point estimate.
      expect(item.surface_m2_low!).toBeLessThan(item.surface_m2);
      expect(item.surface_m2_high!).toBeGreaterThan(item.surface_m2);
      expect(item.adjusted_qty_low!).toBeLessThan(item.adjusted_qty);
      expect(item.adjusted_qty_high!).toBeGreaterThan(item.adjusted_qty);
      // Pas de comparaison low vs high ici : selectBestPackaging minimise le
      // surplus indépendamment à chaque borne, donc une bascule de format
      // peut faire consommer moins d'unités à la borne haute (cf. le test
      // dédié de aggregatePurchases sur la bascule de conditionnement).
      expect(item.units_needed_low).toBeGreaterThan(0);
      expect(item.units_needed_high).toBeGreaterThan(0);
    });

    // ENG-3: une exclusion murale réduit surface_m2 et apparaît sur la ligne
    it('should report excluded_surface_m2 and reduce quantities when a wall exclusion is declared', () => {
      const room = makeRoom();
      const withExclusion = makeRoom({
        exclusions: [{ surface_target: 'wall', area_m2: 2 }],
      });

      const workItems: WorkItemInput[] = [
        {
          id: 'wi-1',
          work_type_code: 'wall_painting',
          work_type_label: 'Peinture murale',
          category: 'painting',
          surface_target: 'wall',
          skill_level: 'beginner',
          custom_params: { number_of_coats: 2 },
          materials: [makePaintMaterial()],
        },
      ];

      const baseline = engine.computeEstimation(room, workItems)[0];
      const excluded = engine.computeEstimation(withExclusion, workItems)[0];

      expect(excluded.excluded_surface_m2).toBe(2);
      expect(excluded.surface_m2).toBe(baseline.surface_m2 - 2);
      expect(excluded.adjusted_qty).toBeLessThan(baseline.adjusted_qty);
    });

    // AC2: Floor tiling 4×3m, 30×30, straight, beginner
    it('should compute floor tiling estimation with straight pose', () => {
      const room = makeRoom();

      const workItems: WorkItemInput[] = [
        {
          id: 'wi-2',
          work_type_code: 'floor_tiling',
          work_type_label: 'Carrelage sol',
          category: 'tiling',
          surface_target: 'floor',
          skill_level: 'beginner',
          custom_params: { tile_format: '30x30', laying_pattern: 'straight' },
          materials: [makeTileMaterial()],
        },
      ];

      const items = engine.computeEstimation(room, workItems);
      expect(items).toHaveLength(1);

      const item = items[0];
      // Floor: gross = net = 12 m² (no opening deduction)
      expect(item.gross_surface_m2).toBe(12);
      expect(item.surface_m2).toBe(12);
      expect(item.theoretical_qty).toBe(12);
      // Waste: straight beginner 15%
      expect(item.waste_factor_percent).toBe(15);
      // Adjusted: 12 * 1.15 = 13.8 m²
      expect(item.adjusted_qty).toBe(13.8);
      expect(item.pose_type).toBe('straight');
    });

    // AC3: Diagonal pose adds ~5% more waste
    it('should apply higher waste factor for diagonal pose', () => {
      const room = makeRoom();

      const straightItem: WorkItemInput = {
        id: 'wi-s',
        work_type_code: 'floor_tiling',
        work_type_label: 'Carrelage sol',
        category: 'tiling',
        surface_target: 'floor',
        skill_level: 'beginner',
        custom_params: { laying_pattern: 'straight' },
        materials: [makeTileMaterial()],
      };

      const diagonalItem: WorkItemInput = {
        ...straightItem,
        id: 'wi-d',
        custom_params: { laying_pattern: 'diagonal' },
      };

      const straightItems = engine.computeEstimation(room, [straightItem]);
      const diagonalItems = engine.computeEstimation(room, [diagonalItem]);

      // Straight: 15%, Diagonal: 20% = 5 points difference
      expect(
        diagonalItems[0].waste_factor_percent -
          straightItems[0].waste_factor_percent,
      ).toBe(5);
      expect(diagonalItems[0].adjusted_qty).toBeGreaterThan(
        straightItems[0].adjusted_qty,
      );
    });

    // AC4: Skill level change affects quantities
    it('should produce different quantities for different skill levels', () => {
      const room = makeRoom();

      const makeWI = (skillLevel: string): WorkItemInput => ({
        id: 'wi-1',
        work_type_code: 'floor_tiling',
        work_type_label: 'Carrelage sol',
        category: 'tiling',
        surface_target: 'floor',
        skill_level: skillLevel,
        custom_params: { laying_pattern: 'straight' },
        materials: [makeTileMaterial()],
      });

      const beginner = engine.computeEstimation(room, [makeWI('beginner')])[0];
      const intermediate = engine.computeEstimation(room, [
        makeWI('intermediate'),
      ])[0];
      const expert = engine.computeEstimation(room, [makeWI('expert')])[0];

      expect(beginner.waste_factor_percent).toBe(15);
      expect(intermediate.waste_factor_percent).toBe(10);
      expect(expert.waste_factor_percent).toBe(5);

      expect(beginner.adjusted_qty).toBeGreaterThan(intermediate.adjusted_qty);
      expect(intermediate.adjusted_qty).toBeGreaterThan(expert.adjusted_qty);
    });

    /**
     * E1-7 — un matériau non couvert fait **échouer le chiffrage**, il ne le
     * rend pas plausible. Le test qu'il remplace exigeait l'inverse (« applique
     * 10 % par défaut ») : il gravait le défaut au lieu de le garder, exactement
     * comme le test « minimise le surplus » d'E1-5 (leçon 20).
     */
    it('fait échouer le chiffrage d’un matériau absent du registre', () => {
      const room = makeRoom();

      const workItems: WorkItemInput[] = [
        {
          id: 'wi-1',
          work_type_code: 'floor_tiling',
          work_type_label: 'Carrelage sol',
          category: 'tiling',
          surface_target: 'floor',
          skill_level: 'beginner',
          custom_params: { laying_pattern: 'straight' },
          materials: [makeTileMaterial({ waste_factors: [] })],
        },
      ];

      expect(() => engine.computeEstimation(room, workItems)).toThrow(
        MissingWasteFactorError,
      );
    });

    // Ceiling painting = floor area
    it('should use floor area for ceiling painting', () => {
      const room = makeRoom({
        openings: [{ width_cm: 90, height_cm: 204, count: 1 }],
      });

      const workItems: WorkItemInput[] = [
        {
          id: 'wi-1',
          work_type_code: 'ceiling_painting',
          work_type_label: 'Peinture plafond',
          category: 'painting',
          surface_target: 'ceiling',
          skill_level: 'intermediate',
          custom_params: { number_of_coats: 2 },
          materials: [makePaintMaterial()],
        },
      ];

      const items = engine.computeEstimation(room, workItems);
      // Ceiling = floor = 12 m² (openings not deducted), gross = net
      expect(items[0].gross_surface_m2).toBe(12);
      expect(items[0].surface_m2).toBe(12);
    });

    // Multiple work items in one estimation
    it('should handle multiple work items', () => {
      const room = makeRoom({
        openings: [{ width_cm: 90, height_cm: 204, count: 1 }],
      });

      const workItems: WorkItemInput[] = [
        {
          id: 'wi-paint',
          work_type_code: 'wall_painting',
          work_type_label: 'Peinture murale',
          category: 'painting',
          surface_target: 'wall',
          skill_level: 'beginner',
          custom_params: { number_of_coats: 2 },
          materials: [makePaintMaterial()],
        },
        {
          id: 'wi-tile',
          work_type_code: 'floor_tiling',
          work_type_label: 'Carrelage sol',
          category: 'tiling',
          surface_target: 'floor',
          skill_level: 'beginner',
          custom_params: { laying_pattern: 'straight' },
          materials: [makeTileMaterial()],
        },
      ];

      const items = engine.computeEstimation(room, workItems);
      expect(items.length).toBe(2);
      expect(items[0].work_type_code).toBe('wall_painting');
      expect(items[1].work_type_code).toBe('floor_tiling');
      // Wall has opening deduction, floor does not
      expect(items[0].surface_m2).toBeLessThan(35);
      expect(items[1].surface_m2).toBe(12);
    });

    // Multiple materials per work item
    it('should handle multiple materials per work item', () => {
      const room = makeRoom();

      const workItems: WorkItemInput[] = [
        {
          id: 'wi-1',
          work_type_code: 'wall_painting',
          work_type_label: 'Peinture murale',
          category: 'painting',
          surface_target: 'wall',
          skill_level: 'expert',
          custom_params: { number_of_coats: 2 },
          materials: [
            makePaintMaterial({
              id: 'paint-1',
              name: 'Peinture acrylique mate',
            }),
            makePaintMaterial({
              id: 'paint-2',
              name: 'Sous-couche',
              yield_per_unit: 12,
            }),
          ],
        },
      ];

      const items = engine.computeEstimation(room, workItems);
      expect(items).toHaveLength(2);
      expect(items[0].material_name).toBe('Peinture acrylique mate');
      expect(items[1].material_name).toBe('Sous-couche');
      // Different yields produce different quantities
      expect(items[0].theoretical_qty).not.toBe(items[1].theoretical_qty);
    });

    // Default pose_type when not in custom_params
    it('should default to standard pose_type when not specified', () => {
      const room = makeRoom();

      const workItems: WorkItemInput[] = [
        {
          id: 'wi-1',
          work_type_code: 'wall_painting',
          work_type_label: 'Peinture murale',
          category: 'painting',
          surface_target: 'wall',
          skill_level: 'beginner',
          custom_params: {},
          materials: [makePaintMaterial()],
        },
      ];

      const items = engine.computeEstimation(room, workItems);
      expect(items[0].pose_type).toBe('standard');
      expect(items[0].waste_factor_source).toBe('catalog');
    });
  });

  // =========================================================================
  // Pièces non rectangulaires — composition de rectangles (ENG-1)
  // =========================================================================
  describe('composite (non-rectangular) rooms', () => {
    // Pièce en L : 400×300 prolongée d'une extension 200×150 alignée en bas.
    const lShapeSegments = [
      { x_cm: 0, y_cm: 0, length_cm: 400, width_cm: 300 },
      { x_cm: 400, y_cm: 0, length_cm: 200, width_cm: 150 },
    ];
    const makeLRoom = (overrides?: Partial<RoomData>): RoomData => ({
      length_cm: 600, // boîte englobante — ignorée quand segments est fourni
      width_cm: 300,
      height_cm: 250,
      openings: [],
      segments: lShapeSegments,
      ...overrides,
    });

    it('should compute floor area as the union of the rectangles', () => {
      // 120000 + 30000 = 150000 cm² = 15 m²
      expect(engine.computeSurface(makeLRoom(), 'floor')).toBe(15);
    });

    it('should compute ceiling area equal to the floor', () => {
      expect(engine.computeSurface(makeLRoom(), 'ceiling')).toBe(15);
    });

    it('should compute wall area from the union outline perimeter', () => {
      // Contour = 1800 cm ; 1800 * 250 = 450000 cm² = 45 m².
      // Sommer les périmètres (2100 cm) donnerait 52.5 m² — faux : l'arête
      // interne partagée entre les deux rectangles n'est pas un mur.
      expect(engine.computeSurface(makeLRoom(), 'wall')).toBe(45);
      expect(engine.computeGrossSurface(makeLRoom(), 'wall')).toBe(45);
    });

    it('should deduct openings from the composite wall area', () => {
      const room = makeLRoom({
        openings: [{ width_cm: 90, height_cm: 204, count: 1 }],
      });
      // 45 - (90*204)/10000 = 45 - 1.836 = 43.164
      expect(engine.computeSurface(room, 'wall')).toBeCloseTo(43.164, 3);
      // La surface brute ignore les ouvertures
      expect(engine.computeGrossSurface(room, 'wall')).toBe(45);
    });

    it('should fall back to a single rectangle when segments is empty', () => {
      const withEmpty = makeRoom({ segments: [] });
      const withoutField = makeRoom();
      for (const target of ['floor', 'ceiling', 'wall'] as const) {
        expect(engine.computeSurface(withEmpty, target)).toBe(
          engine.computeSurface(withoutField, target),
        );
      }
    });

    it('should run a full estimation on an L-shaped room (walls + floor)', () => {
      const room = makeLRoom({
        openings: [{ width_cm: 90, height_cm: 204, count: 1 }],
      });
      const workItems: WorkItemInput[] = [
        {
          id: 'wi-paint',
          work_type_code: 'wall_painting',
          work_type_label: 'Peinture murale',
          category: 'painting',
          surface_target: 'wall',
          skill_level: 'beginner',
          custom_params: { number_of_coats: 2 },
          materials: [makePaintMaterial()],
        },
        {
          id: 'wi-tile',
          work_type_code: 'floor_tiling',
          work_type_label: 'Carrelage sol',
          category: 'tiling',
          surface_target: 'floor',
          skill_level: 'beginner',
          custom_params: { laying_pattern: 'straight' },
          materials: [makeTileMaterial()],
        },
      ];

      const items = engine.computeEstimation(room, workItems);
      expect(items).toHaveLength(2);

      const wall = items[0];
      expect(wall.gross_surface_m2).toBe(45);
      expect(wall.surface_m2).toBeCloseTo(43.164, 3);

      const floor = items[1];
      expect(floor.gross_surface_m2).toBe(15);
      expect(floor.surface_m2).toBe(15);
      // Carrelage : 15 m² × 1.15 (débutant, pose droite) = 17.25 m²
      expect(floor.adjusted_qty).toBeCloseTo(17.25, 2);
    });

    // CV-5 : les segments priment sur length_cm/width_cm dans computeSurface,
    // donc leur incertitude ne produit qu'une fourchette de largeur nulle
    // (low === high) sur une pièce composite — limite assumée et documentée
    // sur computeSurfaceBounds.
    it('produces a zero-width range on every target when only length/width have uncertainty', () => {
      const room = makeLRoom({
        length_cm_uncertainty: 10,
        width_cm_uncertainty: 10,
      });
      for (const target of ['floor', 'ceiling', 'wall'] as const) {
        const bounds = engine.computeSurfaceBounds(room, target)!;
        expect(bounds.low).toBe(bounds.high);
      }
    });

    // La hauteur, elle, continue de piloter le mur (perimeter × height ne
    // dépend pas des segments pour ce facteur) — seul le sol/plafond reste
    // insensible, la hauteur n'entrant pas dans leur formule.
    it('still lets height uncertainty produce a wall range on a composite room', () => {
      const room = makeLRoom({ height_cm_uncertainty: 20 });
      const wallBounds = engine.computeSurfaceBounds(room, 'wall')!;
      expect(wallBounds.low).toBeLessThan(wallBounds.high);

      const floorBounds = engine.computeSurfaceBounds(room, 'floor')!;
      expect(floorBounds.low).toBe(floorBounds.high);
    });
  });

  // =========================================================================
  // aggregatePurchases (mutualisation ENG-2 — cœur de la promesse)
  // =========================================================================
  describe('aggregatePurchases', () => {
    const makeLine = (
      overrides: Partial<EstimationLineItem> = {},
    ): EstimationLineItem => ({
      work_item_id: 'wi-1',
      work_type_code: 'wall_painting',
      work_type_label: 'Peinture murale',
      material_id: 'paint-uuid',
      material_name: 'Peinture acrylique mate',
      material_unit: 'L',
      gross_surface_m2: 35,
      surface_m2: 35,
      theoretical_qty: 3,
      waste_factor_percent: 10,
      waste_factor_source: 'catalog',
      adjusted_qty: 4,
      packaging_label: 'Pot 10 L',
      packaging_qty_per_unit: 10,
      units_needed: 1,
      pose_type: 'standard',
      ...overrides,
    });

    const singlePkg = (): Map<string, PackagingInput[]> =>
      new Map([
        [
          'paint-uuid',
          [{ label: 'Pot 10 L', quantity_per_unit: 10, unit: 'L' }],
        ],
      ]);

    it('mutualise un matériau entre deux pièces et économise un conditionnement', () => {
      const lines = [
        makeLine({ room_id: 'r1', room_name: 'Salon', adjusted_qty: 4 }),
        makeLine({ room_id: 'r2', room_name: 'Chambre', adjusted_qty: 4 }),
      ];

      const agg = engine.aggregatePurchases(lines, singlePkg());

      expect(agg).toHaveLength(1);
      expect(agg[0].material_id).toBe('paint-uuid');
      expect(agg[0].total_adjusted_qty).toBe(8);
      // Mutualisé : ceil(8 / 10) = 1 pot.
      // Séparément : ceil(4/10) + ceil(4/10) = 2 pots. Économie d'un pot.
      expect(agg[0].units_needed).toBe(1);
      expect(agg[0].room_count).toBe(2);
      expect(agg[0].contributions).toHaveLength(2);
    });

    it('ne fusionne jamais des matériaux distincts', () => {
      const pkg = new Map<string, PackagingInput[]>([
        [
          'paint-uuid',
          [{ label: 'Pot 10 L', quantity_per_unit: 10, unit: 'L' }],
        ],
        [
          'glue-uuid',
          [{ label: 'Sac 25 kg', quantity_per_unit: 25, unit: 'kg' }],
        ],
      ]);
      const lines = [
        makeLine({ material_id: 'paint-uuid', adjusted_qty: 4 }),
        makeLine({
          material_id: 'glue-uuid',
          material_unit: 'kg',
          adjusted_qty: 30,
          packaging_label: 'Sac 25 kg',
          packaging_qty_per_unit: 25,
        }),
      ];

      const agg = engine.aggregatePurchases(lines, pkg);

      expect(agg).toHaveLength(2);
      const paint = agg.find((a) => a.material_id === 'paint-uuid')!;
      const glue = agg.find((a) => a.material_id === 'glue-uuid')!;
      expect(paint.units_needed).toBe(1); // ceil(4/10)
      expect(glue.units_needed).toBe(2); // ceil(30/25)
    });

    it('re-sélectionne le conditionnement sur la quantité totale (bascule de format)', () => {
      const pkg = new Map<string, PackagingInput[]>([
        [
          'paint-uuid',
          [
            { label: 'Pot 0.5 L', quantity_per_unit: 0.5, unit: 'L' },
            { label: 'Pot 2.5 L', quantity_per_unit: 2.5, unit: 'L' },
            { label: 'Pot 5 L', quantity_per_unit: 5, unit: 'L' },
            { label: 'Pot 10 L', quantity_per_unit: 10, unit: 'L' },
          ],
        ],
      ]);
      const lines = [
        makeLine({
          room_id: 'r1',
          adjusted_qty: 1.2,
          packaging_label: 'Pot 0.5 L',
          packaging_qty_per_unit: 0.5,
          units_needed: 3,
        }),
        makeLine({
          room_id: 'r2',
          adjusted_qty: 1.2,
          packaging_label: 'Pot 0.5 L',
          packaging_qty_per_unit: 0.5,
          units_needed: 3,
        }),
      ];

      const agg = engine.aggregatePurchases(lines, pkg);

      // Total 2.4 L → 1 pot de 2.5 L (vs 3 + 3 = 6 pots de 0.5 L séparément).
      expect(agg[0].total_adjusted_qty).toBe(2.4);
      expect(agg[0].packaging_label).toBe('Pot 2.5 L');
      expect(agg[0].units_needed).toBe(1);
    });

    // E1-5 : la ligne mutualisée porte le détail du panachage — c'est elle qui
    // alimente la liste de courses. `packaging_qty_per_unit` y devient le
    // contenu moyen, seule valeur qui garde vrai `unités × contenu = volume`.
    it('porte le détail du panachage sur la ligne mutualisée', () => {
      const pkg = new Map<string, PackagingInput[]>([
        [
          'paint-uuid',
          [
            { label: 'Pot 0.5 L', quantity_per_unit: 0.5, unit: 'L' },
            { label: 'Pot 2.5 L', quantity_per_unit: 2.5, unit: 'L' },
            { label: 'Pot 5 L', quantity_per_unit: 5, unit: 'L' },
            { label: 'Pot 10 L', quantity_per_unit: 10, unit: 'L' },
          ],
        ],
      ]);
      const lines = [
        makeLine({ room_id: 'r1', adjusted_qty: 3.4 }),
        makeLine({ room_id: 'r2', adjusted_qty: 3.261 }),
      ];

      const agg = engine.aggregatePurchases(lines, pkg);

      expect(agg[0].total_adjusted_qty).toBe(6.661);
      expect(agg[0].packaging_breakdown).toEqual([
        { label: 'Pot 5 L', units: 1 },
        { label: 'Pot 2.5 L', units: 1 },
      ]);
      expect(agg[0].units_needed).toBe(2);
      expect(agg[0].units_needed * agg[0].packaging_qty_per_unit).toBeCloseTo(
        7.5,
        10,
      );
    });

    it('laisse le détail absent quand un seul format suffit', () => {
      const agg = engine.aggregatePurchases(
        [makeLine({ adjusted_qty: 8 })],
        singlePkg(),
      );
      expect(agg[0].packaging_breakdown).toBeUndefined();
      expect(agg[0].packaging_label).toBe('Pot 10 L');
    });

    it('compte une seule pièce pour une estimation mono-pièce (sans room_id)', () => {
      const agg = engine.aggregatePurchases(
        [makeLine({ adjusted_qty: 4 })],
        singlePkg(),
      );
      expect(agg[0].room_count).toBe(1);
    });

    it('retombe sur le conditionnement de la ligne si le catalogue est absent', () => {
      const agg = engine.aggregatePurchases(
        [makeLine({ adjusted_qty: 12, packaging_qty_per_unit: 10 })],
        new Map(),
      );
      // Sans catalogue, utilise le conditionnement porté par la ligne (10 L).
      expect(agg[0].packaging_label).toBe('Pot 10 L');
      expect(agg[0].units_needed).toBe(2); // ceil(12/10)
    });

    it('préserve la traçabilité par pièce dans contributions', () => {
      const agg = engine.aggregatePurchases(
        [
          makeLine({
            room_id: 'r1',
            room_name: 'Salon',
            work_item_id: 'wi-salon',
            surface_m2: 35,
            adjusted_qty: 4,
          }),
        ],
        singlePkg(),
      );
      expect(agg[0].contributions[0]).toMatchObject({
        room_id: 'r1',
        room_name: 'Salon',
        work_item_id: 'wi-salon',
        surface_m2: 35,
        adjusted_qty: 4,
      });
    });

    // CV-5 : la fourchette basse/haute est absente quand aucune ligne du
    // groupe n'en porte (comportement identique à avant CV-5).
    it('omits units_needed_low/high when no contributing line has a range', () => {
      const agg = engine.aggregatePurchases(
        [makeLine({ adjusted_qty: 4 })],
        singlePkg(),
      );
      expect(agg[0].units_needed_low).toBeUndefined();
      expect(agg[0].units_needed_high).toBeUndefined();
    });

    // CV-5 : deux pièces CV se mutualisent, le conditionnement est
    // re-sélectionné indépendamment sur la somme basse et la somme haute.
    it('sums adjusted_qty_low/high across rooms and re-selects packaging on each total', () => {
      const lines = [
        makeLine({
          room_id: 'r1',
          adjusted_qty: 4,
          adjusted_qty_low: 3,
          adjusted_qty_high: 5,
        }),
        makeLine({
          room_id: 'r2',
          adjusted_qty: 4,
          adjusted_qty_low: 3,
          adjusted_qty_high: 5,
        }),
      ];

      const agg = engine.aggregatePurchases(lines, singlePkg());

      // low total = 6 → ceil(6/10) = 1 ; high total = 10 → ceil(10/10) = 1.
      expect(agg[0].units_needed_low).toBe(1);
      expect(agg[0].units_needed_high).toBe(1);
    });

    it('falls back to adjusted_qty for a contributing line without its own range', () => {
      const lines = [
        makeLine({
          room_id: 'r1',
          adjusted_qty: 4,
          adjusted_qty_low: 3,
          adjusted_qty_high: 5,
        }),
        makeLine({ room_id: 'r2', adjusted_qty: 8 }), // pas de fourchette propre
      ];

      const agg = engine.aggregatePurchases(lines, singlePkg());

      // low total = 3 + 8 = 11 → ceil(11/10) = 2 ; high total = 5 + 8 = 13 → ceil(13/10) = 2.
      expect(agg[0].units_needed_low).toBe(2);
      expect(agg[0].units_needed_high).toBe(2);
    });
  });

  // =========================================================================
  // Assiette déclarée et trame (E1-3)
  // =========================================================================
  describe('assiette déclarée et trame', () => {
    /** Cloison 72/48 telle que `work-types.data.ts` la déclare. */
    const PARTITION_FRAME: FrameSpec = {
      stud_spacing_m: 0.6,
      extra_studs: 0,
      runner_courses: 2,
    };

    const makePartitionItem = (
      overrides: Partial<WorkItemInput> = {},
    ): WorkItemInput => ({
      id: 'wi-partition',
      work_type_code: 'drywall',
      work_type_label: 'Cloison seche',
      category: 'partition',
      surface_target: 'wall',
      skill_level: 'intermediate',
      custom_params: {},
      declared_basis: { length_m: 4, height_m: 2.5, clad_faces: 2 },
      frame_spec: PARTITION_FRAME,
      materials: [],
      ...overrides,
    });

    const noWaste = (): WasteFactorInput[] => [
      {
        pose_type: 'standard',
        skill_level: 'intermediate',
        factor_percent: 0,
      },
    ];

    /** Plaque de parement : sa quantité suit le nombre de faces. */
    const makeBoard = (): MaterialInput => ({
      id: 'board-uuid',
      name: 'Plaque BA13 standard 2.5x1.2m',
      unit: 'm2',
      yield_per_unit: 0.96,
      quantity_driver: 'clad_faces',
      waste_factors: noWaste(),
      packagings: [
        { label: 'Plaque (3 m²)', quantity_per_unit: 3, unit: 'm2' },
      ],
    });

    /** Montant : sa quantité suit la trame, jamais le nombre de faces. */
    const makeStud = (): MaterialInput => ({
      id: 'stud-uuid',
      name: 'Montant M48 2.7m',
      unit: 'm',
      yield_per_unit: 1,
      quantity_driver: 'frame_stud',
      waste_factors: noWaste(),
      packagings: [{ label: 'Barre 2.7 m', quantity_per_unit: 2.7, unit: 'm' }],
    });

    const makeRunner = (): MaterialInput => ({
      id: 'runner-uuid',
      name: 'Rail R48 3m',
      unit: 'm',
      yield_per_unit: 1,
      quantity_driver: 'frame_runner',
      waste_factors: noWaste(),
      packagings: [{ label: 'Barre 3 m', quantity_per_unit: 3, unit: 'm' }],
    });

    it('métre une cloison de 4,00 × 2,50 m sur son linéaire et sa hauteur', () => {
      const basis = engine.computeWorkBasis(makeRoom(), makePartitionItem());

      expect(basis.work_surface_m2).toBe(10);
      expect(basis.gross_surface_m2).toBe(10);
      expect(basis.excluded_surface_m2).toBe(0);
      expect(basis.clad_surface_m2).toBe(20);
      expect(basis.clad_faces).toBe(2);
      // Un montant tous les 0,60 m, plus un pour fermer la dernière travée :
      // ceil(4,00 / 0,60) + 1 = 7 + 1 = 8. Deux lisses sur 4,00 m = 8,00 ml.
      expect(basis.frame).toEqual({
        stud_count: 8,
        // E1-8 : la longueur d'un montant, portée explicitement parce qu'elle
        // décide d'un achat — combien de montants tiennent dans une barre.
        stud_piece_length_m: 2.5,
        stud_length_m: 20,
        runner_length_m: 8,
      });
    });

    it('ignore les ouvertures et les zones exclues de la pièce', () => {
      // Elles décrivent les murs existants ; la cloison qu'on dresse n'a ni
      // porte ni crédence tant que l'ouvrage n'en déclare pas.
      const room = makeRoom({
        openings: [{ width_cm: 83, height_cm: 204, count: 1 }],
        exclusions: [{ surface_target: 'wall', area_m2: 5 }],
      });

      const basis = engine.computeWorkBasis(room, makePartitionItem());

      expect(basis.work_surface_m2).toBe(10);
      expect(basis.excluded_surface_m2).toBe(0);
    });

    it('ajoute les montants de rive et d’huisserie déclarés par l’ouvrage', () => {
      const basis = engine.computeWorkBasis(
        makeRoom(),
        makePartitionItem({
          frame_spec: { ...PARTITION_FRAME, extra_studs: 3 },
        }),
      );

      expect(basis.frame?.stud_count).toBe(11);
      expect(basis.frame?.stud_length_m).toBe(27.5);
      // Les lisses ne bougent pas : un montant d'huisserie n'allonge pas la
      // cloison.
      expect(basis.frame?.runner_length_m).toBe(8);
    });

    it('suit l’entraxe déclaré, sans jamais le supposer', () => {
      const basis = engine.computeWorkBasis(
        makeRoom(),
        makePartitionItem({
          frame_spec: { ...PARTITION_FRAME, stud_spacing_m: 0.4 },
        }),
      );

      // ceil(4,00 / 0,40) + 1 = 10 + 1 = 11.
      expect(basis.frame?.stud_count).toBe(11);
    });

    it('ne compte pas un montant de trop sur une longueur multiple de l’entraxe', () => {
      // 5,40 / 0,60 vaut 9.000000000000002 en flottant. Sans tolérance, le
      // moteur compterait dix travées, donc onze montants au lieu de dix.
      const basis = engine.computeWorkBasis(
        makeRoom(),
        makePartitionItem({
          declared_basis: { length_m: 5.4, height_m: 2.5, clad_faces: 2 },
        }),
      );

      expect(basis.frame?.stud_count).toBe(10);
    });

    it('refuse un entraxe nul plutôt que de diviser par zéro', () => {
      expect(() =>
        engine.computeWorkBasis(
          makeRoom(),
          makePartitionItem({
            frame_spec: { ...PARTITION_FRAME, stud_spacing_m: 0 },
          }),
        ),
      ).toThrow(/entraxe strictement positif/);
    });

    /**
     * Le piège du métré plâtrerie, énoncé sur le moteur nu : le nombre de faces
     * multiplie le parement et **rien d'autre**. Les pertes sont mises à zéro
     * pour que les quantités se lisent à la main.
     */
    it('double le parement avec les faces, jamais l’ossature', () => {
      const materials = [makeBoard(), makeStud(), makeRunner()];
      const qtyByName = (cladFaces: number): Map<string, number> =>
        new Map(
          engine
            .computeEstimation(makeRoom(), [
              makePartitionItem({
                materials,
                declared_basis: {
                  length_m: 4,
                  height_m: 2.5,
                  clad_faces: cladFaces,
                },
              }),
            ])
            .map((line) => [line.material_name, line.theoretical_qty]),
        );

      const twoFaces = qtyByName(2);
      const oneFace = qtyByName(1);

      // 20 m² de parement ÷ 0,96 = 20,833 ; une face en demande la moitié.
      expect(twoFaces.get('Plaque BA13 standard 2.5x1.2m')).toBeCloseTo(
        20.833,
        3,
      );
      expect(oneFace.get('Plaque BA13 standard 2.5x1.2m')).toBeCloseTo(
        10.417,
        3,
      );

      // L'ossature est identique : une seule trame dans les deux cas.
      expect(twoFaces.get('Montant M48 2.7m')).toBe(20);
      expect(oneFace.get('Montant M48 2.7m')).toBe(20);
      expect(twoFaces.get('Rail R48 3m')).toBe(8);
      expect(oneFace.get('Rail R48 3m')).toBe(8);
    });

    it('n’affiche aucune fourchette d’incertitude sur une assiette saisie', () => {
      // CV-5 mesure une pièce ; une longueur de cloison est **saisie**. Lui
      // prêter l'incertitude du relevé de la pièce serait une fourchette
      // inventée.
      const room = makeRoom({
        length_cm_uncertainty: 10,
        width_cm_uncertainty: 10,
        height_cm_uncertainty: 5,
      });

      const [line] = engine.computeEstimation(room, [
        makePartitionItem({ materials: [makeBoard()] }),
      ]);

      expect(line.surface_m2).toBe(10);
      expect(line.surface_m2_low).toBeUndefined();
      expect(line.adjusted_qty_low).toBeUndefined();
      expect(line.units_needed_high).toBeUndefined();
    });

    it('lève si un matériau de trame est chiffré sur un ouvrage qui n’en déclare pas', () => {
      expect(() =>
        engine.computeEstimation(makeRoom(), [
          makePartitionItem({ frame_spec: null, materials: [makeStud()] }),
        ]),
      ).toThrow(/ne déclare pas de frame_spec/);
    });

    it('laisse un ouvrage sans assiette déclarée sur la surface de la pièce', () => {
      const item = makePartitionItem({
        declared_basis: undefined,
        frame_spec: null,
      });

      const basis = engine.computeWorkBasis(
        makeRoom({ openings: [{ width_cm: 83, height_cm: 204, count: 1 }] }),
        item,
      );

      // 2 × (4 + 3) × 2,5 − 0,83 × 2,04 = 33,3068 m², à l'identique d'avant E1-3.
      expect(basis.work_surface_m2).toBeCloseTo(33.3068, 4);
      expect(basis.clad_surface_m2).toBe(basis.work_surface_m2);
      expect(basis.clad_faces).toBe(1);
      expect(basis.frame).toBeNull();
    });
  });
});
