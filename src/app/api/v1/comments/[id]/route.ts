import { route, json, notFound, forbidden } from "@/server/http";
import { requireAuth, hasRole } from "@/server/auth/session";
import { db } from "@/server/db";
import { logModeration } from "@/server/modules/moderation/audit";

type Ctx = RouteContext<"/api/v1/comments/[id]">;

/** Soft-deletes a comment: author, the track's owner, or moderators. */
export const DELETE = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  const c = await db.comment.findUnique({ where: { id: (await ctx.params).id }, include: { track: { select: { ownerId: true } } } });
  if (!c || c.deletedAt) throw notFound("Comment");
  const staff = hasRole(user, "MODERATOR");
  if (c.userId !== user.id && c.track.ownerId !== user.id && !staff) throw forbidden();
  await db.comment.update({ where: { id: c.id }, data: { deletedAt: new Date() } });
  if (staff && c.userId !== user.id && c.track.ownerId !== user.id) await logModeration(user.id, "comment.delete", "COMMENT", c.id);
  return json({ ok: true });
});
