import { route, json, notFound } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { devMailboxEnabled } from "@/server/mail";
import { readOutboxFor } from "@/server/mail-outbox";

/**
 * Development mailbox: the signed-in user's own outbox messages (verification
 * links etc.) while no SMTP server is configured. Returns 404 in production or
 * when real email delivery is set up, and never shows mail addressed to others.
 */
export const GET = route(async (req) => {
  if (!devMailboxEnabled()) throw notFound("Mailbox");
  const { user } = await requireAuth(req);
  return json({ items: await readOutboxFor(user.email, 20) }, { headers: { "cache-control": "no-store" } });
});
