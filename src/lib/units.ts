import type { HeightUnit, VolumeUnit, WeightUnit } from '@/features/auth/auth.store';

// ============================================================================
// PESO (almacenado en kg)
// ============================================================================

const LB_PER_KG = 2.2046226218;

export function kgToDisplay(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kg * LB_PER_KG : kg;
}

export function displayToKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value / LB_PER_KG : value;
}

export function formatWeight(kg: number, unit: WeightUnit, digits = 1): string {
  const v = kgToDisplay(kg, unit);
  return `${v.toFixed(digits)} ${unit === 'lb' ? 'lb' : 'kg'}`;
}

// ============================================================================
// VOLUMEN (almacenado en ml)
// ============================================================================

const FLOZ_PER_ML = 0.033814022702; // US fluid ounce

export function mlToDisplay(ml: number, unit: VolumeUnit): number {
  return unit === 'floz' ? ml * FLOZ_PER_ML : ml;
}

export function displayToMl(value: number, unit: VolumeUnit): number {
  return unit === 'floz' ? value / FLOZ_PER_ML : value;
}

export function formatVolume(ml: number, unit: VolumeUnit, digits = 0): string {
  const v = mlToDisplay(ml, unit);
  return `${v.toFixed(digits)} ${unit === 'floz' ? 'fl oz' : 'ml'}`;
}

// ============================================================================
// ALTURA (almacenada en cm)
// ============================================================================

const CM_PER_INCH = 2.54;

export function cmToInches(cm: number): number {
  return cm / CM_PER_INCH;
}

export function inchesToCm(inches: number): number {
  return inches * CM_PER_INCH;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / CM_PER_INCH;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  if (inches === 12) return { feet: feet + 1, inches: 0 };
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_INCH;
}

export function formatHeight(cm: number, unit: HeightUnit): string {
  if (unit === 'ft_in') {
    const { feet, inches } = cmToFeetInches(cm);
    return `${feet}′${inches}″`;
  }
  return `${Math.round(cm)} cm`;
}
