import { z } from "zod";
import { route, json, readJson, pagination, paged, ApiError } from "@/server/http";
import { getAuth, requireAuth, hasRole } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import { db } from "@/server/db";
import { getViewableTrack } from "@/server/modules/tracks/queries";
import { toUserRef } from "@/server/modules/users/dto";
import { notify } from "@/server/modules/notifications/notify";

type Ctx = RouteContext<"/api/v1/tracks/[id]/comments">;

export const GET = route<Ctx>(async (req, ctx) => {
  const viewer = (await getAuth(req))?.user;
  const t = await getViewableTrack((await ctx.params).id, viewer);
  const p = pagination(req, 30);
  const where = { trackId: t.id, deletedAt: null, user: { status: { not: "BANNED" as const } } };
  const [rows, total] = await Promise.all([
    db.comment.findMany({ where, include: { user: true }, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take }),
    db.comment.count({ where }),
  ]);
  return json({
    enabled: t.commentsEnabled,
    ...paged(
      rows.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        user: toUserRef(c.user),
        canDelete: Boolean(viewer && (viewer.id === c.userId || viewer.id === t.ownerId || hasRole(viewer, "MODERATOR"))),
      })),
      total,
      p,
    ),
  });
});

export const POST = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  rateLimit(`comment:${user.id}`, 30, 10 * 60 * 1000);
  const t = await getViewableTrack((await ctx.params).id, user);
  if (!t.commentsEnabled) throw new ApiError("FORBIDDEN", "Comments are turned off for this track");
  // Stored as plain text; React escapes on render (no HTML is ever interpreted).
  const { body } = await readJson(req, z.object({ body: z.string().trim().min(1).max(1000) }));
  const c = await db.comment.create({ data: { trackId: t.id, userId: user.id, body }, include: { user: true } });
  if (t.ownerId !== user.id) await notify(t.ownerId, "comment", { trackId: t.id, title: t.title, username: user.username, displayName: user.displayName });
  return json({ comment: { id: c.id, body: c.body, createdAt: c.createdAt, user: toUserRef(c.user), canDelete: true } }, { status: 201 });
});
