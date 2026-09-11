import type { FastifyInstance } from "fastify";
import webPush from "web-push";
import type { Prisma, PushSubscription } from "@testx/database";
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

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const DISPATCH_BATCH_SIZE = 50;

type NotificationPayload = { title: string; body: string; data: Prisma.JsonValue };

let vapidConfigured = false;

/** VAPID keys are optional in dev - without them, web push sends are simply skipped rather
 * than crashing the dispatch loop, so native push still works with no web push setup at all. */
function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webPush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:support@testx.app", publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

/**
 * One Expo push API call for every IOS/ANDROID subscription this notification targets - the
 * API accepts a batch of messages per request, which is both fewer round trips and how Expo
 * itself recommends sending to many recipients at once.
 */
async function sendExpoPush(
  app: FastifyInstance,
  subs: PushSubscription[],
  payload: NotificationPayload
): Promise<void> {
  if (subs.length === 0) return;

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(
      subs.map((sub) => ({ to: sub.token, title: payload.title, body: payload.body, data: payload.data ?? undefined }))
    ),
  });

  const result = (await response.json().catch(() => null)) as
    | { data?: Array<{ status: string; details?: { error?: string } }> }
    | null;
  if (!response.ok) {
    throw new Error(`Expo push API responded ${response.status}`);
  }

  // A token the OS itself has invalidated (uninstall, revoked permission) comes back tagged
  // this way - deleting it here is what keeps PushSubscription from accumulating dead rows
  // that would otherwise fail forever on every future send to this user.
  const tickets = result?.data ?? [];
  const staleIds = subs
    .filter((_, index) => tickets[index]?.details?.error === "DeviceNotRegistered")
    .map((sub) => sub.id);
  if (staleIds.length > 0) {
    await app.prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } });
  }
}

/** One `web-push` call per WEB subscription - unlike Expo's API, it has no batch endpoint. */
async function sendWebPush(
  app: FastifyInstance,
  subs: PushSubscription[],
  payload: NotificationPayload
): Promise<void> {
  if (subs.length === 0 || !ensureVapidConfigured()) return;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webPush.sendNotification(JSON.parse(sub.token), JSON.stringify(payload));
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // 404/410 means the browser's push service considers the subscription gone -
        // permanent, not worth retrying, so the stale row is removed rather than left to
        // fail the same way on every future send.
        if (statusCode === 404 || statusCode === 410) {
          await app.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          throw err;
        }
      }
    })
  );
}

/**
 * 21.2's dispatch loop. Claims a batch of PENDING rows with `SELECT ... FOR UPDATE SKIP
 * LOCKED` inside a transaction that immediately flips them to PROCESSING and commits -
 * releasing the row lock right away, but leaving the rows no longer PENDING, so a second
 * worker's own claim query (run concurrently, e.g. if this is ever scaled past one process)
 * simply skips them instead of double-sending. The actual network sends happen afterward,
 * outside that transaction, since they can take long enough that holding a DB lock across
 * them would be its own problem.
 */
export async function dispatchPendingNotifications(
  app: FastifyInstance,
  batchSize = DISPATCH_BATCH_SIZE
): Promise<number> {
  const claimedIds = await app.prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "NotificationLog"
      WHERE status = 'PENDING'
      ORDER BY "createdAt" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    `;
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    await tx.notificationLog.updateMany({
      where: { id: { in: ids } },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
    return ids;
  });

  if (claimedIds.length === 0) return 0;

  const rows = await app.prisma.notificationLog.findMany({
    where: { id: { in: claimedIds } },
    include: { user: { include: { pushSubscriptions: true } } },
  });

  await Promise.all(
    rows.map(async (row) => {
      const payload: NotificationPayload = { title: row.title, body: row.body, data: row.data };
      const subs = row.user.pushSubscriptions;
      const expoSubs = subs.filter((sub) => sub.platform === "IOS" || sub.platform === "ANDROID");
      const webSubs = subs.filter((sub) => sub.platform === "WEB");

      try {
        await Promise.all([sendExpoPush(app, expoSubs, payload), sendWebPush(app, webSubs, payload)]);
        await app.prisma.notificationLog.update({
          where: { id: row.id },
          data: { status: "SENT", sentAt: new Date() },
        });
      } catch (err) {
        await app.prisma.notificationLog.update({
          where: { id: row.id },
          data: { status: "FAILED", lastError: err instanceof Error ? err.message : String(err) },
        });
        app.log.error({ err, notificationId: row.id }, "notification dispatch failed");
      }
    })
  );

  return rows.length;
}
