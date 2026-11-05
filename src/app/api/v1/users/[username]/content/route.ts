import { route, json, notFound } from "@/server/http";
import { getAuth, hasRole } from "@/server/auth/session";
import { db } from "@/server/db";
import { publicTrackWhere } from "@/server/modules/tracks/access";
import { findTracks } from "@/server/modules/tracks/queries";
import { playlistSummaryInclude, toPlaylistSummaries } from "@/server/modules/playlists/service";
import { albumInclude, toAlbum } from "@/server/modules/albums/service";
import { privacyOf, toPublicUser } from "@/server/modules/users/dto";

type Ctx = RouteContext<"/api/v1/users/[username]/content">;

/** A profile's public content: uploads, albums, playlists, top tracks, stats (privacy-aware). */
export const GET = route<Ctx>(async (req, ctx) => {
  const viewer = (await getAuth(req))?.user ?? null;
  const user = await db.user.findUnique({ where: { username: (await ctx.params).username.toLowerCase() } });
  if (!user || user.status === "BANNED") throw notFound("User");
  const isSelf = viewer?.id === user.id;
  const staff = viewer ? hasRole(viewer, "MODERATOR") : false;
  if (user.isPrivate && !isSelf && !staff) return json({ restricted: true });
  const privacy = privacyOf(user);

  const trackWhere = isSelf ? { ownerId: user.id, status: "READY" as const } : { ...publicTrackWhere, ownerId: user.id };
  const recentlyPlayed =
    privacy.showListening || isSelf
      ? db.playEvent
          .findMany({
            where: { userId: user.id, track: publicTrackWhere },
            orderBy: { playedAt: "desc" },
            take: 40,
            select: { trackId: true },
          })
          .then((ev) => [...new Set(ev.map((e) => e.trackId))].slice(0, 8))
          .then(async (ids) => {
            const rows = await findTracks({ id: { in: ids } }, viewer, { take: ids.length || 1 });
            return ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean);
          })
      : Promise.resolve(null);
  const [tracks, popular, albums, playlists, totals, followers, following, stats, recent] = await Promise.all([
    findTracks(trackWhere, viewer, { take: 50 }),
    findTracks(trackWhere, viewer, { orderBy: [{ playCount: "desc" }], take: 5 }),
    db.album.findMany({
      where: { ownerId: user.id, ...(isSelf ? {} : { visibility: "PUBLIC" }) },
      include: albumInclude,
      orderBy: { createdAt: "desc" },
    }),
    db.playlist
      .findMany({
        where: { ownerId: user.id, ...(isSelf ? {} : { visibility: "PUBLIC" }) },
        include: playlistSummaryInclude,
        orderBy: { updatedAt: "desc" },
        take: 50,
      })
      .then((r) => toPlaylistSummaries(r, viewer)),
    db.track.aggregate({ where: trackWhere, _sum: { playCount: true, likeCount: true }, _count: true }),
    privacy.showFollowing || isSelf
      ? db.follow.findMany({ where: { followingId: user.id }, include: { follower: true }, take: 60, orderBy: { createdAt: "desc" } })
      : Promise.resolve(null),
    privacy.showFollowing || isSelf
      ? db.follow.findMany({ where: { followerId: user.id }, include: { following: true }, take: 60, orderBy: { createdAt: "desc" } })
      : Promise.resolve(null),
    privacy.showStats || isSelf
      ? db.playEvent.aggregate({ where: { userId: user.id }, _sum: { msPlayed: true }, _count: true })
      : Promise.resolve(null),
    recentlyPlayed,
  ]);
  return json({
    recentlyPlayed: recent,
    restricted: false,
    tracks,
    popular,
    albums: albums.filter((a) => a._count.tracks > 0 || isSelf).map(toAlbum),
    playlists: playlists.filter((p) => p.trackCount > 0 || isSelf),
    totals: { tracks: totals._count, plays: totals._sum.playCount ?? 0, likes: totals._sum.likeCount ?? 0 },
    followers: followers?.map((f) => toPublicUser(f.follower)) ?? null,
    following: following?.map((f) => toPublicUser(f.following)) ?? null,
    listening: stats ? { minutes: Math.round((stats._sum.msPlayed ?? 0) / 60000), listens: stats._count } : null,
  });
});
