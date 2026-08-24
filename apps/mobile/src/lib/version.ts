/**
 * Pure version comparison, kept free of expo imports so it can be exercised
 * without a native runtime.
 */

/** Numeric compare of dotted versions; missing segments count as 0. */
export function isVersionBelow(version: string, minimum: string): boolean {
  const a = version.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const b = minimum.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left !== right) return left < right;
  }
  return false;
}
