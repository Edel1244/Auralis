import { route, json, readJson, forbidden } from "@/server/http";
import { getAuth, requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";
import { albumInclude, albumSchema, getAlbumFor, toAlbum } from "@/server/modules/albums/service";
import { findTracks } from "@/server/modules/tracks/queries";
import { listableTrackWhere } from "@/server/modules/tracks/access";
import { deleteObjectQuietly } from "@/server/media/images";

type Ctx = RouteContext<"/api/v1/albums/[id]">;

export const GET = route<Ctx>(async (req, ctx) => {
  const viewer = (await getAuth(req))?.user;
  const a = await getAlbumFor((await ctx.params).id, viewer);
  const tracks = await findTracks({ AND: [{ albumId: a.id }, listableTrackWhere(viewer)] }, viewer, {
    orderBy: [{ trackNumber: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 500,
  });
  const liked = viewer ? await db.albumLike.findUnique({ where: { userId_albumId: { userId: viewer.id, albumId: a.id } } }) : null;
  return json({ album: { ...toAlbum(a), liked: Boolean(liked), canEdit: viewer?.id === a.ownerId }, tracks });
});

export const PATCH = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  const a = await getAlbumFor((await ctx.params).id, user);
  if (a.ownerId !== user.id) throw forbidden();
  const input = await readJson(req, albumSchema.partial());
  const updated = await db.album.update({ where: { id: a.id }, data: input, include: albumInclude });
  return json({ album: toAlbum(updated) });
});

/** Deletes the album record; its tracks remain as singles. */
export const DELETE = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  const a = await getAlbumFor((await ctx.params).id, user);
  if (a.ownerId !== user.id && user.role !== "ADMIN") throw forbidden();
  await db.album.delete({ where: { id: a.id } });
  await deleteObjectQuietly(a.coverKey);
  return json({ ok: true });
});
