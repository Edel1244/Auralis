import { route, json } from "@/server/http";
import { getAuth } from "@/server/auth/session";
import { db } from "@/server/db";
import { publicTrackWhere } from "@/server/modules/tracks/access";
import { findTracks, serializeTracks } from "@/server/modules/tracks/queries";
import { trackInclude, toGenre } from "@/server/modules/tracks/dto";
import { recommendTracks, trendingTracks } from "@/server/modules/recommendations/engine";
import { playlistSummaryInclude, toPlaylistSummaries } from "@/server/modules/playlists/service";
import { albumInclude, publicAlbumWhere, toAlbum } from "@/server/modules/albums/service";
import { toPublicUser } from "@/server/modules/users/dto";

/** Personalized discovery homepage, assembled in one request. */
export const GET = route(async (req) => {
  const viewer = (await getAuth(req))?.user ?? null;

  const recentlyPlayed = viewer
    ? (async () => {
        const events = await db.playEvent.findMany({
          where: { userId: viewer.id, track: { OR: [publicTrackWhere, { ownerId: viewer.id, status: "READY" }] } },
          orderBy: { playedAt: "desc" },
          take: 60,
          include: { track: { include: trackInclude } },
        });
        const seen = new Set<string>();
        const unique = events.filter((e) => (seen.has(e.trackId) ? false : (seen.add(e.trackId), true))).slice(0, 12);
        return serializeTracks(unique.map((e) => e.track), viewer);
      })()
    : Promise.resolve([]);

  const [recent, recommended, trending, newReleases, community, artists, genres, playlists, albums, total] = await Promise.all([
    recentlyPlayed,
    recommendTracks(viewer, 12),
    trendingTracks(viewer, 7, 12),
    findTracks({ ...publicTrackWhere, releaseDate: { not: null, lte: new Date() } }, viewer, {
      orderBy: [{ releaseDate: "desc" }, { createdAt: "desc" }],
      take: 12,
    }),
    // One recent upload per community member.
    db.track
      .findMany({ where: publicTrackWhere, orderBy: { createdAt: "desc" }, distinct: ["ownerId"], take: 12, include: trackInclude })
      .then((rows) => serializeTracks(rows, viewer)),
    db.user
      .findMany({
        where: {
          status: { not: "BANNED" },
          isPrivate: false,
          tracks: { some: publicTrackWhere },
          ...(viewer ? { id: { not: viewer.id }, followers: { none: { followerId: viewer.id } } } : {}),
        },
        orderBy: { followers: { _count: "desc" } },
        take: 10,
        include: { _count: { select: { followers: true, tracks: { where: publicTrackWhere } } } },
      })
      .then((us) => us.map((u) => ({ ...toPublicUser(u), followerCount: u._count.followers, trackCount: u._count.tracks }))),
    db.genre
      .findMany({ where: { active: true, tracks: { some: publicTrackWhere } }, include: { _count: { select: { tracks: { where: publicTrackWhere } } } } })
      .then((gs) => gs.sort((a, b) => b._count.tracks - a._count.tracks).map((g) => ({ ...toGenre(g)!, trackCount: g._count.tracks }))),
    db.playlist
      .findMany({
        where: { visibility: "PUBLIC", tracks: { some: {} }, owner: { status: { not: "BANNED" } } },
        include: playlistSummaryInclude,
        orderBy: [{ followers: { _count: "desc" } }, { updatedAt: "desc" }],
        take: 10,
      })
      .then((rows) => toPlaylistSummaries(rows, viewer)),
    db.album.findMany({ where: publicAlbumWhere, include: albumInclude, orderBy: { createdAt: "desc" }, take: 10 }).then((r) => r.map(toAlbum)),
    db.track.count({ where: publicTrackWhere }),
  ]);

  return json({
    totalPublicTracks: total,
    sections: {
      recentlyPlayed: recent,
      recommended,
      trending,
      newReleases,
      community,
      recommendedArtists: artists,
      genres,
      featuredPlaylists: playlists,
      albums,
    },
  });
});
