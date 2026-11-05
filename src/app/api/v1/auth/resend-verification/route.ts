import { route, json } from "@/server/http";
import { rateLimit } from "@/server/security/rate-limit";
import { requireAuth } from "@/server/auth/session";
import { resendVerification } from "@/server/modules/auth/service";

export const POST = route(async (req) => {
  const { user } = await requireAuth(req);
  rateLimit(`resend-verify:${user.id}`, 3, 60 * 60 * 1000);
  await resendVerification(user.id);
  return json({ ok: true });
});
