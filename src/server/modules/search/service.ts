import "server-only";
import type { Prisma, User } from "@prisma/client";
import { db } from "../../db";
import { publicTrackWhere } from "../tracks/access";
import { findTracks } from "../tracks/queries";
import { toGenre } from "../tracks/dto";
import { playlistSummaryInclude, toPlaylistSummaries } from "../playlists/service";
import { albumInclude, publicAlbumWhere, toAlbum } from "../albums/service";
import { toPublicUser } from "../users/dto";

type Viewer = Pick<User, "id" | "role"> | null | undefined;

export type SearchFilters = {
  genre?: string;
  year?: number;
  duration?: "short" | "medium" | "long";
};

const ci = (q: string) => ({ contains: q, mode: "insensitive" as const });

/**
 * Search across the catalog with case-insensitive substring matching. Results
 * are ranked by popularity. For very large instances this module is the place
 * to swap in Postgres full-text (tsvector) or a dedicated engine (Meilisearch).
 */
export function trackSearchWhere(q: string, f: SearchFilters): Prisma.TrackWhereInput {
  const and: Prisma.TrackWhereInput[] = [publicTrackWhere];
  if (q) {
    and.push({
      OR: [
        { title: ci(q) },
        { artistName: ci(q) },
        { album: { title: ci(q) } },
        { tags: { has: q.toLowerCase() } },
        { genre: { name: ci(q) } },
      ],
    });
  }
  if (f.genre) and.push({ genre: { slug: f.genre } });
  if (f.year) and.push({ releaseDate: { gte: new Date(Date.UTC(f.year, 0, 1)), lt: new Date(Date.UTC(f.year + 1, 0, 1)) } });
  if (f.duration === "short") and.push({ durationMs: { lt: 180_000 } });
  if (f.duration === "medium") and.push({ durationMs: { gte: 180_000, lte: 360_000 } });
  if (f.duration === "long") and.push({ durationMs: { gt: 360_000 } });
  return { AND: and };
}

export async function searchAll(q: string, f: SearchFilters, viewer: Viewer, limit = 8) {
  const [tracks, artists, albums, playlists, users, genres] = await Promise.all([
    searchTracks(q, f, viewer, 0, limit),
    searchArtists(q, viewer, 0, 6),
    searchAlbums(q, 0, 6),
    searchPlaylists(q, viewer, 0, 6),
    searchUsers(q, 0, 6),
    q ? db.genre.findMany({ where: { active: true, name: ci(q) }, take: 6 }) : Promise.resolve([]),
  ]);
  return { tracks, artists, albums, playlists, users, genres: genres.map((g) => toGenre(g)!) };
}

export function searchTracks(q: string, f: SearchFilters, viewer: Viewer, skip: number, take: number) {
  return findTracks(trackSearchWhere(q, f), viewer, {
    orderBy: [{ playCount: "desc" }, { likeCount: "desc" }, { createdAt: "desc" }],
    skip,
    take,
  });
}

/** Artists = profiles that publish public music. */
export async function searchArtists(q: string, _viewer: Viewer, skip: number, take: number) {
  const users = await db.user.findMany({
    where: {
      status: { not: "BANNED" },
      isPrivate: false,
      tracks: { some: { ...publicTrackWhere, ...(q ? {} : {}) } },
      ...(q
        ? { OR: [{ displayName: ci(q) }, { username: ci(q) }, { tracks: { some: { ...publicTrackWhere, artistName: ci(q) } } }] }
        : {}),
    },
    orderBy: { followers: { _count: "desc" } },
    skip,
    take,
    include: { _count: { select: { followers: true, tracks: { where: publicTrackWhere } } } },
  });
  return users.map((u) => ({ ...toPublicUser(u), followerCount: u._count.followers, trackCount: u._count.tracks }));
}

export async function searchUsers(q: string, skip: number, take: number) {
  if (!q) return [];
  const users = await db.user.findMany({
    where: { status: { not: "BANNED" }, OR: [{ displayName: ci(q) }, { username: ci(q) }] },
    orderBy: { followers: { _count: "desc" } },
    skip,
    take,
    include: { _count: { select: { followers: true } } },
  });
  return users.map((u) => ({ ...toPublicUser(u), followerCount: u._count.followers }));
}

export async function searchAlbums(q: string, skip: number, take: number) {
  const rows = await db.album.findMany({
    where: { AND: [publicAlbumWhere, q ? { OR: [{ title: ci(q) }, { artistName: ci(q) }] } : {}] },
    include: albumInclude,
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
  return rows.map(toAlbum);
}

export async function searchPlaylists(q: string, viewer: Viewer, skip: number, take: number) {
  const rows = await db.playlist.findMany({
    where: {
      visibility: "PUBLIC",
      tracks: { some: {} },
      owner: { status: { not: "BANNED" } },
      ...(q ? { OR: [{ title: ci(q) }, { description: ci(q) }] } : {}),
    },
    include: playlistSummaryInclude,
    orderBy: { followers: { _count: "desc" } },
    skip,
    take,
  });
  return toPlaylistSummaries(rows, viewer);
}

export async function recordSearch(query: string, userId: string | null) {
  const q = query.trim().toLowerCase().slice(0, 100);
  if (q.length < 2) return;
  await db.searchQuery.create({ data: { query: q, userId } }).catch(() => {});
}

export async function trendingSearches(limit = 10) {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const rows = await db.searchQuery.groupBy({
    by: ["query"],
    where: { createdAt: { gte: since } },
    _count: { query: true },
    orderBy: { _count: { query: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({ query: r.query, count: r._count.query }));
}
