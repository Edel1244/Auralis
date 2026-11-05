import { route, json, pagination, paged } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";

export const GET = route(async (req) => {
  const { user } = await requireAuth(req);
  const p = pagination(req, 30);
  const [items, total] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take }),
    db.notification.count({ where: { userId: user.id } }),
  ]);
  return json(paged(items, total, p));
});

/** Marks all (or the given) notifications as read. */
export const PATCH = route(async (req) => {
  const { user } = await requireAuth(req);
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return json({ ok: true });
});
