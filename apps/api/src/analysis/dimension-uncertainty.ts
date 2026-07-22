import { ConfidenceScore } from '../projects/entities/room-dimensions.entity';
import type { CvAccuracyReport } from './cv-accuracy.service';

export type DimensionField = 'length_cm' | 'width_cm' | 'height_cm';

// Bandes de repli (cm) tant que le volume de corrections `cv_correction_logs`
// n'atteint pas `sufficient_data` (CV-2) pour un champ donné. Calibrables,
// pas de source empirique disponible avant un volume réel de corrections.
const FALLBACK_UNCERTAINTY_CM: Record<ConfidenceScore, number> = {
  [ConfidenceScore.HIGH]: 2,
  [ConfidenceScore.MEDIUM]: 8,
  [ConfidenceScore.LOW]: 20,
};

/**
 * Incertitude (cm) pour un champ de dimension détecté par CV : écart médian
 * empirique du rapport `cv-accuracy` (CV-2) si le groupe correspondant a
 * `sufficient_data`, sinon bande heuristique par `confidence_score` (CV-5).
 */
export function resolveUncertaintyCm(
  field: DimensionField,
  confidenceScore: ConfidenceScore,
  accuracyReport: CvAccuracyReport,
): number {
  const group = accuracyReport.groups.find(
    (g) => g.entity_type === 'dimension' && g.field === field,
  );

  if (group?.sufficient_data && group.median_error_cm !== null) {
    return group.median_error_cm;
  }

  return FALLBACK_UNCERTAINTY_CM[confidenceScore];
}
