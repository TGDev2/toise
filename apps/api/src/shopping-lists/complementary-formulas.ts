export interface ComplementaryContext {
  total_surface_m2: number;
  tile_length_cm: number;
  tile_width_cm: number;
}

const KG_PER_M2_SMALL_TILE = 3;
const KG_PER_M2_LARGE_TILE = 5;
const LARGE_TILE_THRESHOLD_CM = 30;
const ADHESIVE_BAG_KG = 25;

const GROUT_KG_PER_M2 = 0.5;
const GROUT_BAG_KG = 5;

const SPACERS_PER_TILE = 4;
const SPACERS_PER_SACHET = 200;

export function parseTileFormat(
  format: string,
): { length_cm: number; width_cm: number } | null {
  const match = format.match(/^(\d+)x(\d+)$/);
  if (!match) return null;
  return {
    length_cm: Number(match[1]),
    width_cm: Number(match[2]),
  };
}

function computeTilingAdhesive(ctx: ComplementaryContext): number {
  const maxSide = Math.max(ctx.tile_length_cm, ctx.tile_width_cm);
  const kgPerM2 =
    maxSide <= LARGE_TILE_THRESHOLD_CM
      ? KG_PER_M2_SMALL_TILE
      : KG_PER_M2_LARGE_TILE;
  return Math.ceil((ctx.total_surface_m2 * kgPerM2) / ADHESIVE_BAG_KG);
}

function computeTilingGrout(ctx: ComplementaryContext): number {
  return Math.ceil(
    (ctx.total_surface_m2 * GROUT_KG_PER_M2) / GROUT_BAG_KG,
  );
}

function computeTilingSpacers(ctx: ComplementaryContext): number {
  const tileAreaM2 =
    (ctx.tile_length_cm * ctx.tile_width_cm) / 10_000;
  if (tileAreaM2 <= 0) return 1;
  const tileCount = ctx.total_surface_m2 / tileAreaM2;
  return Math.max(1, Math.ceil((tileCount * SPACERS_PER_TILE) / SPACERS_PER_SACHET));
}

export function computeComplementaryQuantity(
  formulaCode: string,
  ctx: ComplementaryContext,
): number | null {
  switch (formulaCode) {
    case 'tiling_adhesive':
      return computeTilingAdhesive(ctx);
    case 'tiling_grout':
      return computeTilingGrout(ctx);
    case 'tiling_spacers':
      return computeTilingSpacers(ctx);
    default:
      return null;
  }
}
