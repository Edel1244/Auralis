import { route, json } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";

/** All liked track ids (for rendering heart state across the app). */
export const GET = route(async (req) => {
  const { user } = await requireAuth(req);
  const likes = await db.trackLike.findMany({ where: { userId: user.id }, select: { trackId: true }, take: 10000 });
  return json({ ids: likes.map((l) => l.trackId) });
});
