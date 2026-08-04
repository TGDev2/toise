/** Arrondit à 2 décimales — la seule échelle monétaire de ce schéma (euros). */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
