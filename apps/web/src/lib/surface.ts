export interface Opening {
  type: 'door' | 'window';
  width_cm: number;
  height_cm: number;
  count: number;
}

export function floorArea(lengthCm: number, widthCm: number): number {
  return lengthCm * widthCm;
}

export function wallArea(lengthCm: number, widthCm: number, heightCm: number): number {
  const perimeter = 2 * (lengthCm + widthCm);
  return perimeter * heightCm;
}

export function totalSurfaceArea(
  lengthCm: number,
  widthCm: number,
  heightCm: number,
): number {
  const floor = floorArea(lengthCm, widthCm);
  const ceiling = floor;
  const walls = wallArea(lengthCm, widthCm, heightCm);
  return floor + ceiling + walls;
}

export function totalOpeningsArea(openings: Opening[]): number {
  return openings.reduce((sum, o) => sum + o.width_cm * o.height_cm * o.count, 0);
}

export function netWallArea(
  lengthCm: number,
  widthCm: number,
  heightCm: number,
  openings: Opening[],
  exclusionsCm2 = 0,
): number {
  const gross = wallArea(lengthCm, widthCm, heightCm);
  const deductions = totalOpeningsArea(openings);
  return Math.max(0, gross - deductions - exclusionsCm2);
}

/* -------------------------------------------------------------------------- */
/* Surfaces à exclure — déduction manuelle simple (ENG-3)                     */
/* -------------------------------------------------------------------------- */

export type ExclusionType = 'credence' | 'half_wall' | 'baseboard' | 'other';

/**
 * Zone non traitée à déduire d'une surface : crédence, demi-mur, plinthes…
 * Miroir de `SurfaceExclusion` du moteur d'estimation API. Déduction manuelle
 * d'une aire (m²), sans géométrie — contrairement aux `Opening` (largeur ×
 * hauteur) ou aux `RectSegment` (décrochés).
 */
export interface SurfaceExclusion {
  surface_target: 'wall' | 'floor' | 'ceiling';
  type: ExclusionType;
  label?: string;
  area_m2: number;
}

export function totalExclusionsArea(
  exclusions: SurfaceExclusion[],
  surfaceTarget: 'wall' | 'floor' | 'ceiling',
): number {
  return exclusions
    .filter((e) => e.surface_target === surfaceTarget)
    .reduce((sum, e) => sum + e.area_m2 * 10_000, 0);
}

/* -------------------------------------------------------------------------- */
/* Pièces non rectangulaires — composition de rectangles (ENG-1)              */
/* -------------------------------------------------------------------------- */

/**
 * Rectangle composant une pièce non rectangulaire (L, T, U…), vu de dessus.
 * (x_cm, y_cm) = coin minimal ; length_cm sur X, width_cm sur Y.
 * Miroir de `RectSegment` du moteur d'estimation API.
 */
export interface RectSegment {
  x_cm: number;
  y_cm: number;
  length_cm: number;
  width_cm: number;
}

export type ShapeSide = 'top' | 'bottom' | 'left' | 'right';

/**
 * Décroché/aile décrit relativement au rectangle principal : accolé à un mur
 * (`side`), à `offset_cm` du coin de départ de ce mur, s'étendant sur
 * `along_cm` le long du mur et faisant saillie de `depth_cm`.
 */
