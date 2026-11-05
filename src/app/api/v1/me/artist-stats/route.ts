import { route, json } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";
import { trackInclude } from "@/server/modules/tracks/dto";
import { serializeTracks } from "@/server/modules/tracks/queries";

const DAY = 24 * 3600 * 1000;

/**
 * Creator analytics for the signed-in user's uploads. Only aggregates are
 * exposed — never who listened — so listener privacy is preserved.
 * The artist's own listens are excluded.
 */
export const GET = route(async (req) => {
  const { user } = await requireAuth(req);
  const since = new Date(Date.now() - 30 * DAY);
  const mine = { track: { ownerId: user.id }, userId: { not: user.id } };
  const [totals, followers, newFollowers, playlistAdds, comments, plays30, completed30, listeners, daily, top] = await Promise.all([
    db.track.aggregate({ where: { ownerId: user.id }, _sum: { playCount: true, likeCount: true }, _count: true }),
    db.follow.count({ where: { followingId: user.id } }),
    db.follow.count({ where: { followingId: user.id, createdAt: { gte: since } } }),
    db.playlistTrack.count({ where: { track: { ownerId: user.id }, playlist: { ownerId: { not: user.id } } } }),
    db.comment.count({ where: { track: { ownerId: user.id }, deletedAt: null } }),
    db.playEvent.count({ where: { ...mine, playedAt: { gte: since } } }),
    db.playEvent.count({ where: { ...mine, playedAt: { gte: since }, completed: true } }),
    db.playEvent.groupBy({ by: ["userId"], where: { ...mine, playedAt: { gte: since } } }).then((r) => r.length),
    db.$queryRaw<{ day: Date; n: bigint; ms: bigint }[]>`
      SELECT date_trunc('day', pe."playedAt") AS day, COUNT(*) AS n, COALESCE(SUM(pe."msPlayed"),0)::bigint AS ms
      FROM "PlayEvent" pe JOIN "Track" t ON t.id = pe."trackId"
      WHERE t."ownerId" = ${user.id} AND pe."userId" <> ${user.id} AND pe."playedAt" >= ${since}
      GROUP BY 1 ORDER BY 1`,
    db.playEvent.groupBy({
      by: ["trackId"],
      where: { ...mine, playedAt: { gte: since } },
      _count: { trackId: true },
      orderBy: { _count: { trackId: "desc" } },
      take: 10,
    }),
  ]);
  const map = new Map(daily.map((d) => [new Date(d.day).toISOString().slice(0, 10), { plays: Number(d.n), minutes: Math.round(Number(d.ms) / 60000) }]));
  const series = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(Date.now() - (29 - i) * DAY).toISOString().slice(0, 10);
    return { day, ...(map.get(day) ?? { plays: 0, minutes: 0 }) };
  });
  const topRows = await db.track.findMany({ where: { id: { in: top.map((t) => t.trackId) } }, include: trackInclude });
  const topTracks = await serializeTracks(top.map((t) => topRows.find((r) => r.id === t.trackId)!).filter(Boolean), user);
  return json({
    totals: {
      tracks: totals._count,
      plays: totals._sum.playCount ?? 0,
      likes: totals._sum.likeCount ?? 0,
      followers,
      playlistAdds,
      comments,
    },
    last30: { plays: plays30, listeners, newFollowers, completionRate: plays30 ? completed30 / plays30 : null },
    daily: series,
    topTracks: topTracks.map((t, i) => ({ track: t, plays30: top[i]?._count.trackId ?? 0 })),
    storage: { used: Number(user.storageUsedBytes), quota: Number(user.storageQuotaBytes) },
  });
});
