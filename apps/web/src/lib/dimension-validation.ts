export interface DimensionWarning {
  field: 'length' | 'width' | 'height';
  message: string;
}

const HEIGHT_MIN_CM = 150;
const HEIGHT_MAX_CM = 600;
const SIZE_MIN_CM = 50;
const SIZE_MAX_CM = 3000;

export function getDimensionWarnings(
  lengthCm: number,
  widthCm: number,
  heightCm: number,
): DimensionWarning[] {
  const warnings: DimensionWarning[] = [];

  if (heightCm > 0 && heightCm < HEIGHT_MIN_CM) {
    warnings.push({ field: 'height', message: `Hauteur inhabituelle (< ${HEIGHT_MIN_CM / 100} m)` });
  }
  if (heightCm > HEIGHT_MAX_CM) {
    warnings.push({ field: 'height', message: `Hauteur inhabituelle (> ${HEIGHT_MAX_CM / 100} m)` });
  }

  if (lengthCm > 0 && lengthCm < SIZE_MIN_CM) {
    warnings.push({ field: 'length', message: `Longueur inhabituelle (< ${SIZE_MIN_CM / 100} m)` });
  }
  if (lengthCm > SIZE_MAX_CM) {
    warnings.push({ field: 'length', message: `Longueur inhabituelle (> ${SIZE_MAX_CM / 100} m)` });
  }

  if (widthCm > 0 && widthCm < SIZE_MIN_CM) {
    warnings.push({ field: 'width', message: `Largeur inhabituelle (< ${SIZE_MIN_CM / 100} m)` });
  }
  if (widthCm > SIZE_MAX_CM) {
    warnings.push({ field: 'width', message: `Largeur inhabituelle (> ${SIZE_MAX_CM / 100} m)` });
  }

  return warnings;
}

interface DimensionForm {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export function getMissingFields(form: DimensionForm): string[] {
  const missing: string[] = [];
  if (!form.lengthCm || form.lengthCm <= 0) missing.push('Longueur');
  if (!form.widthCm || form.widthCm <= 0) missing.push('Largeur');
  if (!form.heightCm || form.heightCm <= 0) missing.push('Hauteur');
  return missing;
}