export interface ShapeSection {
  side: ShapeSide;
  offset_cm: number;
  along_cm: number;
  depth_cm: number;
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function validSegments(segments: RectSegment[]): RectSegment[] {
  return segments.filter((s) => s.length_cm > 0 && s.width_cm > 0);
}

interface CompressedGrid {
  xs: number[];
  ys: number[];
  grid: boolean[][];
}

function buildGrid(segments: RectSegment[]): CompressedGrid {
  const valid = validSegments(segments);
  if (valid.length === 0) return { xs: [], ys: [], grid: [] };

  const xs = uniqueSorted(valid.flatMap((s) => [s.x_cm, s.x_cm + s.length_cm]));
  const ys = uniqueSorted(valid.flatMap((s) => [s.y_cm, s.y_cm + s.width_cm]));

  const cols = xs.length - 1;
  const rows = ys.length - 1;
  const grid: boolean[][] = [];

  for (let i = 0; i < cols; i++) {
    grid[i] = [];
    const cx = (xs[i] + xs[i + 1]) / 2;
    for (let j = 0; j < rows; j++) {
      const cy = (ys[j] + ys[j + 1]) / 2;
      grid[i][j] = valid.some(
        (s) =>
          cx > s.x_cm &&
          cx < s.x_cm + s.length_cm &&
          cy > s.y_cm &&
          cy < s.y_cm + s.width_cm,
      );
    }
  }

  return { xs, ys, grid };
}

/** Aire de l'union des rectangles, en cm² (sol / plafond). */
export function compositeFloorArea(segments: RectSegment[]): number {
  const { xs, ys, grid } = buildGrid(segments);
  let area = 0;
  for (let i = 0; i < grid.length; i++) {
    const cellW = xs[i + 1] - xs[i];
    for (let j = 0; j < grid[i].length; j++) {
      if (grid[i][j]) area += cellW * (ys[j + 1] - ys[j]);
    }
  }
  return area;
}

/**
 * Rectangle englobant d'une pièce composée : la référence « rectangle simple »
 * qu'une calculette d'enseigne aurait utilisée en ignorant les décrochés.
 */
export function boundingRectFromSegments(
  segments: RectSegment[],
): { lengthCm: number; widthCm: number } {
  const valid = validSegments(segments);
  if (valid.length === 0) return { lengthCm: 0, widthCm: 0 };

  const minX = Math.min(...valid.map((s) => s.x_cm));
  const maxX = Math.max(...valid.map((s) => s.x_cm + s.length_cm));
  const minY = Math.min(...valid.map((s) => s.y_cm));
  const maxY = Math.max(...valid.map((s) => s.y_cm + s.width_cm));

  return { lengthCm: maxX - minX, widthCm: maxY - minY };
}

/** Périmètre du contour de l'union des rectangles, en cm. */
export function compositePerimeter(segments: RectSegment[]): number {
  const { xs, ys, grid } = buildGrid(segments);
  const cols = grid.length;
  let perimeter = 0;
  for (let i = 0; i < cols; i++) {
    const rows = grid[i].length;
    const cellW = xs[i + 1] - xs[i];
    for (let j = 0; j < rows; j++) {
      if (!grid[i][j]) continue;
      const cellH = ys[j + 1] - ys[j];
      if (i === 0 || !grid[i - 1][j]) perimeter += cellH;
      if (i === cols - 1 || !grid[i + 1][j]) perimeter += cellH;
      if (j === 0 || !grid[i][j - 1]) perimeter += cellW;
      if (j === rows - 1 || !grid[i][j + 1]) perimeter += cellW;
    }
  }
  return perimeter;
}

/** Surface brute des murs d'une pièce composée : périmètre du contour × hauteur. */
export function compositeWallArea(
  segments: RectSegment[],
  heightCm: number,
): number {
  return compositePerimeter(segments) * heightCm;
}

/** Surface nette des murs d'une pièce composée (après déduction des ouvertures). */
export function compositeNetWallArea(
  segments: RectSegment[],
  heightCm: number,
  openings: Opening[],
  exclusionsCm2 = 0,
): number {
  const gross = compositeWallArea(segments, heightCm);
  return Math.max(0, gross - totalOpeningsArea(openings) - exclusionsCm2);
}

/**
 * Construit la liste de rectangles (rectangle principal + décrochés) consommée
 * par le moteur, à partir des décrochés décrits relativement aux murs.
 */
export function sectionsToSegments(
  lengthCm: number,
  widthCm: number,
  sections: ShapeSection[],
): RectSegment[] {
  const segments: RectSegment[] = [
    { x_cm: 0, y_cm: 0, length_cm: lengthCm, width_cm: widthCm },
  ];

  for (const s of sections) {
    const offset = Math.max(0, s.offset_cm);
    const along = Math.max(0, s.along_cm);
    const depth = Math.max(0, s.depth_cm);
    if (along <= 0 || depth <= 0) continue;

    switch (s.side) {
      case 'right':
        segments.push({
          x_cm: lengthCm,
          y_cm: offset,
          length_cm: depth,
          width_cm: along,
        });
        break;
      case 'left':
        segments.push({
          x_cm: -depth,
          y_cm: offset,
          length_cm: depth,
          width_cm: along,
        });
        break;
      case 'top':
        segments.push({
          x_cm: offset,
          y_cm: widthCm,
          length_cm: along,
          width_cm: depth,
        });
        break;
      case 'bottom':
        segments.push({
          x_cm: offset,
          y_cm: -depth,
          length_cm: along,
          width_cm: depth,
        });
        break;
    }
  }

  return segments;
}

/**
 * Reconstruit les décrochés éditables à partir d'une liste de rectangles
 * (opération inverse de `sectionsToSegments`, pour ré-hydrater le formulaire).
 * Le rectangle principal `length × width` est ignoré ; chaque autre rectangle
 * est classé par le mur dont il fait saillie.
 */
export function segmentsToSections(
  lengthCm: number,
  widthCm: number,
  segments: RectSegment[],
): ShapeSection[] {
  const sections: ShapeSection[] = [];

  for (const seg of segments) {
    const isMain =
      seg.x_cm === 0 &&
      seg.y_cm === 0 &&
      seg.length_cm === lengthCm &&
      seg.width_cm === widthCm;
    if (isMain) continue;

    if (seg.x_cm >= lengthCm) {
      sections.push({
        side: 'right',
        offset_cm: seg.y_cm,
        along_cm: seg.width_cm,
        depth_cm: seg.length_cm,
      });
    } else if (seg.x_cm + seg.length_cm <= 0) {
      sections.push({
        side: 'left',
        offset_cm: seg.y_cm,
        along_cm: seg.width_cm,
        depth_cm: seg.length_cm,
      });
    } else if (seg.y_cm >= widthCm) {
      sections.push({
        side: 'top',
        offset_cm: seg.x_cm,
        along_cm: seg.length_cm,
        depth_cm: seg.width_cm,
      });
    } else if (seg.y_cm + seg.width_cm <= 0) {
      sections.push({
        side: 'bottom',
        offset_cm: seg.x_cm,
        along_cm: seg.length_cm,
        depth_cm: seg.width_cm,
      });
    }
    // Rectangle non classifiable (chevauchant le principal) : ignoré.
  }

  return sections;
}
