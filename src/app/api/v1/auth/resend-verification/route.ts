import { route, json } from "@/server/http";
import { rateLimit } from "@/server/security/rate-limit";
import { requireAuth } from "@/server/auth/session";
import { resendVerification } from "@/server/modules/auth/service";
import { devMailboxEnabled, emailDeliveryMode } from "@/server/mail";

export const POST = route(async (req) => {
  const { user } = await requireAuth(req);
  rateLimit(`resend-verify:${user.id}`, 3, 60 * 60 * 1000);
  await resendVerification(user.id);
  // Tell the client whether a real email went out, so it never claims "sent" when it wasn't.
  return json({ ok: true, delivery: emailDeliveryMode(), devMailbox: devMailboxEnabled() });
});
