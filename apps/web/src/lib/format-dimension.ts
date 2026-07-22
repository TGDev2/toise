const metersFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * "4,20 m" ou "4,20 m ± 15 cm" (CV-5) si une incertitude de mesure est
 * connue. `uncertaintyCm` absent/nul/0 → pas de fourchette affichée (saisie
 * manuelle, ou dimension sans incertitude connue).
 */
export function formatDimensionWithUncertainty(
  cm: number,
  uncertaintyCm?: number | null,
): string {
  const meters = metersFormatter.format(cm / 100);
  if (!uncertaintyCm || uncertaintyCm <= 0) {
    return `${meters} m`;
  }
  return `${meters} m ± ${Math.round(uncertaintyCm)} cm`;
}
