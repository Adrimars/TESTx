export const AGE_GROUPS = ["18-24", "25-34", "35-44", "45-54", "55+"] as const;

export type AgeGroup = (typeof AGE_GROUPS)[number];

/** Full years elapsed since `dateOfBirth`, accounting for month and day. */
export function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) age--;
  return age;
}

/**
 * Demographic bucket for `dateOfBirth`. Shares `calculateAge` with test eligibility so a
 * person is never eligible for one age band and reported under another.
 */
export function getAgeGroup(dateOfBirth: Date): AgeGroup {
  const age = calculateAge(dateOfBirth);
  if (age < 25) return "18-24";
  if (age < 35) return "25-34";
  if (age < 45) return "35-44";
  if (age < 55) return "45-54";
  return "55+";
}
