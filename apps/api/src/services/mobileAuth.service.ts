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
  return code;
}

/**
 * Redeems a code exactly once. The update is conditional on the row still being
 * unconsumed, so two concurrent exchanges cannot both succeed.
 */
export async function consumeMobileAuthCode(
  prisma: PrismaClient,
  code: string
): Promise<string | null> {
  const result = await prisma.mobileAuthCode.updateMany({
    where: { code, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });

  if (result.count === 0) return null;

  const record = await prisma.mobileAuthCode.findUnique({ where: { code } });
  return record?.userId ?? null;
}

/** Housekeeping so redeemed and stale codes do not accumulate indefinitely. */
export async function purgeExpiredAuthCodes(prisma: PrismaClient): Promise<number> {
  const { count } = await prisma.mobileAuthCode.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
