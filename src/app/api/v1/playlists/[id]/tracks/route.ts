import { z } from "zod";
import { route, json, readJson, ApiError } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import { db } from "@/server/db";
import { compactPositions, getEditablePlaylist } from "@/server/modules/playlists/service";
import { canViewTrack } from "@/server/modules/tracks/access";
import { notify } from "@/server/modules/notifications/notify";

type Ctx = RouteContext<"/api/v1/playlists/[id]/tracks">;
const MAX_TRACKS = 2000;

/** Adds tracks (skipping ones already present). */
export const POST = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  rateLimit(`playlist-edit:${user.id}`, 600, 60 * 60 * 1000);
  const p = await getEditablePlaylist((await ctx.params).id, user);
  const { trackIds } = await readJson(req, z.object({ trackIds: z.array(z.string().max(40)).min(1).max(500) }));
  const [tracks, existing, count] = await Promise.all([
    db.track.findMany({ where: { id: { in: trackIds } }, select: { id: true, ownerId: true, visibility: true, status: true } }),
    db.playlistTrack.findMany({ where: { playlistId: p.id, trackId: { in: trackIds } }, select: { trackId: true } }),
    db.playlistTrack.count({ where: { playlistId: p.id } }),
  ]);
  const have = new Set(existing.map((e) => e.trackId));
  const allowed = new Map(tracks.filter((t) => canViewTrack(t, user)).map((t) => [t.id, t]));
  const toAdd = [...new Set(trackIds)].filter((id) => allowed.has(id) && !have.has(id));
  if (count + toAdd.length > MAX_TRACKS) throw new ApiError("BAD_REQUEST", `Playlists can hold up to ${MAX_TRACKS} tracks`);
  if (toAdd.length) {
    await db.$transaction([
      db.playlistTrack.createMany({
        data: toAdd.map((trackId, i) => ({ playlistId: p.id, trackId, position: count + i, addedById: user.id })),
      }),
      db.playlist.update({ where: { id: p.id }, data: { updatedAt: new Date() } }),
    ]);
    if (p.ownerId !== user.id) {
      await notify(p.ownerId, "playlist_invite", { playlistId: p.id, title: p.title, username: user.username, added: toAdd.length });
    }
  }
  return json({ added: toAdd.length });
});

/** Removes playlist entries by entry id. */
export const DELETE = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  const p = await getEditablePlaylist((await ctx.params).id, user);
  const { entryIds } = await readJson(req, z.object({ entryIds: z.array(z.string().max(40)).min(1).max(500) }));
  const r = await db.playlistTrack.deleteMany({ where: { playlistId: p.id, id: { in: entryIds } } });
  await compactPositions(p.id);
  await db.playlist.update({ where: { id: p.id }, data: { updatedAt: new Date() } });
  return json({ removed: r.count });
});

/** Replaces the full order: entryIds must list every entry exactly once. */
export const PUT = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  const p = await getEditablePlaylist((await ctx.params).id, user);
  const { entryIds } = await readJson(req, z.object({ entryIds: z.array(z.string().max(40)).max(MAX_TRACKS) }));
  const current = await db.playlistTrack.findMany({ where: { playlistId: p.id }, select: { id: true } });
  const set = new Set(current.map((c) => c.id));
  if (entryIds.length !== set.size || new Set(entryIds).size !== entryIds.length || !entryIds.every((id) => set.has(id))) {
    throw new ApiError("CONFLICT", "The playlist changed; reload and try again");
  }
  await db.$transaction(entryIds.map((id, position) => db.playlistTrack.update({ where: { id }, data: { position } })));
  await db.playlist.update({ where: { id: p.id }, data: { updatedAt: new Date() } });
  return json({ ok: true });
});
