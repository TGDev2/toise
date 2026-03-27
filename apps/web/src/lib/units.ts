export type UnitSystem = 'metric' | 'imperial';

const CM_PER_METER = 100;
const CM_PER_FOOT = 30.48;
const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;

export function metersToCm(m: number): number {
  return m * CM_PER_METER;
}

export function cmToMeters(cm: number): number {
  return cm / CM_PER_METER;
}

export function feetInchesToCm(feet: number, inches: number): number {
  return feet * CM_PER_FOOT + inches * CM_PER_INCH;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / CM_PER_INCH;
  const feet = Math.floor(totalInches / INCHES_PER_FOOT);
  const inches = Math.round((totalInches % INCHES_PER_FOOT) * 100) / 100;
  return { feet, inches };
}
