import { route, json, notFound, ApiError } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import { db } from "@/server/db";
import { notify } from "@/server/modules/notifications/notify";

type Ctx = RouteContext<"/api/v1/users/[username]/follow">;

async function target(username: string) {
  const user = await db.user.findUnique({ where: { username: username.toLowerCase() }, select: { id: true, status: true } });
  if (!user || user.status === "BANNED") throw notFound("User");
  return user;
}

export const POST = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  rateLimit(`follow:${user.id}`, 120, 60 * 60 * 1000);
  const t = await target((await ctx.params).username);
  if (t.id === user.id) throw new ApiError("BAD_REQUEST", "You cannot follow yourself");
  const existing = await db.follow.findUnique({ where: { followerId_followingId: { followerId: user.id, followingId: t.id } } });
  if (!existing) {
    await db.follow.create({ data: { followerId: user.id, followingId: t.id } });
    await notify(t.id, "follow", { userId: user.id, username: user.username, displayName: user.displayName });
  }
  return json({ following: true });
});

export const DELETE = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  const t = await target((await ctx.params).username);
  await db.follow.deleteMany({ where: { followerId: user.id, followingId: t.id } });
  return json({ following: false });
});
