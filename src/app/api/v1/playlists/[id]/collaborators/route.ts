import { z } from "zod";
import { route, json, readJson, ApiError, forbidden, notFound } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import { db } from "@/server/db";
import { getPlaylistFor } from "@/server/modules/playlists/service";
import { notify } from "@/server/modules/notifications/notify";
import { usernameSchema } from "@/lib/validation";

type Ctx = RouteContext<"/api/v1/playlists/[id]/collaborators">;

/** Owner invites a collaborator by username (turns on collaborative mode). */
export const POST = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  rateLimit(`collab:${user.id}`, 60, 60 * 60 * 1000);
  const p = await getPlaylistFor((await ctx.params).id, user);
  if (p.ownerId !== user.id) throw forbidden();
  const { username, role } = await readJson(req, z.object({ username: usernameSchema, role: z.enum(["EDITOR", "VIEWER"]).default("EDITOR") }));
  const target = await db.user.findUnique({ where: { username }, select: { id: true, status: true } });
  if (!target || target.status === "BANNED") throw notFound("User");
  if (target.id === user.id) throw new ApiError("BAD_REQUEST", "You already own this playlist");
  if ((await db.playlistCollaborator.count({ where: { playlistId: p.id } })) >= 50) throw new ApiError("BAD_REQUEST", "Too many collaborators");
  await db.$transaction([
    db.playlistCollaborator.upsert({
      where: { playlistId_userId: { playlistId: p.id, userId: target.id } },
      create: { playlistId: p.id, userId: target.id, role },
      update: { role },
    }),
    db.playlist.update({ where: { id: p.id }, data: { isCollaborative: true } }),
  ]);
  await notify(target.id, "playlist_invite", { playlistId: p.id, title: p.title, username: user.username, displayName: user.displayName });
  return json({ ok: true });
});

/** Owner removes a collaborator, or a collaborator leaves. */
export const DELETE = route<Ctx>(async (req, ctx) => {
  const { user } = await requireAuth(req);
  const p = await getPlaylistFor((await ctx.params).id, user);
  const { userId } = await readJson(req, z.object({ userId: z.string().max(40) }));
  if (p.ownerId !== user.id && userId !== user.id) throw forbidden();
  await db.playlistCollaborator.deleteMany({ where: { playlistId: p.id, userId } });
  return json({ ok: true });
});
