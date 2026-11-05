import { route, json, readJson, forbidden } from "@/server/http";
import { getAuth, requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";
import { canEditTrack } from "@/server/modules/tracks/access";
import { getViewableTrack, serializeTracks } from "@/server/modules/tracks/queries";
import { deleteTrack, trackUpdateSchema } from "@/server/modules/tracks/service";
import { trackInclude } from "@/server/modules/tracks/dto";
import { logModeration } from "@/server/modules/moderation/audit";

type Ctx = RouteContext<"/api/v1/tracks/[id]">;

export const GET = route<Ctx>(async (req, ctx) => {
  const viewer = (await getAuth(req))?.user;
  const t = await getViewableTrack((await ctx.params).id, viewer);
  const [track] = await serializeTracks([t], viewer);
  return json({ track, canEdit: canEditTrack(t, viewer) });
});

export const PATCH = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  const t = await getViewableTrack((await ctx.params).id, user);
  if (!canEditTrack(t, user)) throw forbidden();
  const input = await readJson(req, trackUpdateSchema);
  if (input.albumId) {
    const album = await db.album.findUnique({ where: { id: input.albumId }, select: { ownerId: true } });
    if (!album || album.ownerId !== t.ownerId) throw forbidden("Album belongs to another user");
  }
  const updated = await db.track.update({ where: { id: t.id }, data: input, include: trackInclude });
  if (user.id !== t.ownerId) await logModeration(user.id, "track.edit", "TRACK", t.id, "", { fields: Object.keys(input) });
  const [track] = await serializeTracks([updated], user);
  return json({ track });
});

export const DELETE = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  const t = await getViewableTrack((await ctx.params).id, user);
  // Owners delete their own uploads; staff use moderation removal (keeps an audit trail).
  if (t.ownerId !== user.id && user.role !== "ADMIN") throw forbidden();
  await deleteTrack(t.id);
  if (user.id !== t.ownerId) await logModeration(user.id, "track.delete", "TRACK", t.id, "", { title: t.title });
  return json({ ok: true });
});
