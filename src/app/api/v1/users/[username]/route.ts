import { route, json, notFound } from "@/server/http";
import { getAuth, hasRole } from "@/server/auth/session";
import { db } from "@/server/db";
import { privacyOf, toPublicUser } from "@/server/modules/users/dto";

type Ctx = RouteContext<"/api/v1/users/[username]">;

export const GET = route<Ctx>(async (req, ctx) => {
  const { username } = await ctx.params;
  const auth = await getAuth(req);
  const user = await db.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!user || user.status === "BANNED") throw notFound("User");
  const isSelf = auth?.user.id === user.id;
  const isStaff = auth ? hasRole(auth.user, "MODERATOR") : false;
  const [followers, following, isFollowing] = await Promise.all([
    db.follow.count({ where: { followingId: user.id } }),
    db.follow.count({ where: { followerId: user.id } }),
    auth && !isSelf
      ? db.follow.findUnique({ where: { followerId_followingId: { followerId: auth.user.id, followingId: user.id } } })
      : null,
  ]);
  const restricted = user.isPrivate && !isSelf && !isStaff;
  return json({
    user: restricted
      ? { ...toPublicUser(user), bio: "", bannerUrl: null }
      : toPublicUser(user),
    restricted,
    isSelf,
    isFollowing: Boolean(isFollowing),
    counts: { followers, following },
    privacy: isSelf ? privacyOf(user) : undefined,
  });
});
