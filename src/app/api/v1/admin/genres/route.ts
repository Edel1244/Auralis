import { route, json, readJson } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { db } from "@/server/db";
import { logModeration } from "@/server/modules/moderation/audit";
import { genreSchema } from "@/server/modules/genres/schema";

/** All genres including inactive ones, with usage counts. */
export const GET = route(async (req) => {
  await requireRole(req, "ADMIN");
  const items = await db.genre.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { tracks: true } } } });
  return json({ items: items.map((g) => ({ id: g.id, name: g.name, slug: g.slug, color: g.color, active: g.active, trackCount: g._count.tracks })) });
});

export const POST = route(async (req) => {
  const { user } = await requireRole(req, "ADMIN");
  const input = await readJson(req, genreSchema);
  const g = await db.genre.create({ data: input });
  await logModeration(user.id, "genre.create", "GENRE", g.id, "", { name: g.name });
  return json({ genre: g }, { status: 201 });
});
