import { route, json } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import { db } from "@/server/db";
import { getEditablePlaylist, playlistSummaryInclude, toPlaylistSummaries } from "@/server/modules/playlists/service";
import { deleteObjectQuietly, readImageFile, storeImage } from "@/server/media/images";

type Ctx = RouteContext<"/api/v1/playlists/[id]/cover">;

export const POST = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  rateLimit(`image:${user.id}`, 60, 60 * 60 * 1000);
  const p = await getEditablePlaylist((await ctx.params).id, user);
  const key = await storeImage(await readImageFile((await req.formData()).get("file")), "playlist", user.id);
  const row = await db.playlist.update({ where: { id: p.id }, data: { coverKey: key }, include: playlistSummaryInclude });
  await deleteObjectQuietly(p.coverKey);
  const [playlist] = await toPlaylistSummaries([row], user);
  return json({ playlist });
});

export const DELETE = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  const p = await getEditablePlaylist((await ctx.params).id, user);
  await db.playlist.update({ where: { id: p.id }, data: { coverKey: null } });
  await deleteObjectQuietly(p.coverKey);
  return json({ ok: true });
});
