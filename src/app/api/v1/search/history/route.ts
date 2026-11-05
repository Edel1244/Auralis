import { route, json } from "@/server/http";
import { getAuth, requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";
import { trendingSearches } from "@/server/modules/search/service";

/** Recent searches for the signed-in user + instance-wide trending searches. */
export const GET = route(async (req) => {
  const viewer = (await getAuth(req))?.user;
  const [recent, trending] = await Promise.all([
    viewer
      ? db.searchQuery.findMany({ where: { userId: viewer.id }, orderBy: { createdAt: "desc" }, take: 40, select: { query: true } })
      : Promise.resolve([]),
    trendingSearches(10),
  ]);
  const seen = new Set<string>();
  const unique = recent.filter((r) => (seen.has(r.query) ? false : (seen.add(r.query), true))).slice(0, 10);
  return json({ recent: unique.map((r) => r.query), trending });
});

export const DELETE = route(async (req) => {
  const { user } = await requireAuth(req);
  // Keep anonymized rows for trending stats; detach them from the user.
  await db.searchQuery.updateMany({ where: { userId: user.id }, data: { userId: null } });
  return json({ ok: true });
});
