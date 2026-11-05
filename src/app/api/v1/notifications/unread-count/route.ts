import { route, json } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";

export const GET = route(async (req) => {
  const { user } = await requireAuth(req);
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  return json({ unread }, { headers: { "cache-control": "no-store" } });
});
