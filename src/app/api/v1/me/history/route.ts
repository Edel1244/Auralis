import { route, json, pagination, paged } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";
import { trackInclude } from "@/server/modules/tracks/dto";
import { serializeTracks } from "@/server/modules/tracks/queries";
import { listableTrackWhere } from "@/server/modules/tracks/access";

/** Full listening history (every recorded listen), newest first. */
export const GET = route(async (req) => {
  const { user } = await requireAuth(req);
  const p = pagination(req, 50);
  const where = { userId: user.id, track: listableTrackWhere(user) };
  const [events, total] = await Promise.all([
    db.playEvent.findMany({ where, include: { track: { include: trackInclude } }, orderBy: { playedAt: "desc" }, skip: p.skip, take: p.take }),
    db.playEvent.count({ where }),
  ]);
  const tracks = await serializeTracks(events.map((e) => e.track), user);
  return json(
    paged(
      events.map((e, i) => ({ id: e.id, playedAt: e.playedAt, msPlayed: e.msPlayed, completed: e.completed, track: tracks[i] })),
      total,
      p,
    ),
  );
});

/** Clears listening history. */
export const DELETE = route(async (req) => {
  const { user } = await requireAuth(req);
  await db.playEvent.deleteMany({ where: { userId: user.id } });
  return json({ ok: true });
});
