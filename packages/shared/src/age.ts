export const AGE_GROUPS = ["Under 18", "18-24", "25-34", "35-44", "45-54", "55+"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export function ageGroup(age: number): AgeGroup {
  if (age < 18) return "Under 18";
  if (age <= 24) return "18-24";
  if (age <= 34) return "25-34";
  if (age <= 44) return "35-44";
  if (age <= 54) return "45-54";
  return "55+";
}
