/**
 * Safe numeric formatting helpers preventing runtime TypeError exceptions
 * when data values are missing, null, undefined, or NaN.
 */

export function safeFixed(
  val: number | null | undefined,
  decimals = 2,
  fallback = '—'
): string {
  if (val === null || val === undefined || typeof val !== 'number' || Number.isNaN(val)) {
    return fallback;
  }
  return val.toFixed(decimals);
}

export function safeExp(
  val: number | null | undefined,
  decimals = 2,
  fallback = '—'
): string {
  if (val === null || val === undefined || typeof val !== 'number' || Number.isNaN(val)) {
    return fallback;
  }
  return val.toExponential(decimals);
}
