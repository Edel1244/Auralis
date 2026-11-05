import "server-only";
import type { ReportTarget, Role, User } from "@prisma/client";
import { db } from "../../db";
import { ApiError, forbidden, notFound } from "../../http";
import { hasRole } from "../../auth/session";
import { notify } from "../notifications/notify";
import { logModeration } from "./audit";

/** Repeat-infringer policy: this many upheld copyright strikes suspends uploads/account. */
export const STRIKE_LIMIT = 3;
export const STRIKE_SUSPENSION_DAYS = 30;

type Actor = Pick<User, "id" | "role">;

/** Moderators can't act on themselves, on staff of equal/higher rank, or (except admins) on admins. */
export function assertCanModerateUser(actor: Actor, target: Pick<User, "id" | "role">) {
  if (actor.id === target.id) throw new ApiError("FORBIDDEN", "You cannot moderate your own account");
  const rank: Record<Role, number> = { USER: 0, MODERATOR: 1, ADMIN: 2 };
  if (rank[target.role] >= rank[actor.role]) throw forbidden("You cannot moderate staff of equal or higher rank");
}

/** Adds a copyright strike and applies the repeat-infringer policy. Returns the new strike count. */
export async function addStrike(actor: Actor, userId: string, reason: string) {
  const u = await db.user.update({ where: { id: userId }, data: { strikeCount: { increment: 1 } } });
  await logModeration(actor.id, "user.strike", "USER", userId, reason, { strikes: u.strikeCount });
  if (u.strikeCount >= STRIKE_LIMIT && u.status === "ACTIVE" && u.role === "USER") {
    const until = new Date(Date.now() + STRIKE_SUSPENSION_DAYS * 24 * 3600 * 1000);
    await db.user.update({ where: { id: userId }, data: { status: "SUSPENDED", suspendedUntil: until } });
    await logModeration(actor.id, "user.suspend.auto", "USER", userId, `Repeat infringer policy (${u.strikeCount} strikes)`, { until: until.toISOString() });
    await notify(userId, "account_status", { status: "SUSPENDED", until: until.toISOString(), reason: "repeat_infringer" });
  }
  return u.strikeCount;
}

/** Removes a track from public view (kept for appeals/audit; owner still sees it as REMOVED). */
export async function removeTrack(actor: Actor, trackId: string, reason: string, opts: { strike?: boolean } = {}) {
  const t = await db.track.findUnique({ where: { id: trackId }, include: { owner: { select: { id: true, role: true } } } });
  if (!t) throw notFound("Track");
  if (t.owner.id !== actor.id && hasRole(t.owner, "MODERATOR") && !hasRole(actor, "ADMIN")) throw forbidden();
  await db.track.update({ where: { id: trackId }, data: { status: "REMOVED", statusReason: reason.slice(0, 300) || "Removed by moderators" } });
  await logModeration(actor.id, "track.remove", "TRACK", trackId, reason, { title: t.title, strike: Boolean(opts.strike) });
  await notify(t.ownerId, "content_removed", { trackId, title: t.title, reason });
  if (opts.strike) await addStrike(actor, t.ownerId, `Copyright: ${t.title}`);
}

export async function restoreTrack(actor: Actor, trackId: string, reason: string) {
  const t = await db.track.findUnique({ where: { id: trackId } });
  if (!t) throw notFound("Track");
  if (t.status !== "REMOVED") throw new ApiError("BAD_REQUEST", "Track is not removed");
  await db.track.update({ where: { id: trackId }, data: { status: "READY", statusReason: null } });
  await logModeration(actor.id, "track.restore", "TRACK", trackId, reason, { title: t.title });
}

/** Applies the "remove" decision to any reportable target. */
export async function removeTarget(actor: Actor, type: ReportTarget, id: string, reason: string, strike: boolean) {
  switch (type) {
    case "TRACK":
      return removeTrack(actor, id, reason, { strike });
    case "COMMENT": {
      await db.comment.update({ where: { id }, data: { deletedAt: new Date() } });
      return logModeration(actor.id, "comment.remove", "COMMENT", id, reason);
    }
    case "PLAYLIST": {
      const p = await db.playlist.update({ where: { id }, data: { visibility: "PRIVATE" } });
      await notify(p.ownerId, "content_removed", { playlistId: id, title: p.title, reason });
      return logModeration(actor.id, "playlist.hide", "PLAYLIST", id, reason);
    }
    case "ALBUM": {
      const a = await db.album.update({ where: { id }, data: { visibility: "PRIVATE" } });
      await notify(a.ownerId, "content_removed", { albumId: id, title: a.title, reason });
      return logModeration(actor.id, "album.hide", "ALBUM", id, reason);
    }
    case "THEME": {
      const th = await db.theme.update({ where: { id }, data: { isPublic: false } });
      await notify(th.authorId, "content_removed", { themeId: id, title: th.name, reason });
      return logModeration(actor.id, "theme.unpublish", "THEME", id, reason);
    }
    case "USER": {
      const u = await db.user.findUniqueOrThrow({ where: { id } });
      return suspendUser(actor, u, 7, reason);
    }
  }
}

export async function suspendUser(actor: Actor, target: Pick<User, "id" | "role">, days: number, reason: string) {
  assertCanModerateUser(actor, target);
  const until = new Date(Date.now() + days * 24 * 3600 * 1000);
  await db.user.update({ where: { id: target.id }, data: { status: "SUSPENDED", suspendedUntil: until } });
  await logModeration(actor.id, "user.suspend", "USER", target.id, reason, { days, until: until.toISOString() });
  await notify(target.id, "account_status", { status: "SUSPENDED", until: until.toISOString(), reason });
}
