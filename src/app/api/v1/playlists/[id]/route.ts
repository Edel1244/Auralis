import { route, json, readJson, forbidden } from "@/server/http";
import { getAuth, requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";
import {
  canEditPlaylist, getPlaylistFor, playlistSummaryInclude, playlistUpdateSchema, toPlaylistSummaries,
} from "@/server/modules/playlists/service";
import { trackInclude } from "@/server/modules/tracks/dto";
import { serializeTracks } from "@/server/modules/tracks/queries";
import { canViewTrack } from "@/server/modules/tracks/access";
import { toUserRef } from "@/server/modules/users/dto";
import { deleteObjectQuietly } from "@/server/media/images";

type Ctx = RouteContext<"/api/v1/playlists/[id]">;

export const GET = route<Ctx>(async (req, ctx) => {
  const viewer = (await getAuth(req))?.user;
  const p = await getPlaylistFor((await ctx.params).id, viewer);
  const [row, entries, collaborators] = await Promise.all([
    db.playlist.findUniqueOrThrow({ where: { id: p.id }, include: playlistSummaryInclude }),
    db.playlistTrack.findMany({
      where: { playlistId: p.id },
      orderBy: [{ position: "asc" }, { addedAt: "asc" }],
      include: { track: { include: trackInclude }, addedBy: { select: { id: true, username: true, displayName: true, avatarKey: true } } },
      take: 2000,
    }),
    db.playlistCollaborator.findMany({
      where: { playlistId: p.id },
      include: { user: { select: { id: true, username: true, displayName: true, avatarKey: true } } },
    }),
  ]);
  // Hide tracks the viewer may not see (e.g. a collaborator's private upload).
  const visible = entries.filter((e) => canViewTrack(e.track, viewer));
  const tracks = await serializeTracks(visible.map((e) => e.track), viewer);
  const [summary] = await toPlaylistSummaries([row], viewer);
  return json({
    playlist: { ...summary, canEdit: canEditPlaylist(p, viewer), smartRules: p.smartRules },
    entries: visible.map((e, i) => ({
      entryId: e.id,
      position: e.position,
      addedAt: e.addedAt,
      addedBy: e.addedBy ? toUserRef(e.addedBy) : null,
      track: tracks[i],
    })),
    collaborators: collaborators.map((c) => ({ ...toUserRef(c.user), role: c.role })),
  });
});

export const PATCH = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  const p = await getPlaylistFor((await ctx.params).id, user);
  const input = await readJson(req, playlistUpdateSchema);
  const ownerOnly = input.visibility !== undefined || input.isCollaborative !== undefined;
  if (ownerOnly ? p.ownerId !== user.id : !canEditPlaylist(p, user)) throw forbidden();
  const row = await db.playlist.update({ where: { id: p.id }, data: input, include: playlistSummaryInclude });
  const [playlist] = await toPlaylistSummaries([row], user);
  return json({ playlist });
});

export const DELETE = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  const p = await getPlaylistFor((await ctx.params).id, user);
  if (p.ownerId !== user.id && user.role !== "ADMIN") throw forbidden();
  await db.playlist.delete({ where: { id: p.id } });
  await deleteObjectQuietly(p.coverKey);
  return json({ ok: true });
});
