import { MINOR_UNITS_PER_MAJOR } from "@/lib/config/research-product";

export function minorUnitsToDecimalString(minorUnits: number): string {
  return (minorUnits / MINOR_UNITS_PER_MAJOR).toFixed(2);
}

export function decimalStringToMinorUnits(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Invalid money amount");
  }
  return Math.round(parsed * MINOR_UNITS_PER_MAJOR);
}

export function amountsMatch(
  expectedMinorUnits: number,
  paidDecimal: string,
): boolean {
  try {
    return decimalStringToMinorUnits(paidDecimal) === expectedMinorUnits;
  } catch {
    return false;
  }
}
