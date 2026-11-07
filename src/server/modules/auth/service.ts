import "server-only";
import type { z } from "zod";
import { db } from "../../db";
import { env } from "../../env";
import { ApiError } from "../../http";
import { logger } from "../../logger";
import { dummyHash, hashPassword, verifyPassword } from "../../auth/password";
import { consumeToken, issueToken } from "../../auth/tokens";
import { sendPasswordResetEmail, sendVerificationEmail } from "../../mail";
import type { loginSchema, registerSchema } from "@/lib/validation";

export async function registerUser(input: z.infer<typeof registerSchema>, locale: string) {
  const existing = await db.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
    select: { email: true, username: true },
  });
  if (existing) {
    // Distinguishing is acceptable here: both values are public-ish and the UI needs to tell the user.
    throw new ApiError(
      "CONFLICT",
      existing.username === input.username ? "That username is taken" : "An account with this email already exists",
      { field: existing.username === input.username ? "username" : "email" },
    );
  }
  // Admin bootstrap. With BOOTSTRAP_ADMIN_EMAIL set (recommended for public servers),
  // nobody becomes admin at sign-up: that address is promoted only once its email is
  // verified (see promoteBootstrapAdmin). Without it, the first account becomes admin,
  // which is convenient locally but racy on an Internet-facing instance.
  const bootstrapEmail = env().BOOTSTRAP_ADMIN_EMAIL;
  const isFirstUser = !bootstrapEmail && (await db.user.count()) === 0;
  const user = await db.user.create({
    data: {
      email: input.email,
      username: input.username,
      displayName: input.displayName,
      passwordHash: await hashPassword(input.password),
      locale,
      storageQuotaBytes: BigInt(env().DEFAULT_STORAGE_QUOTA_MB) * 1024n * 1024n,
      // The first account on a fresh instance becomes its administrator.
      role: isFirstUser ? "ADMIN" : "USER",
      preference: { create: {} },
    },
  });
  if (isFirstUser) logger.info("first_user_promoted_to_admin", { userId: user.id });
  const token = await issueToken(user.id, "EMAIL_VERIFY");
  await sendVerificationEmail(user.email, user.displayName, token).catch((e) =>
    logger.error("verification_mail_failed", { error: String(e) }),
  );
  return user;
}

export async function authenticate(input: z.infer<typeof loginSchema>) {
  const user = await db.user.findFirst({
    where: input.identifier.includes("@") ? { email: input.identifier } : { username: input.identifier },
  });
  if (!user) {
    await verifyPassword(await dummyHash(), input.password); // equalize timing
    throw new ApiError("UNAUTHENTICATED", "Incorrect email/username or password");
  }
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) throw new ApiError("UNAUTHENTICATED", "Incorrect email/username or password");
  if (user.status === "BANNED") throw new ApiError("SUSPENDED", "This account has been banned");
  return user;
}

/**
 * Promotes the account whose verified email matches BOOTSTRAP_ADMIN_EMAIL to ADMIN,
 * but only while the instance has no administrator yet. Proving control of the inbox
 * (verification link or password reset) is required, so knowing the address isn't enough.
 */
async function promoteBootstrapAdmin(userId: string) {
  const bootstrapEmail = env().BOOTSTRAP_ADMIN_EMAIL;
  if (!bootstrapEmail) return;
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, role: true, emailVerifiedAt: true } });
  if (!user || user.role === "ADMIN" || !user.emailVerifiedAt || user.email !== bootstrapEmail) return;
  if ((await db.user.count({ where: { role: "ADMIN" } })) > 0) return;
  await db.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
  logger.info("bootstrap_admin_promoted", { userId });
}

export async function verifyEmail(token: string) {
  const userId = await consumeToken(token, "EMAIL_VERIFY");
  if (!userId) throw new ApiError("BAD_REQUEST", "This verification link is invalid or has expired");
  await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  await promoteBootstrapAdmin(userId);
}

export async function resendVerification(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.emailVerifiedAt) return;
  const token = await issueToken(user.id, "EMAIL_VERIFY");
  await sendVerificationEmail(user.email, user.displayName, token);
}

/** Always succeeds from the caller's perspective to avoid account enumeration. */
export async function requestPasswordReset(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.status === "BANNED") return;
  const token = await issueToken(user.id, "PASSWORD_RESET");
  await sendPasswordResetEmail(user.email, user.displayName, token).catch((e) =>
    logger.error("reset_mail_failed", { error: String(e) }),
  );
}

export async function resetPassword(token: string, password: string) {
  const userId = await consumeToken(token, "PASSWORD_RESET");
  if (!userId) throw new ApiError("BAD_REQUEST", "This reset link is invalid or has expired");
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      // Possessing the reset link proves control of the inbox.
      data: { passwordHash: await hashPassword(password), emailVerifiedAt: new Date() },
    }),
    db.session.deleteMany({ where: { userId } }), // sign out everywhere
  ]);
  await promoteBootstrapAdmin(userId);
}

export async function changePassword(userId: string, current: string, next: string, keepSessionId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(user.passwordHash, current))) {
    throw new ApiError("VALIDATION", "Current password is incorrect", [{ path: "currentPassword", message: "Incorrect" }]);
  }
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } }),
    db.session.deleteMany({ where: { userId, id: { not: keepSessionId } } }),
  ]);
}
