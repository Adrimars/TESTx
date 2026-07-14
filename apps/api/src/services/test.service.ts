import type { PrismaClient, EvaluatorProfile, Test } from "@testx/database";
import type { DemographicFilters } from "@testx/shared";

function calculateAge(dob: Date, reference: Date = new Date()): number {
  let age = reference.getFullYear() - dob.getFullYear();
  const m = reference.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && reference.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

function isFilterObject(value: unknown): value is DemographicFilters {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function matchesDemographics(
  filters: unknown,
  profile: Pick<EvaluatorProfile, "dateOfBirth" | "gender" | "country" | "city">
): boolean {
  if (!isFilterObject(filters)) return true;

  const age = calculateAge(profile.dateOfBirth);
  if (typeof filters.ageMin === "number" && age < filters.ageMin) return false;
  if (typeof filters.ageMax === "number" && age > filters.ageMax) return false;

  if (Array.isArray(filters.genders) && filters.genders.length > 0) {
    if (!filters.genders.includes(profile.gender)) return false;
  }

  if (Array.isArray(filters.countries) && filters.countries.length > 0) {
    if (!filters.countries.includes(profile.country)) return false;
  }

  if (Array.isArray(filters.cities) && filters.cities.length > 0) {
    if (!profile.city || !filters.cities.includes(profile.city)) return false;
  }

  return true;
}

export async function findEligibleTestForEvaluator(
  prisma: PrismaClient,
  userId: string
): Promise<Test | null> {
  const profile = await prisma.evaluatorProfile.findUnique({ where: { userId } });
  if (!profile) return null;

  const respondedTestIds = (
    await prisma.testResponse.findMany({
      where: { userId },
      select: { testId: true },
    })
  ).map((row) => row.testId);

  const candidates = await prisma.test.findMany({
    where: {
      status: "ACTIVE",
      id: respondedTestIds.length > 0 ? { notIn: respondedTestIds } : undefined,
    },
    include: { _count: { select: { responses: true } } },
    orderBy: { createdAt: "asc" },
  });

  for (const test of candidates) {
    if (test.responseCap !== null && test._count.responses >= test.responseCap) {
      continue;
    }
    if (!matchesDemographics(test.demographicFilters, profile)) {
      continue;
    }
    return test;
  }

  return null;
}

export async function isEvaluatorEligibleForTest(
  prisma: PrismaClient,
  userId: string,
  testId: string
): Promise<
  | { eligible: true; test: Test }
  | { eligible: false; status: number; error: string; message: string }
> {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { _count: { select: { responses: true } } },
  });
  if (!test) {
    return { eligible: false, status: 404, error: "NOT_FOUND", message: "Test not found" };
  }
  if (test.status !== "ACTIVE") {
    return {
      eligible: false,
      status: 400,
      error: "TEST_NOT_ACTIVE",
      message: "This test is not currently accepting responses",
    };
  }

  const profile = await prisma.evaluatorProfile.findUnique({ where: { userId } });
  if (!profile) {
    return {
      eligible: false,
      status: 400,
      error: "PROFILE_REQUIRED",
      message: "Demographic profile is required",
    };
  }

  const existingResponse = await prisma.testResponse.findUnique({
    where: { testId_userId: { testId, userId } },
    select: { id: true },
  });
  if (existingResponse) {
    return {
      eligible: false,
      status: 409,
      error: "ALREADY_SUBMITTED",
      message: "You have already completed this test",
    };
  }

  if (test.responseCap !== null && test._count.responses >= test.responseCap) {
    return {
      eligible: false,
      status: 409,
      error: "RESPONSE_CAP_REACHED",
      message: "This test has reached its response cap",
    };
  }

  if (!matchesDemographics(test.demographicFilters, profile)) {
    return {
      eligible: false,
      status: 403,
      error: "DEMOGRAPHIC_MISMATCH",
      message: "You are not eligible for this test",
    };
  }

  return { eligible: true, test };
}
