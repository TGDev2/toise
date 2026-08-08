/**
 * E2-4 — la validation des quantités avant émission d'un devis.
 *
 * L'empreinte n'est jamais calculée ici : elle vient du serveur, qui la
 * recalcule à l'émission. Un `sha256` reconstruit côté navigateur aurait été
 * une seconde définition de la même grandeur, et c'est la garde qui aurait
 * cédé le jour où les deux auraient divergé.
 */

export interface ValidatedQuantityLine {
  material_id: string;
  material_name: string;
  work_type_code: string;
  work_type_label: string;
  packaging_label: string;
  units_needed: number;
}

export interface QuantityValidationState {
  fingerprint: string;
  lines: ValidatedQuantityLine[];
  /** ISO 8601, ou `null` tant que ces quantités-là n'ont pas été validées. */
  validated_at: string | null;
  validated_by: string | null;
}
