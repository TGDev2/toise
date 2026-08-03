/**
 * Affichage d'un achat (E1-5). Depuis que le moteur peut panacher plusieurs
 * formats — 6,66 L de peinture = 1 pot de 5 L + 1 pot de 2,5 L —, le gabarit
 * « N × libellé » ne suffit plus : appliqué à un assortiment, il donnerait
 * « 2 × Pot 5 L + Pot 2.5 L », qui se lit comme deux fois le couple.
 */

export interface PackagingUnitsLine {
  label: string;
  units: number;
}

/** Un achat panaché ne se dit pas « N × un format ». */
export function isMixedPackaging(
  breakdown?: PackagingUnitsLine[] | null,
): boolean {
  return (breakdown?.length ?? 0) > 1;
}

/**
 * Contenants d'une ligne, un élément par format. Retombe sur le couple
 * (libellé, nombre d'unités) pour un achat à format unique et pour toute ligne
 * calculée avant E1-5.
 */
export function packagingUnits(
  unitsNeeded: number,
  packagingLabel: string,
  breakdown?: PackagingUnitsLine[] | null,
): PackagingUnitsLine[] {
  return breakdown?.length
    ? breakdown
    : [{ label: packagingLabel, units: unitsNeeded }];
}

/** « 3 × Pot 2.5 L », ou « 1 × Pot 5 L + 1 × Pot 2.5 L » si panaché. */
export function formatPurchase(
  unitsNeeded: number,
  packagingLabel: string,
  breakdown?: PackagingUnitsLine[] | null,
): string {
  return packagingUnits(unitsNeeded, packagingLabel, breakdown)
    .map((entry) => `${entry.units} × ${entry.label}`)
    .join(' + ');
}
