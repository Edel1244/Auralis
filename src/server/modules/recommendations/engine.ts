import "server-only";
import type { User } from "@prisma/client";
import { db } from "../../db";
import { publicTrackWhere } from "../tracks/access";
import { trackInclude } from "../tracks/dto";
import { serializeTracks } from "../tracks/queries";
import { buildProfile, diversify, rank } from "./scoring";

type Viewer = Pick<User, "id" | "role">;

/** Builds the listener profile from the last 90 days of listens + all likes. */
export async function listenerProfile(userId: string) {
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000);
  const [plays, likes] = await Promise.all([
    db.playEvent.findMany({
      where: { userId, playedAt: { gte: since } },
      select: { trackId: true, completed: true, track: { select: { ownerId: true, genreId: true, tags: true } } },
      orderBy: { playedAt: "desc" },
      take: 2000,
    }),
    db.trackLike.findMany({
      where: { userId },
      select: { trackId: true, track: { select: { ownerId: true, genreId: true, tags: true } } },
      take: 2000,
    }),
  ]);
  const events = [
    ...plays.map((p) => ({ trackId: p.trackId, ...p.track, weight: p.completed ? 1 : 0.5 })),
    ...likes.map((l) => ({ trackId: l.trackId, ...l.track, weight: 3 })),
  ];
  return { profile: buildProfile(events, likes.map((l) => l.trackId)), signalCount: events.length };
}

/** Personalized recommendations; falls back to popularity for new listeners. */
export async function recommendTracks(viewer: Viewer | null, limit = 20) {
  const candidates = await db.track.findMany({
    where: { ...publicTrackWhere, ...(viewer ? { ownerId: { not: viewer.id } } : {}) },
    select: { id: true, ownerId: true, genreId: true, tags: true, mood: true, playCount: true, likeCount: true, createdAt: true },
    orderBy: [{ playCount: "desc" }, { createdAt: "desc" }],
    take: 400,
  });
  const { profile } = viewer ? await listenerProfile(viewer.id) : { profile: buildProfile([], []) };
  const ranked = rank(candidates, profile);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const ordered = diversify(ranked.map((r) => byId.get(r.id)!), 2).slice(0, limit);
  const rows = await db.track.findMany({ where: { id: { in: ordered.map((o) => o.id) } }, include: trackInclude });
  const rowById = new Map(rows.map((r) => [r.id, r]));
  return serializeTracks(ordered.map((o) => rowById.get(o.id)!).filter(Boolean), viewer);
}

/** Tracks with the most counted listens in the window (trending). */
export async function trendingTracks(viewer: Viewer | null, days = 7, limit = 20) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const top = await db.playEvent.groupBy({
    by: ["trackId"],
    where: { playedAt: { gte: since }, track: publicTrackWhere },
    _count: { trackId: true },
    orderBy: { _count: { trackId: "desc" } },
    take: limit,
  });
  let ids = top.map((t) => t.trackId);
  if (ids.length < limit) {
    // Young instances: top up with all-time popular tracks.
    const more = await db.track.findMany({
      where: { ...publicTrackWhere, id: { notIn: ids } },
      orderBy: [{ playCount: "desc" }, { likeCount: "desc" }, { createdAt: "desc" }],
      select: { id: true },
      take: limit - ids.length,
    });
    ids = [...ids, ...more.map((m) => m.id)];
  }
  const rows = await db.track.findMany({ where: { id: { in: ids } }, include: trackInclude });
  const map = new Map(rows.map((r) => [r.id, r]));
  return serializeTracks(ids.map((id) => map.get(id)!).filter(Boolean), viewer);
}
