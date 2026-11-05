import { route, json, pagination, paged } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";
import { trackInclude } from "@/server/modules/tracks/dto";
import { serializeTracks } from "@/server/modules/tracks/queries";
import { listableTrackWhere } from "@/server/modules/tracks/access";

/** Liked tracks (Favorites), most recent first. */
export const GET = route(async (req) => {
  const { user } = await requireAuth(req);
  const p = pagination(req, 50);
  const where = { userId: user.id, track: listableTrackWhere(user) };
  const [likes, total] = await Promise.all([
    db.trackLike.findMany({ where, include: { track: { include: trackInclude } }, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take }),
    db.trackLike.count({ where }),
  ]);
  const items = await serializeTracks(likes.map((l) => l.track), user);
  return json(paged(items.map((t, i) => ({ ...t, likedAt: likes[i].createdAt })), total, p));
});
