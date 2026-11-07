import "server-only";
import type { Playlist, PlaylistCollaborator, Prisma, User } from "@prisma/client";
import { z } from "zod";
import { db } from "../../db";
import { forbidden, notFound } from "../../http";
import { hasRole } from "../../auth/session";
import { mediaUrl, toUserRef } from "../users/dto";
import { visibilitySchema } from "@/lib/validation";

type Viewer = Pick<User, "id" | "role"> | null | undefined;
type PlaylistAccess = Playlist & { collaborators: Pick<PlaylistCollaborator, "userId" | "role">[] };

export const playlistCreateSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
  visibility: visibilitySchema.optional(),
});

export const playlistUpdateSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  visibility: visibilitySchema.optional(),
  isCollaborative: z.boolean().optional(),
  background: z
    .string()
    .regex(/^(#[0-9a-fA-F]{6}|gradient:[a-z0-9-]{1,30})$/, "Invalid background")
    .nullable()
    .optional(),
  folder: z.string().trim().max(60).nullable().optional(),
});

export function canViewPlaylist(p: PlaylistAccess, viewer: Viewer) {
  if (p.visibility !== "PRIVATE") return true;
  if (!viewer) return false;
  return p.ownerId === viewer.id || p.collaborators.some((c) => c.userId === viewer.id) || hasRole(viewer, "MODERATOR");
}

/** Owner always; collaborators with EDITOR role on collaborative playlists. */
export function canEditPlaylist(p: PlaylistAccess, viewer: Viewer) {
  if (!viewer) return false;
  if (p.ownerId === viewer.id) return true;
  return p.isCollaborative && p.collaborators.some((c) => c.userId === viewer.id && c.role === "EDITOR");
}

export async function getPlaylistFor(id: string, viewer: Viewer) {
  const p = await db.playlist.findUnique({ where: { id }, include: { collaborators: { select: { userId: true, role: true } } } });
  if (!p || !canViewPlaylist(p, viewer)) throw notFound("Playlist");
  return p;
}

export async function getEditablePlaylist(id: string, viewer: Viewer) {
  const p = await getPlaylistFor(id, viewer);
  if (!canEditPlaylist(p, viewer)) throw forbidden("You cannot edit this playlist");
  return p;
}

export const playlistSummaryInclude = {
  owner: { select: { id: true, username: true, displayName: true, avatarKey: true } },
  _count: { select: { tracks: true, followers: true } },
} satisfies Prisma.PlaylistInclude;

type PlaylistSummaryRow = Prisma.PlaylistGetPayload<{ include: typeof playlistSummaryInclude }>;

/** Tracks whose artwork may appear in a playlist's cover mosaic for this viewer. */
function mosaicTrackWhere(viewer: Viewer): Prisma.TrackWhereInput {
  const visible: Prisma.TrackWhereInput = { status: "READY", visibility: { not: "PRIVATE" } };
  return viewer ? { OR: [visible, { ownerId: viewer.id, status: "READY" }] } : visible;
}

/** Adds derived fields (cover mosaic, total duration) to playlist rows in batch. */
export async function toPlaylistSummaries(rows: PlaylistSummaryRow[], viewer: Viewer) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [entries, durations, follows] = await Promise.all([
    // Per playlist, so one long playlist can't crowd the others out; only covers the viewer may see.
    Promise.all(
      ids.map((playlistId) =>
        db.playlistTrack.findMany({
          where: { playlistId, track: mosaicTrackWhere(viewer) },
          orderBy: { position: "asc" },
          select: { playlistId: true, track: { select: { coverKey: true, album: { select: { coverKey: true } } } } },
          take: 12,
        }),
      ),
    ).then((lists) => lists.flat()),
    db.$queryRaw<{ playlistId: string; ms: bigint }[]>`
      SELECT pt."playlistId", COALESCE(SUM(t."durationMs"),0)::bigint AS ms
      FROM "PlaylistTrack" pt JOIN "Track" t ON t.id = pt."trackId"
      WHERE pt."playlistId" = ANY(${ids}) GROUP BY pt."playlistId"`,
    viewer
      ? db.playlistFollow.findMany({ where: { userId: viewer.id, playlistId: { in: ids } }, select: { playlistId: true } })
      : Promise.resolve([]),
  ]);
  const mosaic = new Map<string, string[]>();
  for (const e of entries) {
    const key = e.track.coverKey ?? e.track.album?.coverKey;
    if (!key) continue;
    const list = mosaic.get(e.playlistId) ?? [];
    const url = mediaUrl(key)!;
    if (list.length < 4 && !list.includes(url)) list.push(url);
    mosaic.set(e.playlistId, list);
  }
  const dur = new Map(durations.map((d) => [d.playlistId, Number(d.ms)]));
  const followed = new Set(follows.map((f) => f.playlistId));
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    coverUrl: mediaUrl(p.coverKey),
    background: p.background,
    visibility: p.visibility,
    isCollaborative: p.isCollaborative,
    kind: p.kind,
    folder: p.folder,
    owner: toUserRef(p.owner),
    trackCount: p._count.tracks,
    followerCount: p._count.followers,
    durationMs: dur.get(p.id) ?? 0,
    coverMosaic: (() => {
      const m = mosaic.get(p.id) ?? [];
      return m.length >= 4 ? m : m.slice(0, 1);
    })(),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    isOwner: viewer?.id === p.ownerId,
    following: followed.has(p.id),
  }));
}

/** Renumbers positions 0..n-1 after removals/reorders. */
export async function compactPositions(playlistId: string) {
  const entries = await db.playlistTrack.findMany({ where: { playlistId }, orderBy: [{ position: "asc" }, { addedAt: "asc" }], select: { id: true, position: true } });
  const updates = entries.map((e, i) => (e.position === i ? null : db.playlistTrack.update({ where: { id: e.id }, data: { position: i } }))).filter(Boolean);
  if (updates.length) await db.$transaction(updates as Prisma.PrismaPromise<unknown>[]);
}
