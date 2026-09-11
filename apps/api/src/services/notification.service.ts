import type { FastifyInstance } from "fastify";
import { matchesDemographics } from "../lib/demographics";

/**
 * How many evaluator profiles a single scan page pulls at once (21.1's activation trigger
 * and reminder sweep both page through the whole table). Bounded so a large evaluator base
 * never loads into memory in one shot, mirroring evaluator.ts's ACTIVE_TEST_SCAN_LIMIT.
 */
const PROFILE_SCAN_BATCH = 500;

type ScannedProfile = {
  id: string;
  userId: string;
  age: number;
  gender: string;
  country: string;
  city: string | null;
};

async function findMatchingEvaluatorUserIds(
  app: FastifyInstance,
  demographicFilters: unknown
): Promise<string[]> {
  const matched: string[] = [];
  let cursor: string | undefined;

  for (;;) {
    const page: ScannedProfile[] = await app.prisma.evaluatorProfile.findMany({
      take: PROFILE_SCAN_BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: { id: true, userId: true, age: true, gender: true, country: true, city: true },
    });
    if (page.length === 0) break;

    for (const profile of page) {
      if (matchesDemographics(profile, demographicFilters)) {
        matched.push(profile.userId);
      }
    }

    cursor = page[page.length - 1]!.id;
    if (page.length < PROFILE_SCAN_BATCH) break;
  }

  return matched;
}

type ActivatedTest = {
  id: string;
  title: string;
  demographicFilters: unknown;
  responseCap: number | null;
};

/**
 * 21.1's "new matching test activated" signal. Writes one PENDING NotificationLog row per
 * matching, not-yet-responded evaluator, relying on the `(userId, kind, dedupeKey)` unique
 * constraint plus `skipDuplicates` for the "never notify twice for the same activation"
 * guarantee - that ON CONFLICT DO NOTHING is atomic per row, so it holds even if this ever
 * runs twice concurrently for the same test (e.g. a retried status-update request).
 */
export async function enqueueTestActivationNotifications(
  app: FastifyInstance,
  test: ActivatedTest
): Promise<number> {
  const responded = await app.prisma.testResponse.findMany({
    where: { testId: test.id },
    select: { userId: true },
  });
  if (test.responseCap !== null && responded.length >= test.responseCap) return 0;
  const respondedIds = new Set(responded.map((r) => r.userId));

  const matchingUserIds = await findMatchingEvaluatorUserIds(app, test.demographicFilters);
  const targetUserIds = matchingUserIds.filter((userId) => !respondedIds.has(userId));
  if (targetUserIds.length === 0) return 0;

  const result = await app.prisma.notificationLog.createMany({
    data: targetUserIds.map((userId) => ({
      userId,
      kind: "TEST_ACTIVATED" as const,
      dedupeKey: test.id,
      testId: test.id,
      title: "A new test is waiting for you",
      body: test.title,
      data: { type: "TEST_ACTIVATED", testId: test.id },
    })),
    skipDuplicates: true,
  });
  return result.count;
}

/** Configurable via env; defaults to the middle of plan.md's suggested 3-7 day range. */
function reminderIntervalDays(): number {
  const parsed = Number(process.env.REMINDER_INTERVAL_DAYS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

/**
 * Buckets time into fixed-width windows so a reminder is at most one per evaluator per
 * window, regardless of how many times the sweep runs inside it - the actual dedup is still
 * the unique constraint + skipDuplicates below; this just picks the key that constraint acts
 * on.
 */
function reminderWindowKey(now: Date, intervalDays: number): string {
  const bucketMs = intervalDays * 24 * 60 * 60 * 1000;
  return String(Math.floor(now.getTime() / bucketMs));
}

/**
 * 21.1's re-engagement reminder. Not per-test - one row per quiet evaluator per reminder
 * window, keyed off `EvaluatorProfile.lastActivityAt` so it costs one indexed scan rather
 * than a join against every evaluator's response history.
 */
export async function runReminderSweep(app: FastifyInstance, now: Date = new Date()): Promise<number> {
  const intervalDays = reminderIntervalDays();
  const cutoff = new Date(now.getTime() - intervalDays * 24 * 60 * 60 * 1000);
  const dedupeKey = reminderWindowKey(now, intervalDays);

  let enqueued = 0;
  let cursor: string | undefined;

  for (;;) {
    const page = await app.prisma.evaluatorProfile.findMany({
      where: { lastActivityAt: { lt: cutoff } },
      take: PROFILE_SCAN_BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: { id: true, userId: true },
    });
    if (page.length === 0) break;

    const result = await app.prisma.notificationLog.createMany({
      data: page.map((profile) => ({
        userId: profile.userId,
        kind: "REMINDER" as const,
        dedupeKey,
        title: "Tests are waiting for you",
        body: "New tests may already match your profile - come take a look.",
        data: { type: "REMINDER" },
      })),
      skipDuplicates: true,
    });
    enqueued += result.count;

    cursor = page[page.length - 1]!.id;
    if (page.length < PROFILE_SCAN_BATCH) break;
  }

  return enqueued;
}
