import { route, json, ApiError } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";
import { getPlaylistFor } from "@/server/modules/playlists/service";
import { notify } from "@/server/modules/notifications/notify";

type Ctx = RouteContext<"/api/v1/playlists/[id]/follow">;

export const POST = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  const p = await getPlaylistFor((await ctx.params).id, user);
  if (p.ownerId === user.id) throw new ApiError("BAD_REQUEST", "You own this playlist");
  if (p.visibility === "PRIVATE") throw new ApiError("FORBIDDEN", "Private playlists cannot be followed");
  const r = await db.playlistFollow.createMany({ data: [{ userId: user.id, playlistId: p.id }], skipDuplicates: true });
  if (r.count) await notify(p.ownerId, "playlist_follow", { playlistId: p.id, title: p.title, username: user.username, displayName: user.displayName });
  return json({ following: true });
});

export const DELETE = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  await db.playlistFollow.deleteMany({ where: { userId: user.id, playlistId: (await ctx.params).id } });
  return json({ following: false });
});
