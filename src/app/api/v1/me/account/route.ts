import { z } from "zod";
import { route, json, readJson, ApiError } from "@/server/http";
import { requireAuth, clearSessionCookie } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import { emailSchema, passwordSchema } from "@/lib/validation";
import { changePassword } from "@/server/modules/auth/service";
import { verifyPassword } from "@/server/auth/password";
import { issueToken } from "@/server/auth/tokens";
import { sendVerificationEmail } from "@/server/mail";
import { db } from "@/server/db";
import { toMe } from "@/server/modules/users/dto";
import { deleteUserData } from "@/server/modules/users/delete";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("password"), currentPassword: z.string().min(1), newPassword: passwordSchema }),
  z.object({ action: z.literal("email"), currentPassword: z.string().min(1), email: emailSchema }),
]);

export const PATCH = route(async (req) => {
  const { user, sessionId } = await requireAuth(req);
  rateLimit(`account:${user.id}`, 10, 60 * 60 * 1000);
  const input = await readJson(req, schema);
  if (input.action === "password") {
    await changePassword(user.id, input.currentPassword, input.newPassword, sessionId);
    return json({ ok: true });
  }
  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new ApiError("VALIDATION", "Current password is incorrect", [{ path: "currentPassword", message: "Incorrect" }]);
  }
  if (await db.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
    throw new ApiError("CONFLICT", "An account with this email already exists", { field: "email" });
  }
  const updated = await db.user.update({ where: { id: user.id }, data: { email: input.email, emailVerifiedAt: null } });
  const token = await issueToken(user.id, "EMAIL_VERIFY");
  await sendVerificationEmail(updated.email, updated.displayName, token);
  return json({ user: toMe(updated) });
});

/** Permanently deletes the account and all owned content (requires password). */
export const DELETE = route(async (req) => {
  const { user } = await requireAuth(req);
  const { password } = await readJson(req, z.object({ password: z.string().min(1) }));
  if (!(await verifyPassword(user.passwordHash, password))) {
    throw new ApiError("VALIDATION", "Password is incorrect", [{ path: "password", message: "Incorrect" }]);
  }
  await deleteUserData(user.id);
  const res = json({ ok: true });
  clearSessionCookie(res);
  return res;
});
