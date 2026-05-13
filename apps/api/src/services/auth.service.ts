import bcrypt from "bcryptjs";
import { google } from "googleapis";
import type { PrismaClient, Prisma } from "@testx/database";
import type { CurrentUser } from "@testx/shared";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

type UserWithProfile = Prisma.UserGetPayload<{ include: { evaluatorProfile: true } }>;

export function buildCurrentUser(user: UserWithProfile): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    evaluatorProfile: user.evaluatorProfile
      ? {
          id: user.evaluatorProfile.id,
          userId: user.evaluatorProfile.userId,
          dateOfBirth: user.evaluatorProfile.dateOfBirth.toISOString().split("T")[0]!,
          gender: user.evaluatorProfile.gender,
          country: user.evaluatorProfile.country,
          city: user.evaluatorProfile.city,
          balance: user.evaluatorProfile.balance,
          createdAt: user.evaluatorProfile.createdAt.toISOString(),
          updatedAt: user.evaluatorProfile.updatedAt.toISOString(),
        }
      : null,
  };
}

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:4000/auth/google/callback"
  );
}

export function getGoogleOAuthUrl(): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: ["profile", "email"],
    prompt: "select_account",
  });
}

export async function handleGoogleCallback(prisma: PrismaClient, code: string): Promise<CurrentUser> {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();

  if (!data.id || !data.email) {
    throw new Error("Google account missing required fields");
  }

  // Try by googleId first, then link to existing email account, or create new
  let user = await prisma.user.findUnique({
    where: { googleId: data.id },
    include: { evaluatorProfile: true },
  });

  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email: data.email } });
    if (byEmail) {
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: { googleId: data.id, isVerified: true },
        include: { evaluatorProfile: true },
      });
    } else {
      user = await prisma.user.create({
        data: { email: data.email, googleId: data.id, role: "EVALUATOR", isVerified: true },
        include: { evaluatorProfile: true },
      });
    }
  }

  return buildCurrentUser(user);
}
