/**
 * Shared by `apps/api/src/routes/evaluator.ts` (per-user: does this evaluator match a test)
 * and 21.1's activation trigger (per-test: which evaluators match this test) - both need
 * exactly the same filter semantics, so it lives here instead of being redefined twice.
 */
export function matchesDemographics(
  profile: { age: number; gender: string; country: string; city: string | null },
  filters: unknown
): boolean {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) return true;
  const f = filters as Record<string, unknown>;

  if (typeof f.ageMin === "number" && profile.age < f.ageMin) return false;
  if (typeof f.ageMax === "number" && profile.age > f.ageMax) return false;

  if (Array.isArray(f.genders) && f.genders.length > 0) {
    if (!f.genders.includes(profile.gender)) return false;
  }
  if (Array.isArray(f.countries) && f.countries.length > 0) {
    if (!f.countries.includes(profile.country)) return false;
  }
  if (Array.isArray(f.cities) && f.cities.length > 0) {
    if (!profile.city || !f.cities.includes(profile.city)) return false;
  }

  return true;
}
