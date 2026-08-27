import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@testx/database";

/**
 * Deep-link codes are short-lived: the app redeems one immediately after the
 * browser hands control back, so anything longer only widens the replay window.
 */
const CODE_TTL_MS = 2 * 60 * 1000;

export function createAuthCodeValue(): string {
  return randomBytes(32).toString("base64url");
}

export async function issueMobileAuthCode(prisma: PrismaClient, userId: string): Promise<string> {
  const code = createAuthCodeValue();
  await prisma.mobileAuthCode.create({
    data: { code, userId, expiresAt: new Date(Date.now() + CODE_TTL_MS) },
  });

  // Opportunistic cleanup. Issuing is rare and already on a slow OAuth path, so
  // this is a natural place to sweep; it must not delay handing back the code.
  void purgeExpiredAuthCodes(prisma).catch(() => undefined);

  return code;
}

/**
 * Redeems a code exactly once. The update is conditional on the row still being
 * unconsumed, so two concurrent exchanges cannot both succeed.
 *
 * The read deliberately comes *before* the write. Marking consumed first and only
 * then reading the userId leaves a window where `purgeExpiredAuthCodes` can delete
 * the row in between - the code is burned and no token is ever issued, stranding a
 * user who did nothing wrong. Reading first cannot fail that way: if the row is
 * gone by the time the update runs, `count` is 0 and nothing was consumed.
 */
export async function consumeMobileAuthCode(
  prisma: PrismaClient,
  code: string
): Promise<string | null> {
  const record = await prisma.mobileAuthCode.findUnique({ where: { code } });
  if (!record) return null;

  const result = await prisma.mobileAuthCode.updateMany({
    where: { code, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });

  // Still the single point of truth for "was this redemption the winning one" - two
  // concurrent exchanges both read the row, but only one update matches an unconsumed
  // one, so exactly one caller gets a userId back.
  if (result.count === 0) return null;

  return record.userId;
}

/**
 * Housekeeping so redeemed and stale codes do not accumulate indefinitely.
 *
 * Both halves matter. Expiry alone left every redeemed code sitting until its TTL ran
 * out, and a redeemed code is dead the moment it is stamped - `consumeMobileAuthCode`
 * only ever matches on `consumedAt: null`, so keeping it buys nothing.
 *
 * Deleting a consumed row cannot strand a redemption in flight: the userId is read
 * before the row is stamped, so the caller already has what it needs by the time this
 * can see the row at all.
 */
export async function purgeExpiredAuthCodes(prisma: PrismaClient): Promise<number> {
  const { count } = await prisma.mobileAuthCode.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { consumedAt: { not: null } }],
    },
  });
  return count;
}
