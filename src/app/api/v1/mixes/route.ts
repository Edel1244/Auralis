import { route, json, readJson, ApiError } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import { db } from "@/server/db";
import { mixSchema } from "@/server/modules/mixes/schema";

/** The user's saved studio sessions. */
export const GET = route(async (req) => {
  const { user } = await requireAuth(req);
  const items = await db.mix.findMany({ where: { ownerId: user.id }, orderBy: { updatedAt: "desc" }, take: 200 });
  return json({ items: items.map((m) => ({ id: m.id, title: m.title, updatedAt: m.updatedAt, data: m.data })) });
});

export const POST = route(async (req) => {
  const { user } = await requireAuth(req);
  rateLimit(`mix:${user.id}`, 60, 60 * 60 * 1000);
  const input = await readJson(req, mixSchema);
  if ((await db.mix.count({ where: { ownerId: user.id } })) >= 200) throw new ApiError("BAD_REQUEST", "Session limit reached (200)");
  const m = await db.mix.create({ data: { ownerId: user.id, title: input.title, data: input.data } });
  return json({ mix: { id: m.id, title: m.title, updatedAt: m.updatedAt, data: m.data } }, { status: 201 });
});
