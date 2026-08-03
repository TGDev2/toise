import {
  EstimationEngine,
  RoomData,
  WorkItemInput,
  MaterialInput,
  PackagingInput,
  WasteFactorInput,
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

    it('should fallback to standard pose_type when exact match not found', () => {
      const result = engine.resolveWasteFactor(
        makePaintWasteFactors(),
        'unknown_pose',
        'beginner',
      );
      expect(result).toEqual({ percent: 15, source: 'catalog' });
    });

    it('should return default 10% when no match at all', () => {
      const result = engine.resolveWasteFactor([], 'standard', 'beginner');
      expect(result).toEqual({ percent: 10, source: 'default' });
    });

    it('should return default when skill level not in catalog', () => {
      const factors: WasteFactorInput[] = [
        { pose_type: 'standard', skill_level: 'expert', factor_percent: 5 },
      ];
      const result = engine.resolveWasteFactor(factors, 'standard', 'beginner');
      expect(result).toEqual({ percent: 10, source: 'default' });
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
    it('should select packaging that minimizes surplus', () => {
      const result = engine.selectBestPackaging(6.68, makePaintPackagings());
      // Pot 10L: 1 unit, surplus 3.32
      // Pot 5L: 2 units, surplus 3.32
      // Pot 2.5L: 3 units, surplus 0.82  <-- best (least surplus)
      // Pot 0.5L: 14 units, surplus 0.32 <-- actually less surplus
      expect(result.label).toBe('Pot 0.5 L');
      expect(result.units_needed).toBe(14);
    });

    it('should prefer fewer units on tie', () => {
      // 10L: 1 unit, surplus = 10-7.5 = 2.5
      // 5L: 2 units, surplus = 10-7.5 = 2.5
      // 2.5L: 3 units, surplus = 7.5-7.5 = 0
      const result = engine.selectBestPackaging(7.5, makePaintPackagings());
      expect(result.label).toBe('Pot 2.5 L');
      expect(result.units_needed).toBe(3);
    });

    it('should handle exact fit', () => {
      const result = engine.selectBestPackaging(10, makePaintPackagings());
      // Pot 10L: 1 unit, surplus 0 -- perfect
      expect(result.label).toBe('Pot 10 L');
      expect(result.units_needed).toBe(1);
    });

    it('should handle empty packagings with fallback', () => {
      const result = engine.selectBestPackaging(5.5, []);
      expect(result.units_needed).toBe(6);
    });

    it('should handle tile packaging', () => {
      const result = engine.selectBestPackaging(13.8, makeTilePackagings());
      // Carton 1.08 m²: ceil(13.8/1.08) = 13 cartons, 13*1.08=14.04, surplus=0.24
      // Carton 1.44 m²: ceil(13.8/1.44) = 10 cartons, 10*1.44=14.4, surplus=0.6
      expect(result.label).toBe('Carton 1.08 m²');
      expect(result.units_needed).toBe(13);
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
      expect(item.units_needed).toBeGreaterThan(0);
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

    // AC5: Default waste when material not covered
    it('should apply default 10% waste when no waste factors in catalog', () => {
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

      const items = engine.computeEstimation(room, workItems);
      expect(items[0].waste_factor_percent).toBe(10);
      expect(items[0].waste_factor_source).toBe('default');
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
});
