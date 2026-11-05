import { route, json } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";
import { getAlbumFor } from "@/server/modules/albums/service";

type Ctx = RouteContext<"/api/v1/albums/[id]/like">;

export const POST = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  const a = await getAlbumFor((await ctx.params).id, user);
  await db.albumLike.createMany({ data: [{ userId: user.id, albumId: a.id }], skipDuplicates: true });
  return json({ liked: true });
});

export const DELETE = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  await db.albumLike.deleteMany({ where: { userId: user.id, albumId: (await ctx.params).id } });
  return json({ liked: false });
});
