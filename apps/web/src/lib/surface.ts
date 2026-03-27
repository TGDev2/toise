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
): number {
  const gross = wallArea(lengthCm, widthCm, heightCm);
  const deductions = totalOpeningsArea(openings);
  return Math.max(0, gross - deductions);
}
