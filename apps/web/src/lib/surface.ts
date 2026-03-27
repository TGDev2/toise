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
