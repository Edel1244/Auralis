import { route, json } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import { db } from "@/server/db";
import { getViewableTrack } from "@/server/modules/tracks/queries";
import { notify } from "@/server/modules/notifications/notify";

type Ctx = RouteContext<"/api/v1/tracks/[id]/like">;

export const POST = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  rateLimit(`like:${user.id}`, 600, 60 * 60 * 1000);
  const t = await getViewableTrack((await ctx.params).id, user);
  const created = await db.trackLike.createMany({ data: [{ userId: user.id, trackId: t.id }], skipDuplicates: true });
  if (created.count) {
    await db.track.update({ where: { id: t.id }, data: { likeCount: { increment: 1 } } });
    if (t.ownerId !== user.id) {
      await notify(t.ownerId, "track_like", { trackId: t.id, title: t.title, username: user.username, displayName: user.displayName });
    }
  }
  return json({ liked: true });
});

export const DELETE = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  const id = (await ctx.params).id;
  const removed = await db.trackLike.deleteMany({ where: { userId: user.id, trackId: id } });
  if (removed.count) await db.track.updateMany({ where: { id, likeCount: { gt: 0 } }, data: { likeCount: { decrement: 1 } } });
  return json({ liked: false });
});
